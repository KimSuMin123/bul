-- 202609280001_course_complete_80.sql
-- A course now counts as complete once every lecture has reached 80% progress
-- (previously 100% and completed=true). lms_course_complete gates exam start,
-- exam submission, certificate issue and enrollment completion, so all of them
-- move to 80% together. Keep in sync with COURSE_COMPLETE_PROGRESS in src/config/sitePolicy.js.

CREATE OR REPLACE FUNCTION public.lms_course_complete(p_user_id text,p_course_id text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT EXISTS(SELECT 1 FROM public.lectures WHERE course_id=p_course_id OR p_course_id='bundle-all') AND NOT EXISTS(SELECT 1 FROM public.lectures l WHERE (l.course_id=p_course_id OR p_course_id='bundle-all') AND NOT EXISTS(SELECT 1 FROM public.progress p WHERE p.user_id=p_user_id AND p.lecture_id=l.id AND p.course_id=l.course_id AND (p.completed OR p.progress_rate>=80)));
$$;
REVOKE ALL ON FUNCTION public.lms_course_complete(text,text) FROM PUBLIC,anon,authenticated;
