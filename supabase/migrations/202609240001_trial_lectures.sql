-- 202609240001_trial_lectures.sql
-- Allow students with registered course applications (pending/applied/active/completed)
-- to watch the first 3 lectures (order_index <= 3) for free as a trial preview,
-- while strictly enforcing sequential watch progress (>=80%) between trial lectures.
-- Course completion, qualification examinations and certificate issuance remain
-- strictly guarded by 100% completion and paid/active status.

CREATE OR REPLACE FUNCTION public.lms_can_watch_lecture(p_lecture_id text) 
RETURNS boolean 
LANGUAGE sql 
STABLE 
SECURITY DEFINER 
SET search_path=pg_catalog,public,pg_temp AS $$
 SELECT coalesce((
   SELECT public.lms_is_admin() OR (
     (
       public.lms_can_study(l.course_id)
       OR (
         -- Trial preview for enrolled/applied users for the first 3 lectures
         (coalesce(nullif(regexp_replace(l.order_index::text, '[^0-9]', '', 'g'), '')::int, 0) <= 3) AND EXISTS(
           SELECT 1 FROM public.enrollments e 
           WHERE e.user_id = public.lms_user_id() 
             AND e.course_id IN (l.course_id, 'bundle-all')
         )
       )
     ) 
     AND (
       NOT c.sequential_unlock OR NOT EXISTS(
         SELECT 1 FROM (
           SELECT prior.id 
           FROM public.lectures prior 
           WHERE prior.course_id = l.course_id 
             AND (prior.order_index, prior.id COLLATE "C") < (l.order_index, l.id COLLATE "C") 
           ORDER BY prior.order_index DESC, prior.id COLLATE "C" DESC 
           LIMIT 1
         ) prev
         WHERE NOT EXISTS(
           SELECT 1 FROM public.progress p 
           WHERE p.user_id = public.lms_user_id() 
             AND p.lecture_id = prev.id 
             AND p.progress_rate >= 80
         )
       )
     )
   )
   FROM public.lectures l 
   JOIN public.courses c ON c.id = l.course_id 
   WHERE l.id = p_lecture_id
 ), false)
$$;

REVOKE ALL ON FUNCTION public.lms_can_watch_lecture(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.lms_can_watch_lecture(text) TO authenticated;

-- Update internal lecture progress implementation to accept trial lecture viewers
CREATE OR REPLACE FUNCTION public.lms_update_lecture_progress_internal(p_lecture_id text, p_position numeric) 
RETURNS jsonb 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path=public,lms_private,pg_temp AS $$
DECLARE 
  uid text := public.lms_user_id(); 
  lecture public.lectures; 
  clock lms_private.playback_clocks; 
  saved public.progress; 
  observed timestamptz := clock_timestamp(); 
  elapsed numeric; 
  credit numeric; 
  position_value numeric; 
  rate numeric; 
  delta numeric; 
  watched nummultirange; 
  tolerance numeric; 
  legacy_credit numeric;
BEGIN
  SELECT * INTO lecture FROM public.lectures WHERE id = p_lecture_id;
  IF uid IS NULL OR NOT FOUND OR NOT public.lms_can_watch_lecture(p_lecture_id) THEN 
    RAISE EXCEPTION 'Active enrollment or trial access required' USING ERRCODE='42501'; 
  END IF;
  IF p_position IS NULL OR p_position < 0 OR p_position::text IN ('NaN','Infinity','-Infinity') OR lecture.duration_seconds IS NULL OR lecture.duration_seconds <= 0 THEN 
    RAISE EXCEPTION 'Invalid playback position'; 
  END IF;

  position_value := least(p_position, lecture.duration_seconds);
  legacy_credit := greatest(0, least(lecture.duration_seconds, coalesce((SELECT watched_seconds FROM public.progress WHERE user_id = uid AND lecture_id = p_lecture_id), 0)));
  
  INSERT INTO lms_private.playback_clocks(user_id, lecture_id, last_seen, last_position, credited_seconds, watched_ranges) 
  VALUES(uid, p_lecture_id, observed, position_value, legacy_credit, nummultirange(numrange(0, legacy_credit, '[)'))) 
  ON CONFLICT DO NOTHING;
  
  SELECT * INTO clock FROM lms_private.playback_clocks WHERE user_id = uid AND lecture_id = p_lecture_id FOR UPDATE;
  
  elapsed := greatest(0, least(15, extract(epoch FROM observed - clock.last_seen)));
  watched := clock.watched_ranges;
  delta := position_value - clock.last_position;
  
  IF delta > 0 AND elapsed > 0 AND delta <= elapsed * 1.5 + 0.25 THEN
    watched := watched + nummultirange(numrange(clock.last_position, position_value, '[)'));
  END IF;
  
  SELECT coalesce(sum(upper(segment) - lower(segment)), 0) INTO credit FROM unnest(watched) AS segment;
  credit := least(lecture.duration_seconds, greatest(credit, clock.credited_seconds));
  tolerance := least(1, lecture.duration_seconds * 0.01);
  
  IF position_value >= lecture.duration_seconds - tolerance AND credit >= lecture.duration_seconds - tolerance THEN 
    credit := lecture.duration_seconds; 
  END IF;
  
  rate := least(100, floor(10000 * credit / lecture.duration_seconds) / 100);
  
  UPDATE lms_private.playback_clocks 
  SET last_seen = observed, last_position = position_value, credited_seconds = credit, watched_ranges = watched 
  WHERE user_id = uid AND lecture_id = p_lecture_id;
  
  INSERT INTO public.progress(id, user_id, course_id, lecture_id, last_played_seconds, watched_seconds, progress_rate, completed, updated_at) 
  VALUES('prog_' || gen_random_uuid()::text, uid, lecture.course_id, p_lecture_id, floor(position_value), floor(credit), rate, credit >= lecture.duration_seconds, observed) 
  ON CONFLICT(user_id, lecture_id) DO UPDATE 
  SET course_id = excluded.course_id, 
      last_played_seconds = excluded.last_played_seconds, 
      watched_seconds = excluded.watched_seconds, 
      progress_rate = excluded.progress_rate, 
      completed = excluded.completed, 
      updated_at = excluded.updated_at 
  RETURNING * INTO saved;
  
  -- Only synchronize completion if the user has full study privileges
  IF saved.completed AND public.lms_can_study(lecture.course_id) THEN
    PERFORM public.lms_sync_completion(uid, lecture.course_id);
    IF lecture.course_id <> 'bundle-all' THEN 
      PERFORM public.lms_sync_completion(uid, 'bundle-all'); 
    END IF;
  END IF;
  
  RETURN to_jsonb(saved);
END $$;

REVOKE ALL ON FUNCTION public.lms_update_lecture_progress_internal(text, numeric) FROM PUBLIC, anon, authenticated;

-- Ensure progress RLS policies permit trial preview progress writes
DROP POLICY IF EXISTS progress_write ON public.progress;
CREATE POLICY progress_write ON public.progress FOR INSERT TO authenticated 
WITH CHECK(
  user_id = public.lms_user_id() 
  AND (public.lms_can_study(course_id) OR public.lms_can_watch_lecture(lecture_id))
  AND EXISTS(
    SELECT 1 FROM public.lectures l 
    WHERE l.id = lecture_id 
      AND l.course_id = progress.course_id 
      AND last_played_seconds BETWEEN 0 AND l.duration_seconds 
      AND watched_seconds BETWEEN 0 AND l.duration_seconds 
      AND progress_rate BETWEEN 0 AND 100 
      AND (NOT completed OR progress_rate >= 99)
  )
);

DROP POLICY IF EXISTS progress_update ON public.progress;
CREATE POLICY progress_update ON public.progress FOR UPDATE TO authenticated 
USING(user_id = public.lms_user_id()) 
WITH CHECK(
  user_id = public.lms_user_id() 
  AND (public.lms_can_study(course_id) OR public.lms_can_watch_lecture(lecture_id))
  AND EXISTS(
    SELECT 1 FROM public.lectures l 
    WHERE l.id = lecture_id 
      AND l.course_id = progress.course_id 
      AND last_played_seconds BETWEEN 0 AND l.duration_seconds 
      AND watched_seconds BETWEEN 0 AND l.duration_seconds 
      AND progress_rate BETWEEN 0 AND 100 
      AND (NOT completed OR progress_rate >= 99)
  )
);
