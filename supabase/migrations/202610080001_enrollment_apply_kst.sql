-- 수강 신청·재신청 정책의 '오늘'을 한국 날짜로 맞춘다. 화면은 신청일을 한국 날짜로 보내는데(202609300003 이후)
-- 정책은 CURRENT_DATE(서버 UTC)와 비교해 한국 0~9시 신청이 'new row violates row-level security policy'로 거절됐다.
DROP POLICY IF EXISTS enrollments_apply ON public.enrollments;
DROP POLICY IF EXISTS enrollments_reapply ON public.enrollments;
CREATE POLICY enrollments_apply ON public.enrollments FOR INSERT TO authenticated WITH CHECK(user_id=public.lms_user_id() AND status IN ('applied','pending') AND paid_at IS NULL AND enrolled_at=(now() AT TIME ZONE 'Asia/Seoul')::date);
CREATE POLICY enrollments_reapply ON public.enrollments FOR UPDATE TO authenticated USING(user_id=public.lms_user_id() AND (status IN ('applied','pending') OR expire_at<(now() AT TIME ZONE 'Asia/Seoul')::date)) WITH CHECK(user_id=public.lms_user_id() AND status IN ('applied','pending') AND paid_at IS NULL AND enrolled_at=(now() AT TIME ZONE 'Asia/Seoul')::date);
