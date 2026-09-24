-- 202609240002_dharma_name.sql
-- Store the Buddhist dharma name (법명) separately from the legal name so the
-- certificate can print it as "성명 홍길동 (원행)". Optional for every member.

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS dharma_name varchar(50);
ALTER TABLE public.certificates ADD COLUMN IF NOT EXISTS dharma_name varchar(50);
GRANT SELECT(dharma_name) ON public.users TO authenticated;

CREATE OR REPLACE FUNCTION public.current_lms_user() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
 SELECT jsonb_build_object('id',id,'loginId',coalesce(login_id,id),'name',name,'dharmaName',dharma_name,'birthDate',birth_date,'phone',phone,'memberNo',member_no,'role',role,'createdAt',created_at,'privacyConsent',privacy_consent,'privacyConsentAt',privacy_consent_at,'privacyPolicyVersion',privacy_policy_version,'privacyConsentSource',privacy_consent_source) FROM public.users WHERE auth_user_id=auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.issue_course_certificate(p_course_id text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE uid text:=public.lms_user_id(); profile public.users; course public.courses; cert public.certificates;
BEGIN
 IF uid IS NULL OR NOT public.lms_can_study(p_course_id) OR NOT public.lms_course_complete(uid,p_course_id) OR NOT EXISTS(SELECT 1 FROM public.exam_attempts WHERE user_id=uid AND course_id=p_course_id AND passed=true) THEN RAISE EXCEPTION 'Course qualification not met' USING ERRCODE='42501'; END IF;
 SELECT * INTO profile FROM public.users WHERE id=uid;
 SELECT * INTO course FROM public.courses WHERE id=p_course_id;
 INSERT INTO public.certificates(cert_no,user_id,course_id,member_no,student_name,dharma_name,birth_date,course_title,period,issued_at,status) VALUES('CERT-'||gen_random_uuid()::text,uid,p_course_id,profile.member_no,profile.name,nullif(trim(profile.dharma_name),''),profile.birth_date,course.title,CURRENT_DATE::text,CURRENT_DATE,'valid') ON CONFLICT(user_id,course_id) DO NOTHING;
 SELECT * INTO cert FROM public.certificates WHERE user_id=uid AND course_id=p_course_id;
 PERFORM public.lms_sync_completion(uid,p_course_id);
 RETURN to_jsonb(cert);
END $$;
