-- 자격증 발급일을 한국 날짜로 기록한다. CURRENT_DATE는 서버(UTC) 기준이라 한국 0~9시에 발급하면 전날로 찍혔다.
-- issue_course_certificate의 CURRENT_DATE 두 곳만 (now() AT TIME ZONE 'Asia/Seoul')::date 로 바꾼 동일 함수.
CREATE OR REPLACE FUNCTION public.issue_course_certificate(p_course_id text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE uid text:=public.lms_user_id(); profile public.users; course public.courses; cert public.certificates; y text; code text;
BEGIN
 IF uid IS NULL OR NOT public.lms_can_study(p_course_id) OR NOT public.lms_course_complete(uid,p_course_id) OR NOT EXISTS(SELECT 1 FROM public.exam_attempts WHERE user_id=uid AND course_id=p_course_id AND passed=true) THEN RAISE EXCEPTION 'Course qualification not met' USING ERRCODE='42501'; END IF;
 SELECT * INTO cert FROM public.certificates WHERE user_id=uid AND course_id=p_course_id;
 IF NOT FOUND THEN
  SELECT * INTO profile FROM public.users WHERE id=uid;
  SELECT * INTO course FROM public.courses WHERE id=p_course_id;
  -- Serialise issuing for this learner+course so two clicks cannot take two numbers.
  PERFORM pg_advisory_xact_lock(hashtext('cert:' || uid || ':' || p_course_id));
  SELECT * INTO cert FROM public.certificates WHERE user_id=uid AND course_id=p_course_id;
  IF NOT FOUND THEN
   y := lms_private.kst_year();
   code := lms_private.cert_code(p_course_id);
   INSERT INTO public.certificates(cert_no,user_id,course_id,member_no,student_name,dharma_name,birth_date,course_title,period,issued_at,status)
   VALUES('CERT-' || code || '-' || y || '-' || lpad(lms_private.next_number('cert:' || code || ':' || y)::text, 4, '0'),
          uid,p_course_id,profile.member_no,profile.name,nullif(trim(profile.dharma_name),''),profile.birth_date,course.title,((now() AT TIME ZONE 'Asia/Seoul')::date)::text,(now() AT TIME ZONE 'Asia/Seoul')::date,'valid')
   RETURNING * INTO cert;
  END IF;
 END IF;
 PERFORM public.lms_sync_completion(uid,p_course_id);
 RETURN to_jsonb(cert);
END $$;
