BEGIN;
-- The existing CMS offers per-lecture thumbnails; persist that field as well.
ALTER TABLE public.lectures ADD COLUMN IF NOT EXISTS thumbnail text;
-- Course metadata and its private answer bank must succeed or fail together.
CREATE OR REPLACE FUNCTION public.save_course_record(p_course jsonb, p_questions jsonb DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE v_old jsonb; v_row public.courses; v_id text; v_questions jsonb;
BEGIN
  IF NOT public.lms_is_admin() THEN RAISE EXCEPTION 'administrator required' USING ERRCODE='42501'; END IF;
  v_id := trim(p_course->>'id');
  IF coalesce(v_id,'')='' OR length(v_id)>50 THEN RAISE EXCEPTION 'invalid course id'; END IF;
  SELECT to_jsonb(c) INTO v_old FROM public.courses c WHERE id=v_id FOR UPDATE;
  SELECT * INTO v_row FROM jsonb_populate_record(NULL::public.courses,
    '{"default_period_days":90,"sequential_unlock":true,"price":0}'::jsonb || coalesce(v_old,'{}'::jsonb) || (p_course-'raw_exam_text'));
  IF coalesce(trim(v_row.title),'')='' OR v_row.price IS NULL OR v_row.price<0 OR v_row.default_period_days IS NULL OR v_row.default_period_days<1 OR v_row.sequential_unlock IS NULL THEN RAISE EXCEPTION 'invalid course values'; END IF;
  INSERT INTO public.courses(id,title,subtitle,category,thumbnail,default_period_days,sequential_unlock,price,instructor,cert_type,cert_grade,cert_type_full,cert_reg_no,cert_reg_office)
  VALUES(v_id,v_row.title,v_row.subtitle,v_row.category,v_row.thumbnail,v_row.default_period_days,v_row.sequential_unlock,v_row.price,v_row.instructor,v_row.cert_type,v_row.cert_grade,v_row.cert_type_full,v_row.cert_reg_no,v_row.cert_reg_office)
  ON CONFLICT(id) DO UPDATE SET title=excluded.title,subtitle=excluded.subtitle,category=excluded.category,thumbnail=excluded.thumbnail,default_period_days=excluded.default_period_days,sequential_unlock=excluded.sequential_unlock,price=excluded.price,instructor=excluded.instructor,cert_type=excluded.cert_type,cert_grade=excluded.cert_grade,cert_type_full=excluded.cert_type_full,cert_reg_no=excluded.cert_reg_no,cert_reg_office=excluded.cert_reg_office
  RETURNING * INTO v_row;
  v_questions:=p_questions;
  IF v_old IS NULL AND v_questions IS NULL THEN SELECT questions INTO v_questions FROM lms_private.default_exam WHERE singleton=true; END IF;
  IF v_questions IS NOT NULL THEN PERFORM public.save_course_exam(v_id,v_questions); END IF;
  RETURN to_jsonb(v_row)-'raw_exam_text';
END $$;
REVOKE ALL ON FUNCTION public.save_course_record(jsonb,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_course_record(jsonb,jsonb) TO authenticated;
COMMIT;
