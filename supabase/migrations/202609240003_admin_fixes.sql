-- 202609240003_admin_fixes.sql
-- Fixes found in the 2026-09-24 production walkthrough:
-- 1. Donation receipts were only kept in browser memory because the table was never created remotely.
-- 2. Administrators could not delete courses (no DELETE grant). Courses that already carry
--    enrollment, payment or certificate records stay protected, because deleting them would
--    cascade away real ledger history.
-- 3. Students whose application is still awaiting payment may now ask questions on that course.

-- 1. Donation receipt ledger: one row per phone number, administrators only.
CREATE TABLE IF NOT EXISTS public.donation_receipts (
  id varchar(50) PRIMARY KEY,
  user_id varchar(50) REFERENCES public.users(id) ON DELETE SET NULL,
  name varchar(100) NOT NULL,
  phone varchar(20) NOT NULL UNIQUE,
  total_amount integer NOT NULL DEFAULT 0,
  last_issued_at date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  donation_count integer DEFAULT 1,
  history jsonb DEFAULT '[]'::jsonb
);
ALTER TABLE public.donation_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.donation_receipts FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.donation_receipts TO authenticated;
DROP POLICY IF EXISTS donation_receipts_admin ON public.donation_receipts;
CREATE POLICY donation_receipts_admin ON public.donation_receipts FOR ALL TO authenticated
  USING (public.lms_is_admin()) WITH CHECK (public.lms_is_admin());

-- 2. Course deletion for administrators, guarded against removing courses with history.
GRANT DELETE ON public.courses TO authenticated;
CREATE OR REPLACE FUNCTION lms_private.guard_course_delete() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.enrollments WHERE course_id = OLD.id)
     OR EXISTS (SELECT 1 FROM public.payments WHERE course_id = OLD.id)
     OR EXISTS (SELECT 1 FROM public.certificates WHERE course_id = OLD.id) THEN
    RAISE EXCEPTION '수강 신청·수납·수료 기록이 있는 코스는 삭제할 수 없습니다.' USING ERRCODE = 'P0001';
  END IF;
  RETURN OLD;
END $$;
DROP TRIGGER IF EXISTS courses_guard_delete ON public.courses;
CREATE TRIGGER courses_guard_delete BEFORE DELETE ON public.courses
  FOR EACH ROW EXECUTE FUNCTION lms_private.guard_course_delete();

-- 3. Any registered application (including awaiting payment) may read and ask course questions.
CREATE OR REPLACE FUNCTION public.lms_has_application(p_course_id text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT public.lms_can_study(p_course_id) OR EXISTS (
    SELECT 1 FROM public.enrollments
    WHERE user_id = public.lms_user_id() AND course_id IN (p_course_id, 'bundle-all')
  )
$$;
REVOKE ALL ON FUNCTION public.lms_has_application(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lms_has_application(text) TO authenticated;

DROP POLICY IF EXISTS qa_posts_read ON public.qa_posts;
CREATE POLICY qa_posts_read ON public.qa_posts FOR SELECT TO authenticated
  USING (public.lms_is_admin() OR author_id = public.lms_user_id()
         OR (NOT is_private AND public.lms_has_application(course_id)));
DROP POLICY IF EXISTS qa_posts_create ON public.qa_posts;
CREATE POLICY qa_posts_create ON public.qa_posts FOR INSERT TO authenticated
  WITH CHECK (author_id = public.lms_user_id() AND public.lms_has_application(course_id)
              AND EXISTS (SELECT 1 FROM public.lectures l WHERE l.id = lecture_id AND l.course_id = qa_posts.course_id));
