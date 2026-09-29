-- 수납 승인 시 수강 시작일·만료일을 한국 날짜로 계산한다. CURRENT_DATE는 서버(UTC) 기준이라 한국 0~9시 승인 시 만료일이 하루 짧아졌다.
-- process_course_payment 본문의 CURRENT_DATE 두 곳만 한국 날짜로 바꾼 동일 함수(매개변수 기본값은 그대로, 화면은 한국 날짜를 넘긴다).
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
 expire_date:=(now() AT TIME ZONE 'Asia/Seoul')::date+greatest(coalesce(period_days,90),1);
 INSERT INTO public.enrollments(id,user_id,course_id,status,enrolled_at,paid_at,expire_at) VALUES('enr_'||gen_random_uuid()::text,p_user_id,p_course_id,'active',(now() AT TIME ZONE 'Asia/Seoul')::date,p_paid_at,expire_date) ON CONFLICT(user_id,course_id) DO UPDATE SET status='active',paid_at=excluded.paid_at,expire_at=excluded.expire_at RETURNING * INTO enr;
 INSERT INTO public.payments(id,user_id,course_id,paid_at,manager,amount,method_memo,request_id) VALUES('pay_'||gen_random_uuid()::text,p_user_id,p_course_id,p_paid_at,(SELECT name FROM public.users WHERE id=public.lms_user_id()),p_amount,coalesce(trim(p_method_memo),''),p_request_id) RETURNING * INTO pay;
 result_value:=jsonb_build_object('success',true,'paymentId',pay.id,'enrollmentId',enr.id,'userId',p_user_id,'courseId',p_course_id,'status','active','expireAt',expire_date);
 UPDATE public.payments SET result=result_value WHERE id=pay.id;
 RETURN result_value;
END $$;
