BEGIN;
-- Record legacy administrative backfill honestly; this does not prove historic consent.
ALTER TABLE public.users ADD COLUMN login_id text;
ALTER TABLE public.users ADD COLUMN privacy_consent boolean NOT NULL DEFAULT false;
ALTER TABLE public.users ADD COLUMN privacy_consent_at timestamptz;
ALTER TABLE public.users ADD COLUMN privacy_policy_version text;
ALTER TABLE public.users ADD COLUMN privacy_consent_source text;
UPDATE public.users SET privacy_consent=true,privacy_consent_at=statement_timestamp(),privacy_policy_version='2026-09-23',privacy_consent_source='legacy_admin_backfill';
ALTER TABLE public.users ADD CONSTRAINT users_login_id_format CHECK(login_id IS NULL OR login_id ~ '^[a-z0-9_.-]{2,50}$');
CREATE UNIQUE INDEX users_login_id_casefold_key ON public.users(lower(login_id)) WHERE login_id IS NOT NULL;
-- A single namespace prevents an alias shadowing another member's immutable id.
CREATE TABLE lms_private.login_identifiers(identifier text PRIMARY KEY,user_id text NOT NULL REFERENCES public.users(id) ON DELETE CASCADE);
INSERT INTO lms_private.login_identifiers SELECT lower(id),id FROM public.users;
CREATE FUNCTION lms_private.sync_login_identifiers() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,lms_private,pg_temp AS $$
BEGIN
 IF TG_OP='UPDATE' AND NEW.id<>OLD.id THEN RAISE EXCEPTION 'member id is immutable'; END IF;
 IF TG_OP='UPDATE' THEN DELETE FROM lms_private.login_identifiers WHERE user_id=NEW.id; END IF;
 INSERT INTO lms_private.login_identifiers(identifier,user_id) VALUES(lower(NEW.id),NEW.id);
 IF NEW.login_id IS NOT NULL AND lower(NEW.login_id)<>lower(NEW.id) THEN
  INSERT INTO lms_private.login_identifiers(identifier,user_id) VALUES(lower(NEW.login_id),NEW.id);
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER users_login_identifiers AFTER INSERT OR UPDATE OF id,login_id ON public.users FOR EACH ROW EXECUTE FUNCTION lms_private.sync_login_identifiers();
CREATE FUNCTION lms_private.record_privacy_consent() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
BEGIN
 IF NEW.privacy_consent IS DISTINCT FROM true OR NEW.privacy_policy_version IS DISTINCT FROM '2026-09-23' OR NEW.privacy_consent_source NOT IN ('registration','admin_attested') OR NEW.privacy_consent_source IS NULL THEN RAISE EXCEPTION 'explicit current privacy consent required'; END IF;
 NEW.privacy_consent_at:=clock_timestamp();
 RETURN NEW;
END $$;
CREATE TRIGGER users_record_privacy_consent BEFORE INSERT ON public.users FOR EACH ROW EXECUTE FUNCTION lms_private.record_privacy_consent();
GRANT SELECT(login_id,privacy_consent,privacy_consent_at,privacy_policy_version,privacy_consent_source) ON public.users TO authenticated;
CREATE OR REPLACE FUNCTION public.lms_find_user(p_id text) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,lms_private,pg_temp AS $$
 SELECT to_jsonb(u) FROM public.users u JOIN lms_private.login_identifiers i ON i.user_id=u.id WHERE i.identifier=lower(trim(p_id))
$$;
CREATE OR REPLACE FUNCTION public.current_lms_user() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
 SELECT jsonb_build_object('id',id,'loginId',coalesce(login_id,id),'name',name,'birthDate',birth_date,'phone',phone,'memberNo',member_no,'role',role,'createdAt',created_at,'privacyConsent',privacy_consent,'privacyConsentAt',privacy_consent_at,'privacyPolicyVersion',privacy_policy_version,'privacyConsentSource',privacy_consent_source) FROM public.users WHERE auth_user_id=auth.uid()
$$;

CREATE FUNCTION public.lms_can_watch_lecture(p_lecture_id text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
 SELECT coalesce((SELECT public.lms_is_admin() OR (public.lms_can_study(l.course_id) AND (NOT c.sequential_unlock OR NOT EXISTS(
  SELECT 1 FROM (SELECT prior.id FROM public.lectures prior WHERE prior.course_id=l.course_id AND (prior.order_index,prior.id COLLATE "C")<(l.order_index,l.id COLLATE "C") ORDER BY prior.order_index DESC,prior.id COLLATE "C" DESC LIMIT 1) prev
  WHERE NOT EXISTS(SELECT 1 FROM public.progress p WHERE p.user_id=public.lms_user_id() AND p.lecture_id=prev.id AND p.progress_rate>=80)
 ))) FROM public.lectures l JOIN public.courses c ON c.id=l.course_id WHERE l.id=p_lecture_id),false)
$$;
REVOKE ALL ON FUNCTION public.lms_can_watch_lecture(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.lms_can_watch_lecture(text) TO authenticated;
-- Preserve the tested elapsed-time/unique-coverage implementation behind a new gate.
ALTER FUNCTION public.update_lecture_progress(text,numeric) RENAME TO lms_update_lecture_progress_internal;
REVOKE ALL ON FUNCTION public.lms_update_lecture_progress_internal(text,numeric) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.update_lecture_progress(p_lecture_id text,p_position numeric) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
 IF NOT public.lms_can_watch_lecture(p_lecture_id) THEN RAISE EXCEPTION 'previous lecture requires 80 percent progress' USING ERRCODE='42501'; END IF;
 RETURN public.lms_update_lecture_progress_internal(p_lecture_id,p_position);
END $$;
REVOKE ALL ON FUNCTION public.update_lecture_progress(text,numeric) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.update_lecture_progress(text,numeric) TO authenticated;
DROP POLICY lms_video_read ON storage.objects;
CREATE POLICY lms_video_read ON storage.objects FOR SELECT TO authenticated USING(bucket_id='lectures' AND (public.lms_is_admin() OR EXISTS(SELECT 1 FROM public.lectures l WHERE public.lms_video_object_path(l.video_url)=storage.objects.name AND public.lms_can_watch_lecture(l.id))));
-- Verified public welcome song only. Keep the lecture bucket private; anonymous
-- visitors can request a short-lived signed URL for this exact MPEG object.
CREATE POLICY lms_public_welcome_song ON storage.objects FOR SELECT TO anon,authenticated
 USING(bucket_id='lectures' AND name='audio/namo_buddhaya_song.mp3' AND metadata->>'mimetype'='audio/mpeg');

CREATE TABLE public.site_announcements(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),title text NOT NULL CHECK(length(trim(title)) BETWEEN 1 AND 200),
 content text NOT NULL DEFAULT '' CHECK(length(content)<=10000),type text NOT NULL DEFAULT 'text' CHECK(type IN ('text','image')),
 image_url text CHECK(image_url IS NULL OR (length(image_url)<=2048 AND image_url ~ '^https?://')),
 link_url text CHECK(link_url IS NULL OR (length(link_url)<=2048 AND link_url ~ '^https?://')),
 enabled boolean NOT NULL DEFAULT false,starts_at timestamptz,ends_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK(ends_at IS NULL OR starts_at IS NULL OR ends_at>starts_at),
 CHECK(type<>'image' OR image_url IS NOT NULL),
 CHECK(length(trim(content))>0 OR image_url IS NOT NULL)
);
ALTER TABLE public.site_announcements ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.site_announcements FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.site_announcements TO anon,authenticated;
GRANT INSERT,UPDATE,DELETE ON public.site_announcements TO authenticated;
CREATE POLICY announcements_public ON public.site_announcements FOR SELECT TO anon,authenticated USING(enabled AND (starts_at IS NULL OR starts_at<=now()) AND (ends_at IS NULL OR ends_at>now()));
CREATE POLICY announcements_admin ON public.site_announcements FOR ALL TO authenticated USING(public.lms_is_admin()) WITH CHECK(public.lms_is_admin());
CREATE FUNCTION lms_private.announcement_timestamp() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,pg_temp AS $$ BEGIN NEW.updated_at:=clock_timestamp(); IF TG_OP='INSERT' THEN NEW.created_at:=NEW.updated_at; ELSE NEW.created_at:=OLD.created_at; END IF; RETURN NEW; END $$;
CREATE TRIGGER announcement_timestamp BEFORE INSERT OR UPDATE ON public.site_announcements FOR EACH ROW EXECUTE FUNCTION lms_private.announcement_timestamp();
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types) VALUES('announcement-images','announcement-images',true,5242880,ARRAY['image/jpeg','image/png','image/webp','image/gif']) ON CONFLICT(id) DO UPDATE SET public=true,file_size_limit=5242880,allowed_mime_types=excluded.allowed_mime_types;
CREATE POLICY announcement_images_read ON storage.objects FOR SELECT TO anon,authenticated USING(bucket_id='announcement-images');
CREATE POLICY announcement_images_admin ON storage.objects FOR ALL TO authenticated USING(bucket_id='announcement-images' AND public.lms_is_admin()) WITH CHECK(bucket_id='announcement-images' AND public.lms_is_admin() AND name ~* '^[a-z0-9_-]+\.(jpg|jpeg|png|webp|gif)$');

ALTER TABLE public.enrollments ADD COLUMN application_version bigint NOT NULL DEFAULT 1;
CREATE FUNCTION lms_private.enrollment_version() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,pg_temp AS $$
BEGIN
 IF TG_OP='INSERT' THEN NEW.application_version:=1;
 ELSE NEW.application_version:=OLD.application_version;
  IF NEW.status IN ('applied','pending') AND (OLD.status NOT IN ('applied','pending') OR NEW.enrolled_at<>OLD.enrolled_at) THEN NEW.application_version:=OLD.application_version+1; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER enrollment_version BEFORE INSERT OR UPDATE ON public.enrollments FOR EACH ROW EXECUTE FUNCTION lms_private.enrollment_version();
CREATE TABLE lms_private.sms_outbox(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),event_key text NOT NULL UNIQUE,kind text NOT NULL CHECK(kind IN ('enrollment_student','enrollment_admin','question_admin','answer_student')),
 payload jsonb NOT NULL,status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','processing','retry','accepted','mock','failed','uncertain')),
 attempts integer NOT NULL DEFAULT 0,next_attempt_at timestamptz NOT NULL DEFAULT now(),lease_token uuid,lease_until timestamptz,
 provider_id text,last_code text,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sms_outbox_due ON lms_private.sms_outbox(next_attempt_at) WHERE status IN ('pending','retry');
CREATE TABLE lms_private.sms_attempts(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,outbox_id uuid NOT NULL REFERENCES lms_private.sms_outbox(id),attempt integer NOT NULL,status text NOT NULL,code text,provider_id text,created_at timestamptz NOT NULL DEFAULT now());
-- The trigger only writes durable work. Provider/network failures never run in this transaction.
CREATE FUNCTION lms_private.enqueue_sms() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,lms_private,pg_temp AS $$
DECLARE v_user text; v_course text; v_key text; v_payload jsonb;
BEGIN
 IF TG_TABLE_NAME='enrollments' THEN
  IF NEW.status NOT IN ('applied','pending') THEN RETURN NEW; END IF;
  IF TG_OP='UPDATE' AND NEW.application_version=OLD.application_version THEN RETURN NEW; END IF;
  v_user:=NEW.user_id; v_course:=NEW.course_id; v_key:='enrollment:'||NEW.id||':'||NEW.application_version;
 ELSIF TG_TABLE_NAME='qa_posts' THEN v_user:=NEW.author_id; v_course:=NEW.course_id; v_key:='question:'||NEW.id;
 ELSE SELECT author_id,course_id INTO v_user,v_course FROM public.qa_posts WHERE id=NEW.post_id; v_key:='answer:'||NEW.id;
 END IF;
 SELECT jsonb_build_object('name',u.name,'phone',regexp_replace(u.phone,'[^0-9]','','g'),'courseTitle',c.title,'price',c.price) INTO v_payload FROM public.users u CROSS JOIN public.courses c WHERE u.id=v_user AND c.id=v_course;
 IF v_payload IS NULL THEN RETURN NEW; END IF;
 IF TG_TABLE_NAME='qa_posts' THEN
  v_payload:=v_payload||jsonb_build_object('questionContent',NEW.content,'lectureId',NEW.lecture_id,'postId',NEW.id);
 ELSIF TG_TABLE_NAME='qa_answers' THEN
  SELECT v_payload||jsonb_build_object('lectureId',p.lecture_id,'postId',p.id) INTO v_payload FROM public.qa_posts p WHERE p.id=NEW.post_id;
 END IF;
 IF TG_TABLE_NAME='enrollments' THEN
  INSERT INTO lms_private.sms_outbox(event_key,kind,payload) VALUES(v_key||':student','enrollment_student',v_payload),(v_key||':admin','enrollment_admin',v_payload) ON CONFLICT(event_key) DO NOTHING;
 ELSE
  INSERT INTO lms_private.sms_outbox(event_key,kind,payload) VALUES(v_key,CASE WHEN TG_TABLE_NAME='qa_posts' THEN 'question_admin' ELSE 'answer_student' END,v_payload) ON CONFLICT(event_key) DO NOTHING;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER enrollment_sms AFTER INSERT OR UPDATE ON public.enrollments FOR EACH ROW EXECUTE FUNCTION lms_private.enqueue_sms();
CREATE TRIGGER question_sms AFTER INSERT ON public.qa_posts FOR EACH ROW EXECUTE FUNCTION lms_private.enqueue_sms();
CREATE TRIGGER answer_sms AFTER INSERT ON public.qa_answers FOR EACH ROW EXECUTE FUNCTION lms_private.enqueue_sms();
CREATE FUNCTION public.lms_claim_sms(p_limit integer DEFAULT 10) RETURNS SETOF lms_private.sms_outbox LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,lms_private,pg_temp AS $$
BEGIN
 -- A crashed worker may have sent a message. Never blindly re-send an expired lease.
 WITH expired AS (UPDATE lms_private.sms_outbox SET status='uncertain',last_code='lease_expired',updated_at=now() WHERE status='processing' AND lease_until<now() RETURNING *)
 INSERT INTO lms_private.sms_attempts(outbox_id,attempt,status,code) SELECT id,attempts,'uncertain','lease_expired' FROM expired;
 RETURN QUERY WITH due AS (SELECT id FROM lms_private.sms_outbox WHERE status IN ('pending','retry') AND next_attempt_at<=now() AND attempts<5 ORDER BY created_at,id FOR UPDATE SKIP LOCKED LIMIT greatest(1,least(coalesce(p_limit,10),50)))
 UPDATE lms_private.sms_outbox o SET status='processing',attempts=attempts+1,lease_token=gen_random_uuid(),lease_until=now()+interval '5 minutes',updated_at=now() FROM due WHERE o.id=due.id RETURNING o.*;
END $$;
CREATE FUNCTION public.lms_finish_sms(p_id uuid,p_lease_token uuid,p_status text,p_code text DEFAULT NULL,p_provider_id text DEFAULT NULL) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,lms_private,pg_temp AS $$
DECLARE item lms_private.sms_outbox;
BEGIN
 IF p_status NOT IN ('retry','accepted','mock','failed','uncertain') OR length(coalesce(p_code,''))>80 OR length(coalesce(p_provider_id,''))>100 THEN RAISE EXCEPTION 'invalid result'; END IF;
 SELECT * INTO item FROM lms_private.sms_outbox WHERE id=p_id AND lease_token=p_lease_token AND status='processing' FOR UPDATE;
 IF NOT FOUND THEN RETURN false; END IF;
 IF p_status='retry' AND item.attempts>=5 THEN p_status:='failed'; END IF;
 UPDATE lms_private.sms_outbox SET status=p_status,last_code=p_code,provider_id=p_provider_id,next_attempt_at=now()+make_interval(secs=>least(3600,(30*power(2,item.attempts))::integer)),lease_until=NULL,updated_at=now() WHERE id=p_id;
 INSERT INTO lms_private.sms_attempts(outbox_id,attempt,status,code,provider_id) VALUES(p_id,item.attempts,p_status,p_code,p_provider_id);
 RETURN true;
END $$;
REVOKE ALL ON ALL TABLES IN SCHEMA lms_private FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.lms_claim_sms(integer),public.lms_finish_sms(uuid,uuid,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.lms_claim_sms(integer),public.lms_finish_sms(uuid,uuid,text,text,text) TO service_role;
REVOKE ALL ON FUNCTION lms_private.sync_login_identifiers(),lms_private.record_privacy_consent(),lms_private.announcement_timestamp(),lms_private.enrollment_version(),lms_private.enqueue_sms() FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.lms_sms_audit(p_limit integer DEFAULT 50) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,lms_private,pg_temp AS $$
BEGIN
 IF NOT public.lms_is_admin() THEN RAISE EXCEPTION 'administrator required' USING ERRCODE='42501'; END IF;
 RETURN coalesce((SELECT jsonb_agg(to_jsonb(a)) FROM (SELECT id,kind,status,attempts,last_code,provider_id,created_at,updated_at FROM lms_private.sms_outbox ORDER BY created_at DESC LIMIT greatest(1,least(coalesce(p_limit,50),200))) a),'[]'::jsonb);
END $$;
CREATE FUNCTION public.lms_retry_sms(p_id uuid,p_confirm_not_sent boolean DEFAULT false) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,lms_private,pg_temp AS $$
DECLARE item lms_private.sms_outbox;
BEGIN
 IF NOT public.lms_is_admin() THEN RAISE EXCEPTION 'administrator required' USING ERRCODE='42501'; END IF;
 SELECT * INTO item FROM lms_private.sms_outbox WHERE id=p_id FOR UPDATE;
 IF NOT FOUND OR item.status NOT IN ('failed','uncertain') THEN RETURN false; END IF;
 IF item.status='uncertain' AND p_confirm_not_sent IS DISTINCT FROM true THEN RAISE EXCEPTION 'confirm no provider delivery before retry'; END IF;
 INSERT INTO lms_private.sms_attempts(outbox_id,attempt,status,code) VALUES(p_id,item.attempts,'manual_retry',CASE WHEN item.status='uncertain' THEN 'admin_confirmed_not_sent' ELSE 'admin_retry' END);
 UPDATE lms_private.sms_outbox SET status='retry',attempts=0,next_attempt_at=now(),lease_token=NULL,lease_until=NULL,last_code='admin_retry',updated_at=now() WHERE id=p_id;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.lms_sms_audit(integer),public.lms_retry_sms(uuid,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.lms_sms_audit(integer),public.lms_retry_sms(uuid,boolean) TO authenticated;
ALTER TABLE lms_private.login_identifiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE lms_private.sms_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE lms_private.sms_attempts ENABLE ROW LEVEL SECURITY;
COMMIT;
