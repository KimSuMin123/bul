-- Non-destructive upgrade of database_setup.sql. Run on a backup/staging database first.
-- Duplicate enrollment/certificate pairs deliberately abort this transaction for manual review.
BEGIN;
CREATE SCHEMA IF NOT EXISTS lms_private;
REVOKE ALL ON SCHEMA lms_private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA lms_private TO service_role;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS auth_user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.users ALTER COLUMN password DROP NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS users_id_casefold_key ON public.users (lower(id));
CREATE UNIQUE INDEX IF NOT EXISTS users_phone_normalized_key ON public.users (regexp_replace(phone, '[^0-9]', '', 'g'));
CREATE UNIQUE INDEX IF NOT EXISTS enrollments_user_course_key ON public.enrollments(user_id,course_id);
CREATE UNIQUE INDEX IF NOT EXISTS certificates_user_course_key ON public.certificates(user_id,course_id);
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS request_id uuid UNIQUE;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS result jsonb;

-- Remove inherited permissive policies, including storage policies from the bootstrap script.
DO $$ DECLARE p record; BEGIN
  FOR p IN SELECT schemaname,tablename,policyname FROM pg_policies
    WHERE schemaname='public' AND tablename=ANY(ARRAY['users','courses','lectures','enrollments','payments','progress','qa_posts','qa_answers','certificates','exam_attempts'])
  LOOP EXECUTE format('DROP POLICY %I ON %I.%I',p.policyname,p.schemaname,p.tablename); END LOOP;
END $$;
DROP POLICY IF EXISTS "Public lecture video streaming" ON storage.objects;
DROP POLICY IF EXISTS "Allow video upload to lectures" ON storage.objects;
DROP POLICY IF EXISTS "Allow video update in lectures" ON storage.objects;
DROP POLICY IF EXISTS "Allow video delete in lectures" ON storage.objects;
UPDATE storage.buckets SET public=false WHERE id='lectures';
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types) VALUES('thumbnails','thumbnails',true,10485760,ARRAY['image/jpeg','image/png','image/webp','image/gif']) ON CONFLICT(id) DO UPDATE SET public=true,file_size_limit=10485760,allowed_mime_types=excluded.allowed_mime_types;
DROP VIEW IF EXISTS public.users_public_view;
DROP FUNCTION IF EXISTS public.login_user(text,text);
DROP FUNCTION IF EXISTS public.process_course_payment(text,text,integer,text,text,date);

CREATE OR REPLACE FUNCTION public.lms_user_id() RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp
AS $$ SELECT id::text FROM public.users WHERE auth_user_id=auth.uid() $$;
CREATE OR REPLACE FUNCTION public.current_lms_user() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp
AS $$ SELECT jsonb_build_object('id',id,'name',name,'birthDate',birth_date,'phone',phone,'memberNo',member_no,'role',role,'createdAt',created_at) FROM public.users WHERE auth_user_id=auth.uid() $$;
REVOKE ALL ON FUNCTION public.current_lms_user() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.current_lms_user() TO authenticated;
CREATE OR REPLACE FUNCTION public.lms_is_admin() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp
AS $$ SELECT EXISTS(SELECT 1 FROM public.users WHERE auth_user_id=auth.uid() AND role='admin') $$;
CREATE OR REPLACE FUNCTION public.lms_can_study(p_course_id text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp
AS $$ SELECT public.lms_is_admin() OR EXISTS(SELECT 1 FROM public.enrollments WHERE user_id=public.lms_user_id() AND course_id IN (p_course_id,'bundle-all') AND status IN ('active','completed') AND expire_at>=CURRENT_DATE) $$;
REVOKE ALL ON FUNCTION public.lms_user_id(), public.lms_is_admin(), public.lms_can_study(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lms_user_id(), public.lms_is_admin(), public.lms_can_study(text) TO authenticated;

REVOKE ALL ON public.users,public.courses,public.lectures,public.enrollments,public.payments,public.progress,public.qa_posts,public.qa_answers,public.certificates,public.exam_attempts FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.users TO service_role;
GRANT SELECT(id,auth_user_id,name,birth_date,phone,member_no,role,created_at) ON public.users TO authenticated;
CREATE POLICY users_read ON public.users FOR SELECT TO authenticated USING(id=public.lms_user_id() OR public.lms_is_admin());
-- Profile writes and legacy passwords are exclusively handled by the Edge service role.
GRANT SELECT(id,title,subtitle,category,thumbnail,default_period_days,sequential_unlock,price,instructor,cert_type,cert_grade,cert_type_full,cert_reg_no,cert_reg_office) ON public.courses TO anon,authenticated;
GRANT INSERT(id,title,subtitle,category,thumbnail,default_period_days,sequential_unlock,price,instructor,cert_type,cert_grade,cert_type_full,cert_reg_no,cert_reg_office), UPDATE(id,title,subtitle,category,thumbnail,default_period_days,sequential_unlock,price,instructor,cert_type,cert_grade,cert_type_full,cert_reg_no,cert_reg_office), DELETE ON public.courses TO authenticated;
CREATE POLICY courses_read ON public.courses FOR SELECT TO anon,authenticated USING(true);
CREATE POLICY courses_admin ON public.courses FOR ALL TO authenticated USING(public.lms_is_admin()) WITH CHECK(public.lms_is_admin());
GRANT SELECT ON public.lectures TO anon,authenticated;
GRANT INSERT,UPDATE,DELETE ON public.lectures TO authenticated;
CREATE POLICY lectures_read ON public.lectures FOR SELECT TO anon,authenticated USING(true);
CREATE POLICY lectures_admin ON public.lectures FOR ALL TO authenticated USING(public.lms_is_admin()) WITH CHECK(public.lms_is_admin());
GRANT SELECT,INSERT,UPDATE,DELETE ON public.enrollments TO authenticated;
CREATE POLICY enrollments_read ON public.enrollments FOR SELECT TO authenticated USING(user_id=public.lms_user_id() OR public.lms_is_admin());
CREATE POLICY enrollments_apply ON public.enrollments FOR INSERT TO authenticated WITH CHECK(user_id=public.lms_user_id() AND status IN ('applied','pending') AND paid_at IS NULL AND enrolled_at=CURRENT_DATE);
CREATE POLICY enrollments_reapply ON public.enrollments FOR UPDATE TO authenticated USING(user_id=public.lms_user_id() AND (status IN ('applied','pending') OR expire_at<CURRENT_DATE)) WITH CHECK(user_id=public.lms_user_id() AND status IN ('applied','pending') AND paid_at IS NULL AND enrolled_at=CURRENT_DATE);
CREATE POLICY enrollments_admin ON public.enrollments FOR ALL TO authenticated USING(public.lms_is_admin()) WITH CHECK(public.lms_is_admin());
GRANT SELECT ON public.payments TO authenticated;
CREATE POLICY payments_admin_read ON public.payments FOR SELECT TO authenticated USING(public.lms_is_admin());
GRANT SELECT ON public.progress TO authenticated;
CREATE POLICY progress_read ON public.progress FOR SELECT TO authenticated USING(user_id=public.lms_user_id() OR public.lms_is_admin());
CREATE POLICY progress_write ON public.progress FOR INSERT TO authenticated WITH CHECK(user_id=public.lms_user_id() AND public.lms_can_study(course_id) AND EXISTS(SELECT 1 FROM public.lectures l WHERE l.id=lecture_id AND l.course_id=progress.course_id AND last_played_seconds BETWEEN 0 AND l.duration_seconds AND watched_seconds BETWEEN 0 AND l.duration_seconds AND progress_rate BETWEEN 0 AND 100 AND (NOT completed OR progress_rate>=99)));
CREATE POLICY progress_update ON public.progress FOR UPDATE TO authenticated USING(user_id=public.lms_user_id()) WITH CHECK(user_id=public.lms_user_id() AND public.lms_can_study(course_id) AND EXISTS(SELECT 1 FROM public.lectures l WHERE l.id=lecture_id AND l.course_id=progress.course_id AND last_played_seconds BETWEEN 0 AND l.duration_seconds AND watched_seconds BETWEEN 0 AND l.duration_seconds AND progress_rate BETWEEN 0 AND 100 AND (NOT completed OR progress_rate>=99)));
GRANT SELECT,INSERT,DELETE ON public.qa_posts TO authenticated;
CREATE POLICY qa_posts_read ON public.qa_posts FOR SELECT TO authenticated USING(public.lms_is_admin() OR author_id=public.lms_user_id() OR (NOT is_private AND public.lms_can_study(course_id)));
CREATE POLICY qa_posts_create ON public.qa_posts FOR INSERT TO authenticated WITH CHECK(author_id=public.lms_user_id() AND public.lms_can_study(course_id) AND EXISTS(SELECT 1 FROM public.lectures l WHERE l.id=lecture_id AND l.course_id=qa_posts.course_id));
CREATE POLICY qa_posts_delete ON public.qa_posts FOR DELETE TO authenticated USING(author_id=public.lms_user_id() OR public.lms_is_admin());
GRANT SELECT,INSERT,UPDATE,DELETE ON public.qa_answers TO authenticated;
CREATE POLICY qa_answers_read ON public.qa_answers FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.qa_posts p WHERE p.id=post_id));
CREATE POLICY qa_answers_admin ON public.qa_answers FOR ALL TO authenticated USING(public.lms_is_admin()) WITH CHECK(public.lms_is_admin() AND author_id=public.lms_user_id());
GRANT SELECT ON public.certificates,public.exam_attempts TO authenticated;
CREATE POLICY certificates_read ON public.certificates FOR SELECT TO authenticated USING(user_id=public.lms_user_id() OR public.lms_is_admin());
CREATE POLICY attempts_read ON public.exam_attempts FOR SELECT TO authenticated USING(user_id=public.lms_user_id() OR public.lms_is_admin());
CREATE OR REPLACE FUNCTION public.lms_video_object_path(p_url text) RETURNS text LANGUAGE plpgsql IMMUTABLE STRICT SET search_path=pg_catalog,pg_temp AS $$
DECLARE encoded text; decoded bytea:=''::bytea; pos integer:=1; token text;
BEGIN
 IF p_url !~ '^https?://' THEN RETURN p_url; END IF;
 encoded:=substring(split_part(split_part(p_url,'?',1),'#',1) FROM '^https?://[^/]+/storage/v1/object/(?:public/|authenticated/|sign/)?lectures/(.+)$');
 IF encoded IS NULL THEN RETURN NULL; END IF;
 WHILE pos<=length(encoded) LOOP
  token:=substring(encoded,pos,1);
  IF token='%' THEN
   IF substring(encoded,pos+1,2) !~ '^[0-9A-Fa-f]{2}$' THEN RETURN NULL; END IF;
   decoded:=decoded||decode(substring(encoded,pos+1,2),'hex'); pos:=pos+3;
  ELSE decoded:=decoded||convert_to(token,'UTF8'); pos:=pos+1; END IF;
 END LOOP;
 RETURN convert_from(decoded,'UTF8');
EXCEPTION WHEN OTHERS THEN RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public.lms_video_object_path(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.lms_video_object_path(text) TO authenticated;
CREATE POLICY lms_video_read ON storage.objects FOR SELECT TO authenticated USING(bucket_id='lectures' AND (public.lms_is_admin() OR EXISTS(SELECT 1 FROM public.lectures l WHERE public.lms_video_object_path(l.video_url)=storage.objects.name AND public.lms_can_study(l.course_id))));
CREATE POLICY lms_video_admin_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK(bucket_id='lectures' AND public.lms_is_admin());
CREATE POLICY lms_video_admin_update ON storage.objects FOR UPDATE TO authenticated USING(bucket_id='lectures' AND public.lms_is_admin()) WITH CHECK(bucket_id='lectures' AND public.lms_is_admin());
CREATE POLICY lms_video_admin_delete ON storage.objects FOR DELETE TO authenticated USING(bucket_id='lectures' AND public.lms_is_admin());
CREATE POLICY lms_legacy_thumbnail_read ON storage.objects FOR SELECT TO anon,authenticated USING(bucket_id='lectures' AND name ~* '^thumbs/[^/]+\.(jpg|jpeg|png|webp|gif)$' AND metadata->>'mimetype' IN ('image/jpeg','image/png','image/webp','image/gif'));
CREATE POLICY lms_thumbnail_read ON storage.objects FOR SELECT TO anon,authenticated USING(bucket_id='thumbnails');
CREATE POLICY lms_thumbnail_admin ON storage.objects FOR ALL TO authenticated USING(bucket_id='thumbnails' AND public.lms_is_admin()) WITH CHECK(bucket_id='thumbnails' AND public.lms_is_admin());

CREATE TABLE lms_private.course_exams(course_id text PRIMARY KEY REFERENCES public.courses(id) ON DELETE CASCADE, questions jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE lms_private.default_exam(singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),questions jsonb NOT NULL);
CREATE TABLE lms_private.legacy_exam_text(course_id text PRIMARY KEY REFERENCES public.courses(id) ON DELETE CASCADE, raw_text text NOT NULL);
INSERT INTO lms_private.legacy_exam_text SELECT id,raw_exam_text FROM public.courses WHERE coalesce(raw_exam_text,'')<>'';
-- Keep original text in a private archive until the parser import has been verified.
UPDATE public.courses SET raw_exam_text=NULL;
CREATE TABLE lms_private.exam_sessions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id text NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,course_id text NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,questions jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),expires_at timestamptz NOT NULL DEFAULT now()+interval '60 minutes',result jsonb);
CREATE TABLE lms_private.playback_clocks(user_id text NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,lecture_id text NOT NULL REFERENCES public.lectures(id) ON DELETE CASCADE,last_seen timestamptz NOT NULL,last_position numeric NOT NULL,credited_seconds numeric NOT NULL DEFAULT 0,watched_ranges nummultirange NOT NULL DEFAULT '{}'::nummultirange,PRIMARY KEY(user_id,lecture_id));
GRANT ALL ON ALL TABLES IN SCHEMA lms_private TO service_role;
CREATE OR REPLACE FUNCTION public.update_lecture_progress(p_lecture_id text,p_position numeric) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,lms_private,pg_temp AS $$
DECLARE uid text:=public.lms_user_id(); lecture public.lectures; clock lms_private.playback_clocks; saved public.progress; observed timestamptz:=clock_timestamp(); elapsed numeric; credit numeric; position_value numeric; rate numeric; delta numeric; watched nummultirange; tolerance numeric; legacy_credit numeric;
BEGIN
 SELECT * INTO lecture FROM public.lectures WHERE id=p_lecture_id;
 IF uid IS NULL OR NOT FOUND OR NOT public.lms_can_study(lecture.course_id) THEN RAISE EXCEPTION 'Active course enrollment required' USING ERRCODE='42501'; END IF;
 IF p_position IS NULL OR p_position<0 OR p_position::text IN ('NaN','Infinity','-Infinity') OR lecture.duration_seconds IS NULL OR lecture.duration_seconds<=0 THEN RAISE EXCEPTION 'Invalid playback position'; END IF;
 position_value:=least(p_position,lecture.duration_seconds);
 legacy_credit:=greatest(0,least(lecture.duration_seconds,coalesce((SELECT watched_seconds FROM public.progress WHERE user_id=uid AND lecture_id=p_lecture_id),0)));
 INSERT INTO lms_private.playback_clocks(user_id,lecture_id,last_seen,last_position,credited_seconds,watched_ranges) VALUES(uid,p_lecture_id,observed,position_value,legacy_credit,nummultirange(numrange(0,legacy_credit,'[)'))) ON CONFLICT DO NOTHING;
 SELECT * INTO clock FROM lms_private.playback_clocks WHERE user_id=uid AND lecture_id=p_lecture_id FOR UPDATE;
 elapsed:=greatest(0,least(15,extract(epoch FROM observed-clock.last_seen)));
 watched:=clock.watched_ranges;
 delta:=position_value-clock.last_position;
 -- A seek larger than plausible playback earns nothing. Small timing jitter is
 -- allowed, but replaying an already covered interval never increases coverage.
 IF delta>0 AND elapsed>0 AND delta<=elapsed*1.5+0.25 THEN
  watched:=watched+nummultirange(numrange(clock.last_position,position_value,'[)'));
 END IF;
 SELECT coalesce(sum(upper(segment)-lower(segment)),0) INTO credit FROM unnest(watched) AS segment;
 credit:=least(lecture.duration_seconds,greatest(credit,clock.credited_seconds));
 tolerance:=least(1,lecture.duration_seconds*0.01);
 -- Metadata rounds video duration to whole seconds. Only accept this small
 -- residual at the actual end after essentially all unique coverage is earned.
 IF position_value>=lecture.duration_seconds-tolerance AND credit>=lecture.duration_seconds-tolerance THEN credit:=lecture.duration_seconds; END IF;
 rate:=least(100,floor(10000*credit/lecture.duration_seconds)/100);
 UPDATE lms_private.playback_clocks SET last_seen=observed,last_position=position_value,credited_seconds=credit,watched_ranges=watched WHERE user_id=uid AND lecture_id=p_lecture_id;
 INSERT INTO public.progress(id,user_id,course_id,lecture_id,last_played_seconds,watched_seconds,progress_rate,completed,updated_at) VALUES('prog_'||gen_random_uuid()::text,uid,lecture.course_id,p_lecture_id,floor(position_value),floor(credit),rate,credit>=lecture.duration_seconds,observed) ON CONFLICT(user_id,lecture_id) DO UPDATE SET course_id=excluded.course_id,last_played_seconds=excluded.last_played_seconds,watched_seconds=excluded.watched_seconds,progress_rate=excluded.progress_rate,completed=excluded.completed,updated_at=excluded.updated_at RETURNING * INTO saved;
 IF saved.completed THEN
  PERFORM public.lms_sync_completion(uid,lecture.course_id);
  IF lecture.course_id<>'bundle-all' THEN PERFORM public.lms_sync_completion(uid,'bundle-all'); END IF;
 END IF;
 RETURN to_jsonb(saved);
END $$;
REVOKE ALL ON FUNCTION public.update_lecture_progress(text,numeric) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.update_lecture_progress(text,numeric) TO authenticated;
CREATE TABLE lms_private.auth_rate_limits(key text PRIMARY KEY, window_start timestamptz NOT NULL DEFAULT now(), attempts integer NOT NULL DEFAULT 0);
CREATE OR REPLACE FUNCTION public.lms_auth_rate_limit(p_key text) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=lms_private,pg_temp AS $$
DECLARE count_value integer;
BEGIN
 INSERT INTO lms_private.auth_rate_limits(key,attempts) VALUES(p_key,1) ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN auth_rate_limits.window_start<now()-interval '15 minutes' THEN 1 ELSE auth_rate_limits.attempts+1 END,window_start=CASE WHEN auth_rate_limits.window_start<now()-interval '15 minutes' THEN now() ELSE auth_rate_limits.window_start END RETURNING attempts INTO count_value;
 RETURN count_value<=20;
END $$;
CREATE OR REPLACE FUNCTION public.lms_find_user(p_id text) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$ SELECT to_jsonb(u) FROM public.users u WHERE lower(id)=lower(trim(p_id)) $$;
CREATE OR REPLACE FUNCTION public.lms_phone_available(p_phone text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$ SELECT NOT EXISTS(SELECT 1 FROM public.users WHERE regexp_replace(phone,'[^0-9]','','g')=p_phone) $$;
REVOKE ALL ON FUNCTION public.lms_auth_rate_limit(text),public.lms_find_user(text),public.lms_phone_available(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.lms_auth_rate_limit(text),public.lms_find_user(text),public.lms_phone_available(text) TO service_role;

CREATE OR REPLACE FUNCTION public.save_course_exam(p_course_id text,p_questions jsonb) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,lms_private,pg_temp AS $$
DECLARE q jsonb;
BEGIN
 IF NOT public.lms_is_admin() THEN RAISE EXCEPTION 'Administrator required' USING ERRCODE='42501'; END IF;
 IF jsonb_typeof(p_questions)<>'array' OR jsonb_array_length(p_questions)<1 OR jsonb_array_length(p_questions)>500 THEN RAISE EXCEPTION 'Invalid question bank'; END IF;
 FOR q IN SELECT value FROM jsonb_array_elements(p_questions) LOOP
   IF coalesce(q->>'id','')='' OR coalesce(q->>'question','')='' OR jsonb_typeof(q->'options') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Invalid question'; END IF;
   IF jsonb_array_length(q->'options')<2 OR coalesce(q->>'correctAnswer','') !~ '^[1-9][0-9]*$' OR (q->>'correctAnswer')::int>jsonb_array_length(q->'options') THEN RAISE EXCEPTION 'Invalid answer'; END IF;
 END LOOP;
 IF (SELECT count(*)<>count(DISTINCT value->>'id') FROM jsonb_array_elements(p_questions)) THEN RAISE EXCEPTION 'Duplicate question identifiers'; END IF;
 INSERT INTO lms_private.course_exams VALUES(p_course_id,p_questions,now()) ON CONFLICT(course_id) DO UPDATE SET questions=excluded.questions,updated_at=now();
 RETURN true;
END $$;
CREATE OR REPLACE FUNCTION public.get_course_exam(p_course_id text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,lms_private,pg_temp AS $$
BEGIN
 IF NOT public.lms_is_admin() THEN RAISE EXCEPTION 'Administrator required' USING ERRCODE='42501'; END IF;
 RETURN jsonb_build_object('questions',coalesce((SELECT questions FROM lms_private.course_exams WHERE course_id=p_course_id),'[]'::jsonb),'rawExamText',CASE WHEN EXISTS(SELECT 1 FROM lms_private.course_exams WHERE course_id=p_course_id) THEN NULL ELSE (SELECT raw_text FROM lms_private.legacy_exam_text WHERE course_id=p_course_id) END);
END $$;
CREATE OR REPLACE FUNCTION public.lms_course_complete(p_user_id text,p_course_id text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT EXISTS(SELECT 1 FROM public.lectures WHERE course_id=p_course_id OR p_course_id='bundle-all') AND NOT EXISTS(SELECT 1 FROM public.lectures l WHERE (l.course_id=p_course_id OR p_course_id='bundle-all') AND NOT EXISTS(SELECT 1 FROM public.progress p WHERE p.user_id=p_user_id AND p.lecture_id=l.id AND p.course_id=l.course_id AND p.progress_rate>=100 AND p.completed));
$$;
REVOKE ALL ON FUNCTION public.lms_course_complete(text,text) FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.lms_sync_completion(p_user_id text,p_course_id text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
 IF public.lms_course_complete(p_user_id,p_course_id) AND EXISTS(SELECT 1 FROM public.exam_attempts WHERE user_id=p_user_id AND course_id=p_course_id AND passed=true) THEN
  UPDATE public.enrollments SET status='completed' WHERE user_id=p_user_id AND course_id=p_course_id AND status='active' AND expire_at>=CURRENT_DATE;
 END IF;
END $$;
REVOKE ALL ON FUNCTION public.lms_sync_completion(text,text) FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.start_course_exam(p_course_id text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,lms_private,pg_temp AS $$
DECLARE bank jsonb; selected jsonb; session lms_private.exam_sessions; uid text:=public.lms_user_id();
BEGIN
 IF uid IS NULL OR NOT public.lms_can_study(p_course_id) OR NOT public.lms_course_complete(uid,p_course_id) THEN RAISE EXCEPTION 'Complete active course lectures first' USING ERRCODE='42501'; END IF;
 SELECT questions INTO bank FROM lms_private.course_exams WHERE course_id=p_course_id;
 IF bank IS NULL OR jsonb_array_length(bank)=0 THEN RAISE EXCEPTION 'Question bank is not configured'; END IF;
 -- Reuse an unfinished session to keep refreshes from disclosing the entire bank.
 SELECT * INTO session FROM lms_private.exam_sessions WHERE user_id=uid AND course_id=p_course_id AND result IS NULL AND expires_at>now() ORDER BY created_at DESC LIMIT 1;
 IF NOT FOUND THEN
  SELECT jsonb_agg(q) INTO selected FROM (SELECT value AS q FROM jsonb_array_elements(bank) ORDER BY random() LIMIT 20) picked;
  INSERT INTO lms_private.exam_sessions(user_id,course_id,questions) VALUES(uid,p_course_id,selected) RETURNING * INTO session;
 END IF;
 RETURN jsonb_build_object('attemptId',session.id,'expiresAt',session.expires_at,'questions',(SELECT jsonb_agg((value-'correctAnswer'-'explanation')||jsonb_build_object('examIndex',ordinality)) FROM jsonb_array_elements(session.questions) WITH ORDINALITY));
END $$;
CREATE OR REPLACE FUNCTION public.submit_course_exam(p_attempt_id uuid,p_answers jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,lms_private,pg_temp AS $$
DECLARE session lms_private.exam_sessions; q jsonb; chosen text; correct integer:=0; total integer; score_value integer; results jsonb:='[]'; result_value jsonb; idx integer:=0;
BEGIN
 SELECT * INTO session FROM lms_private.exam_sessions WHERE id=p_attempt_id AND user_id=public.lms_user_id() FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Exam session not found' USING ERRCODE='42501'; END IF;
 IF session.result IS NOT NULL THEN RETURN session.result; END IF;
 IF session.expires_at<now() OR NOT public.lms_can_study(session.course_id) THEN RAISE EXCEPTION 'Exam session expired' USING ERRCODE='42501'; END IF;
 IF jsonb_typeof(p_answers) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Invalid answers'; END IF;
 total:=jsonb_array_length(session.questions);
 FOR q IN SELECT value FROM jsonb_array_elements(session.questions) LOOP
  idx:=idx+1; chosen:=coalesce(p_answers->>(q->>'id'),p_answers->>idx::text,'');
  IF chosen=(q->>'correctAnswer') THEN correct:=correct+1; END IF;
  results:=results||jsonb_build_array((q-'correctAnswer'-'explanation')||jsonb_build_object('examIndex',idx,'chosenAnswer',chosen,'isCorrect',chosen=(q->>'correctAnswer')));
 END LOOP;
 score_value:=round(100.0*correct/total);
 INSERT INTO public.exam_attempts(id,user_id,course_id,score,passed,correct_count,total_count,question_results) VALUES(p_attempt_id::text,session.user_id,session.course_id,score_value,score_value>=60,correct,total,results);
 IF score_value>=60 THEN PERFORM public.lms_sync_completion(session.user_id,session.course_id); END IF;
 result_value:=jsonb_build_object('id',p_attempt_id,'userId',session.user_id,'courseId',session.course_id,'score',score_value,'passed',score_value>=60,'correctCount',correct,'totalCount',total,'questionResults',results,'createdAt',now(),'submittedAt',now());
 UPDATE lms_private.exam_sessions SET result=result_value WHERE id=p_attempt_id;
 RETURN result_value;
END $$;
CREATE OR REPLACE FUNCTION public.issue_course_certificate(p_course_id text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE uid text:=public.lms_user_id(); profile public.users; course public.courses; cert public.certificates;
BEGIN
 IF uid IS NULL OR NOT public.lms_can_study(p_course_id) OR NOT public.lms_course_complete(uid,p_course_id) OR NOT EXISTS(SELECT 1 FROM public.exam_attempts WHERE user_id=uid AND course_id=p_course_id AND passed=true) THEN RAISE EXCEPTION 'Course qualification not met' USING ERRCODE='42501'; END IF;
 SELECT * INTO profile FROM public.users WHERE id=uid;
 SELECT * INTO course FROM public.courses WHERE id=p_course_id;
 INSERT INTO public.certificates(cert_no,user_id,course_id,member_no,student_name,birth_date,course_title,period,issued_at,status) VALUES('CERT-'||gen_random_uuid()::text,uid,p_course_id,profile.member_no,profile.name,profile.birth_date,course.title,CURRENT_DATE::text,CURRENT_DATE,'valid') ON CONFLICT(user_id,course_id) DO NOTHING;
 SELECT * INTO cert FROM public.certificates WHERE user_id=uid AND course_id=p_course_id;
 PERFORM public.lms_sync_completion(uid,p_course_id);
 RETURN to_jsonb(cert);
END $$;
CREATE OR REPLACE FUNCTION public.verify_course_certificate(p_cert_no text) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT jsonb_build_object('cert_no',cert_no,'student_name',student_name,'course_title',course_title,'issued_at',issued_at,'status',status) FROM public.certificates WHERE cert_no=p_cert_no;
$$;
CREATE OR REPLACE FUNCTION public.process_course_payment(p_user_id text,p_course_id text,p_amount integer,p_manager text,p_method_memo text,p_request_id uuid,p_paid_at date DEFAULT CURRENT_DATE) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE pay public.payments; enr public.enrollments; period_days integer; expire_date date; result_value jsonb;
BEGIN
 IF NOT public.lms_is_admin() THEN RAISE EXCEPTION 'Administrator required' USING ERRCODE='42501'; END IF;
 IF p_request_id IS NULL OR p_amount IS NULL OR p_amount<0 OR coalesce(trim(p_manager),'')='' THEN RAISE EXCEPTION 'Invalid payment'; END IF;
 -- Serialize retries of the same request, including the first concurrent insert.
 PERFORM pg_advisory_xact_lock(hashtextextended(p_request_id::text,0));
 SELECT * INTO pay FROM public.payments WHERE request_id=p_request_id;
 IF FOUND THEN
  IF pay.user_id IS DISTINCT FROM p_user_id OR pay.course_id IS DISTINCT FROM p_course_id OR pay.amount IS DISTINCT FROM p_amount OR pay.paid_at IS DISTINCT FROM p_paid_at OR pay.method_memo IS DISTINCT FROM coalesce(trim(p_method_memo),'') THEN RAISE EXCEPTION 'Request id already used for different payment'; END IF;
  RETURN pay.result;
 END IF;
 SELECT default_period_days INTO period_days FROM public.courses WHERE id=p_course_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Course not found'; END IF;
 expire_date:=CURRENT_DATE+greatest(coalesce(period_days,90),1);
 INSERT INTO public.enrollments(id,user_id,course_id,status,enrolled_at,paid_at,expire_at) VALUES('enr_'||gen_random_uuid()::text,p_user_id,p_course_id,'active',CURRENT_DATE,p_paid_at,expire_date) ON CONFLICT(user_id,course_id) DO UPDATE SET status='active',paid_at=excluded.paid_at,expire_at=excluded.expire_at RETURNING * INTO enr;
 INSERT INTO public.payments(id,user_id,course_id,paid_at,manager,amount,method_memo,request_id) VALUES('pay_'||gen_random_uuid()::text,p_user_id,p_course_id,p_paid_at,(SELECT name FROM public.users WHERE id=public.lms_user_id()),p_amount,coalesce(trim(p_method_memo),''),p_request_id) RETURNING * INTO pay;
 result_value:=jsonb_build_object('success',true,'paymentId',pay.id,'enrollmentId',enr.id,'userId',p_user_id,'courseId',p_course_id,'status','active','expireAt',expire_date);
 UPDATE public.payments SET result=result_value WHERE id=pay.id;
 RETURN result_value;
END $$;

REVOKE ALL ON FUNCTION public.save_course_exam(text,jsonb),public.get_course_exam(text),public.start_course_exam(text),public.submit_course_exam(uuid,jsonb),public.issue_course_certificate(text),public.process_course_payment(text,text,integer,text,text,uuid,date),public.verify_course_certificate(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.save_course_exam(text,jsonb),public.get_course_exam(text),public.start_course_exam(text),public.submit_course_exam(uuid,jsonb),public.issue_course_certificate(text),public.process_course_payment(text,text,integer,text,text,uuid,date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_course_certificate(text) TO anon,authenticated;
-- Courses without custom exam text retain the original preset, on the server only.
INSERT INTO lms_private.default_exam(singleton,questions) VALUES(true,$seed$[{"id":"q_1","number":1,"question":"불학의범의 불전권공의에서, 봉안된 불보살께 올리는 상단 변공(變供)의 진언 짜임으로 옳은 것은?","options":["변식진언ㆍ시감로수진언ㆍ일자수륜관진언ㆍ유해진언","변식진언ㆍ출생공양진언ㆍ정식진언","정법계진언ㆍ정구업진언ㆍ개경진언","파지옥진언ㆍ해원결진언ㆍ멸업장진언 "],"correctAnswer":2,"explanation":"봉안된 불보살께 올리는 상단 변공은 변식진언ㆍ출생공양진언ㆍ정식진언의 세 진언으로 한다. ①의 사다라니는 하단의 굶주린 혼령을 위한 변공 법식이므로 상단 변공으로 오인하지 말아야 한다. (제06ㆍ08강)"},{"id":"q_2","number":2,"question":"사다라니(변식ㆍ시감로수ㆍ일자수륜관ㆍ유해)가 본래 어느 자리의 변공 법식인가?","options":["상단의 불보살을 위한 변공","중단의 신중을 위한 변공","하단의 굶주린 영가를 위한 변공","어느 단에도 속하지 않는 도량 결계 "],"correctAnswer":3,"explanation":"사다라니(변식ㆍ시감로수ㆍ일자수륜관ㆍ유해)는 본래 하단의 굶주린 혼령에게 음식을 베풀기 위한 변공 법식이다. (제08강)"},{"id":"q_3","number":3,"question":"이미 봉안된[모셔진] 불보살께 올릴 때 불학의범이 택한 표현으로 옳은 것은?","options":["일심봉청(一心奉請)","일심예경(一心禮敬)","보소청(普召請)","유치(由致) 청사(請詞) "],"correctAnswer":2,"explanation":"‘봉청’은 아직 모시지 않은 분을 청할 때 쓰고, 이미 봉안된 분께는 일심예경으로 올린다. 원리 기성의 불전권공의가 봉안된 분께도 ‘일심봉청’이라 한 것과 달리, 불학의범은 일심예경으로 한다. (제06강)"},{"id":"q_4","number":4,"question":"관음시식의 무외시(無畏施)에서, 영가의 두려움과 업장을 덜어 주기 위해 일컫는 것으로 옳은 것은?","options":["사다라니 변공","다섯 여래의 명호를 일컫는 칭양성호(稱揚聖號)","정법계진언","발사홍서원(發四弘誓願) "],"correctAnswer":2,"explanation":"무외시는 다섯 여래의 명호를 일컫는 칭양성호로 영가의 두려움과 업장을 덜어 주는 베풂이다. 재시(음식)ㆍ법시(진리)와 함께 시식의 세 보시를 이룬다. ①의 사다라니는 변식(재시)의 법식이다. (제08ㆍ11강)"},{"id":"q_5","number":5,"question":"예수재가 명부에 진 빚을 미리 갚는 재로서 다른 재와 갈리는, 그 고유한 물목ㆍ의식으로 옳게 묶인 것은?","options":["사자단ㆍ오로단ㆍ마구단","조전(造錢)ㆍ금은전ㆍ고사단(庫司壇)ㆍ함합소(緘合疏)","괘불 이운ㆍ설주이운","시련ㆍ대령ㆍ관욕 "],"correctAnswer":2,"explanation":"예수재는 명부에 진 빚을 미리 갚는 재여서 조전ㆍ금은전ㆍ고사단ㆍ함합소를 갖춘다. ①의 사자단ㆍ오로단은 수륙재, ③의 괘불ㆍ설주이운은 영산재, ④의 시련ㆍ대령ㆍ관욕은 준비 의식이므로 가려야 한다. (제15강)"},{"id":"q_6","number":6,"question":"관음시식에서 진령게(振鈴偈) 뒤, 영령을 청해 자리에 앉히기까지의 차서로 옳은 것은?","options":["보소청진언 → 영령청 → 향연청 → 가영 → 수위안좌게주","거불 → 창혼 → 착어 → 진령게","변식진언 → 시감로수진언 → 일자수륜관진언 → 유해진언","칭양성호 → 진언변공 → 장엄염불 → 봉송 "],"correctAnswer":1,"explanation":"진령게 뒤 보소청진언으로 청하고, 영령청ㆍ향연청ㆍ가영을 거쳐 수위안좌게주로 자리에 앉힌 다음 시식으로 든다. (제08강)"},{"id":"q_7","number":7,"question":"각 칠재(초재~육재)의 영반은 영령이 이미 영단에 모셔져 있어 어떤 차례를 생략하고 시작하는가?","options":["입장ㆍ수위안좌ㆍ상단거불을 생략하고 칭양성호부터","사다라니 변공을 생략하고 장엄염불부터","도량엄정을 생략하고 거불부터","아무것도 생략하지 않는다 "],"correctAnswer":1,"explanation":"각 칠재의 영반은 영령이 이미 영단에 모셔져 있으므로 입장ㆍ수위안좌ㆍ상단거불을 생략하고 칭양성호부터 시작한다. (제11강)"},{"id":"q_8","number":8,"question":"중단(신중단) 권공에서 신중께 올리는 공양의 방식으로 옳은 것은?","options":["새로 지은 공양을 신중께 따로 차려 올린다","상단에 올렸던 공양을 물려 신중께 올리는 마지퇴공(摩旨退供)으로 한다","음식을 변하게 하는 사다라니로 베푼다","공양 없이 예경만 올린다 "],"correctAnswer":2,"explanation":"중단의 신중께는 새 공양을 따로 차리지 않고, 상단에 올렸던 마지(摩旨)를 물려 올리는 마지퇴공으로 공양한다. 받들어 모시는 상단과 그 공덕을 나누는 중단의 위계가 여기에 담겨 있다. (제07강)"},{"id":"q_9","number":9,"question":"세화불학원 포살에서 진공진언ㆍ헌향ㆍ퇴공을 맡아 행하는 주체로 바르게 짝지은 것은?","options":["셋 다 전계화상이 행한다","진공진언 = 대중이 각자 보시금을 올림 / 헌향 = 소임자가 향을 피워 바침 / 퇴공 = 유       사(有司)가 공양물을 거둠","진공진언 = 인례사 / 헌향 = 대중 / 퇴공 = 교수사","셋 다 대중이 함께 행한다 "],"correctAnswer":2,"explanation":"포살에서 진공진언 때 대중이 각자 보시금(공양물)을 단에 올리고, 헌향은 소임자(수계자 대표)가 향을 피워 바치며, 퇴공진언 때 유사(有司)가 그 공양물을 거두어 내린다. ①ㆍ③ㆍ④는 소임 주체를 뒤섞은 것이다. (제13강)"},{"id":"q_10","number":10,"question":"포살의식 본문에는 없고 수계의식에만 속하는 차례로 옳게 묶인 것은?","options":["도량엄정ㆍ거불ㆍ진공진언","관세음보살멸업장진언ㆍ참회게주ㆍ연비(燃臂)ㆍ입지게(立志偈)","예불참회문ㆍ소례공양ㆍ헌향","시계선언ㆍ설계ㆍ회향게주 "],"correctAnswer":2,"explanation":"관세음보살멸업장진언ㆍ참회게주ㆍ연비ㆍ입지게는 모두 수계의식의 차례이며, 포살의식 본문에는 없다. 포살의 참회는 예불참회문(예참)이다. (제13강)"},{"id":"q_11","number":11,"question":"세화불학원 포살에서 바웃다오선계를 새기는 ‘이설화답 삼설제창(以說和答 三說齊唱)’의 뜻으로 옳은 것은?","options":["법사가 한 번만 설하고 대중은 묵송한다","법사가 선창하고 대중이 후창한 뒤 함께 제창하여, 한 계마다 세 번 거듭 새긴다","대중이 돌아가며 한 사람씩 외운다","글로 써서 봉납한다 "],"correctAnswer":2,"explanation":"이설화답 삼설제창은 법사가 선창하면 대중이 후창하고 다시 함께 제창하여, 다섯 계를 저마다 세 번씩 거듭 새기는 방식이다. (제13강)"},{"id":"q_12","number":12,"question":"각 칠재에서 경전으로 법문을 들려드리는 대상으로 옳은 것은?","options":["상단의 부처님","중단의 신중","하단의 영령(부처님은 증명으로 모심)","도량 밖의 무주고혼 "],"correctAnswer":3,"explanation":"각 칠재의 독경에서 경전으로 법문을 들려드리는 대상은 하단의 영령이며, 부처님은 그 자리를 증명으로 모신다. (제10강)"},{"id":"q_13","number":13,"question":"칠칠재 광례(廣禮)의 대령에서, 대령소참(對靈小參) 뒤에 행하는 정식 관욕(灌浴)의 차례에 드는 것은?","options":["입실게ㆍ가지조욕편ㆍ출욕참성편","옹호게ㆍ청팔금강사보살","변식진언ㆍ시감로수진언","행보게ㆍ법성게 "],"correctAnswer":1,"explanation":"광례의 대령은 대령소참 뒤에 정식 관욕으로 이어지며, 인예향욕편ㆍ입실게ㆍ가지조욕편ㆍ출욕참성편ㆍ사문소참의 차례를 갖춘다. (제09강)"},{"id":"q_14","number":14,"question":"막재(사십구일재)를 여는 신중작법(神衆作法)에 대한 설명으로 옳은 것은?","options":["초재부터 육재까지 매 재일에 똑같이 행한다","막재에만 있는 장엄한 시작으로, 옹호게와 청팔금강사보살로 신중을 청한다","영령을 씻기는 관욕의 다른 이름이다","봉송의 마지막 절차이다 "],"correctAnswer":2,"explanation":"신중작법은 막재에만 있는 장엄한 시작으로, 옹호게와 청팔금강사보살로 신중을 청해 도량의 옹호를 부탁드린다. 초재~육재에는 없다. (제12강)"},{"id":"q_15","number":15,"question":"생일권공의식의 성격과 중심 차례로 옳은 것은?","options":["망자를 위한 천도재로, 시식이 중심이다","약례 생전예수재로, 명부의 시왕을 모셔 권공하고 금강경을 독송한다","보름마다 계를 새기는 포살이다","무주고혼을 위한 무차재이다 "],"correctAnswer":2,"explanation":"생일권공의식은 약례 생전예수재로, 명부의 시왕을 모셔 권공하고 금강경(또는 금강경찬)을 독송한다. (제14강)"},{"id":"q_16","number":16,"question":"생일권공의식의 시왕소청권공(十王召請勸供)에서, 정인(淨人)이 시왕전에서 모셔 와 상단에 모시는 것으로 옳은 것은?","options":["영가의 위패","시왕도위패(‘명부십대왕여권속’)","신중 104위의 번(幡)","칠성(七星)의 위목 "],"correctAnswer":2,"explanation":"생일권공의 시왕소청권공에서 정인이 시왕전에서 ‘시왕도위패[명부십대왕여권속]’를 모셔 와 상단에 모신다. 생일권공이 명부의 시왕께 미리 공덕을 닦는 예수재이기 때문이다.(제14강)"},{"id":"q_17","number":17,"question":"영산재의 본질에 대한 의례학의 분석으로 옳은 것은?","options":["제불보살께 올리는 공양의식이 본질이다","공양이 아니라 법화경을 독송하는 천도(薦度)의 법석이 본질이다","물과 뭍의 무주고혼을 위한 무차재이다","살아서 미리 닦는 자행(自行)의 재이다 "],"correctAnswer":2,"explanation":"영산재의 본질은 제불보살께 올리는 공양이 아니라, 법화경을 독송하여 죽은 이와 산 이를 함께 이끄는 천도의 법석이다. ‘공양의식’으로만 풀면 절반만 전한 셈이다. (제15강)"},{"id":"q_18","number":18,"question":"불학의범 불전권공의의 거불(擧佛)에서, 보통 노사나불을 드는 보신불(報身佛)의 자리에 본 의범이 바꾸어 부르는 분으로 옳은 것은?","options":["노사나불(盧舍那佛)","아미타불(阿彌陀佛)","비로자나불(毘盧遮那佛)","석가모니불(釋迦牟尼佛) "],"correctAnswer":2,"explanation":"본 의범의 거불은 “청정법신 비로자나불ㆍ원만보신 아미타불ㆍ천백억화신 석가모니불”로 삼신을 든다. 보통 삼신 거불의 보신은 노사나불인데, 본 의범은 사십팔원을 닦아 성불하신 아미타불을 보신으로 바꾸어 부르는 것이다. (제06강)"},{"id":"q_19","number":19,"question":"한국불교 재회의 삼단(三壇)에서 ‘단(壇)’이 비롯한 범어와 그 뜻으로 옳은 것은?","options":["다나(dāna), 보시(布施)","만다라(maṇḍala), 도량","사마디(samādhi), 선정","수트라(sūtra), 경전 "],"correctAnswer":1,"explanation":"단(壇)은 범어 ‘다나(dāna)’, 곧 보시(布施)에서 비롯한 말로 재시ㆍ무외시ㆍ법시의 삼단육도와 이어진다. (제15강)"},{"id":"q_20","number":20,"question":"신중단권공의 끝에 반야심경을 올리는 뜻에 대한 불학의범 협주의 풀이로 옳은 것은?","options":["혼령의 극락왕생을 비는 것이다","의례를 마친 뒤 본래 있던 곳으로 돌아가시기를 청하는 것이다","도량을 결계하여 마구니를 막는 것이다","부처님께 공양을 올리는 것이다"],"correctAnswer":2,"explanation":"신중단권공 끝의 반야심경은 의례를 마친 뒤 본래 있던 곳으로 돌아가시기를 청하는 뜻이며, 그래서 밖을 향해 올린다. (제07강)"}]$seed$::jsonb);
INSERT INTO lms_private.course_exams(course_id,questions)
SELECT id, (SELECT questions FROM lms_private.default_exam WHERE singleton=true) FROM public.courses WHERE NOT EXISTS(SELECT 1 FROM lms_private.legacy_exam_text legacy WHERE legacy.course_id=courses.id) ON CONFLICT(course_id) DO NOTHING;

-- Strict legacy parser: a missing answer never silently becomes option 1.
CREATE OR REPLACE FUNCTION lms_private.parse_legacy_exam(raw_text text) RETURNS jsonb LANGUAGE plpgsql SET search_path=lms_private,pg_temp AS $$
DECLARE line text; hit text[]; questions jsonb:='[]'; answers jsonb:='{}'; current_q jsonb; opts jsonb; answer_mode boolean:=false; answer_no text; answer_choice integer; explanation text:=''; q jsonb; result_value jsonb:='[]';
BEGIN
 FOREACH line IN ARRAY string_to_array(replace(raw_text,E'\r',''),E'\n') LOOP
  hit:=regexp_match(line,'^\s*([0-9]+)\.\s*([①-⑤1-5])\s*[—–-]\s*(.*)$');
  IF hit IS NOT NULL THEN
   IF NOT answer_mode AND current_q IS NOT NULL THEN questions:=questions||jsonb_build_array(current_q||jsonb_build_object('options',opts)); current_q:=NULL; END IF;
   answer_mode:=true;
   IF answer_no IS NOT NULL THEN answers:=answers||jsonb_build_object(answer_no,jsonb_build_object('correctAnswer',answer_choice,'explanation',trim(explanation))); END IF;
   answer_no:=hit[1]; answer_choice:=CASE WHEN strpos('①②③④⑤',hit[2])>0 THEN strpos('①②③④⑤',hit[2]) ELSE hit[2]::integer END; explanation:=hit[3];
   CONTINUE;
  END IF;
  IF answer_mode THEN explanation:=explanation||' '||trim(line); CONTINUE; END IF;
  hit:=regexp_match(line,'^\s*([0-9]+)\.\s+(.*)$');
  IF hit IS NOT NULL THEN
   IF current_q IS NOT NULL THEN questions:=questions||jsonb_build_array(current_q||jsonb_build_object('options',opts)); END IF;
   current_q:=jsonb_build_object('id','q_'||hit[1],'number',hit[1]::integer,'question',trim(hit[2])); opts:='[]'; CONTINUE;
  END IF;
  hit:=regexp_match(line,'^\s*(?:[①-⑤]|\([0-9]+\)|[0-9]+\))\s*(.*)$');
  IF current_q IS NOT NULL THEN
   IF hit IS NOT NULL THEN opts:=opts||jsonb_build_array(trim(hit[1]));
   ELSIF trim(line)<>'' THEN
    IF jsonb_array_length(opts)=0 THEN current_q:=jsonb_set(current_q,'{question}',to_jsonb((current_q->>'question')||' '||trim(line)));
    ELSE opts:=jsonb_set(opts,ARRAY[(jsonb_array_length(opts)-1)::text],to_jsonb((opts->>(jsonb_array_length(opts)-1))||' '||trim(line))); END IF;
   END IF;
  END IF;
 END LOOP;
 IF answer_no IS NOT NULL THEN answers:=answers||jsonb_build_object(answer_no,jsonb_build_object('correctAnswer',answer_choice,'explanation',trim(explanation))); END IF;
 IF jsonb_array_length(questions)=0 OR NOT answer_mode THEN RETURN NULL; END IF;
 FOR q IN SELECT value FROM jsonb_array_elements(questions) LOOP
  IF NOT answers ? (q->>'number') OR jsonb_array_length(q->'options')<2 OR (answers->(q->>'number')->>'correctAnswer')::integer>jsonb_array_length(q->'options') THEN RETURN NULL; END IF;
  result_value:=result_value||jsonb_build_array(q||(answers->(q->>'number')));
 END LOOP;
 RETURN result_value;
END $$;
REVOKE ALL ON FUNCTION lms_private.parse_legacy_exam(text) FROM PUBLIC,anon,authenticated;
INSERT INTO lms_private.course_exams(course_id,questions)
SELECT course_id,lms_private.parse_legacy_exam(raw_text) FROM lms_private.legacy_exam_text WHERE lms_private.parse_legacy_exam(raw_text) IS NOT NULL ON CONFLICT(course_id) DO NOTHING;
-- Keep row security explicit even when upgrading a schema whose bootstrap differed.
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lectures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qa_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qa_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_attempts ENABLE ROW LEVEL SECURITY;
-- Private data is accessed through owner-executed functions and the server role.
ALTER TABLE lms_private.course_exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE lms_private.default_exam ENABLE ROW LEVEL SECURITY;
ALTER TABLE lms_private.legacy_exam_text ENABLE ROW LEVEL SECURITY;
ALTER TABLE lms_private.exam_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE lms_private.playback_clocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE lms_private.auth_rate_limits ENABLE ROW LEVEL SECURITY;
COMMIT;
