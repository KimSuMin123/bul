-- Isolated explicit operator test. Never sends anything or creates an outbox job.
BEGIN;

-- Keep normal delivery isolated from all operator-test jobs, including retries.
CREATE OR REPLACE FUNCTION public.lms_claim_sms(p_limit integer DEFAULT 10)
RETURNS SETOF lms_private.sms_outbox LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,lms_private,pg_temp AS $$
BEGIN
 WITH expired AS (
  UPDATE lms_private.sms_outbox SET status='uncertain',last_code='lease_expired',updated_at=now()
  WHERE status='processing' AND lease_until<now() AND left(event_key,14)<>'operator_test:' RETURNING *
 ) INSERT INTO lms_private.sms_attempts(outbox_id,attempt,status,code)
 SELECT id,attempts,'uncertain','lease_expired' FROM expired;
 RETURN QUERY WITH due AS (
  SELECT id FROM lms_private.sms_outbox
  WHERE status IN ('pending','retry') AND next_attempt_at<=now() AND attempts<5
   AND left(event_key,14)<>'operator_test:'
  ORDER BY created_at,id FOR UPDATE SKIP LOCKED
  LIMIT greatest(1,least(coalesce(p_limit,10),50))
 ) UPDATE lms_private.sms_outbox o
 SET status='processing',attempts=attempts+1,lease_token=gen_random_uuid(),
     lease_until=now()+interval '5 minutes',updated_at=now()
 FROM due WHERE o.id=due.id RETURNING o.*;
END $$;

CREATE FUNCTION public.lms_claim_sms_test(p_id uuid,p_phone text)
RETURNS SETOF lms_private.sms_outbox LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,lms_private,pg_temp AS $$
BEGIN
 -- Recipient was explicitly authorized for this operator test; not caller-selectable.
 IF p_id IS NULL OR p_phone IS DISTINCT FROM '01080287565' THEN
  RAISE EXCEPTION 'invalid operator test target' USING ERRCODE='22023';
 END IF;
 WITH expired AS (
  UPDATE lms_private.sms_outbox SET status='uncertain',last_code='lease_expired',updated_at=now()
  WHERE id=p_id AND event_key='operator_test:'||p_id::text
   AND kind='enrollment_student' AND payload->>'phone'=p_phone
   AND status='processing' AND lease_until<now() RETURNING *
 ) INSERT INTO lms_private.sms_attempts(outbox_id,attempt,status,code)
 SELECT id,attempts,'uncertain','lease_expired' FROM expired;
 RETURN QUERY WITH target AS (
  SELECT id FROM lms_private.sms_outbox
  WHERE id=p_id AND event_key='operator_test:'||p_id::text
   AND kind='enrollment_student' AND payload->>'phone'=p_phone
   AND status IN ('pending','retry') AND next_attempt_at<=now() AND attempts<5
  FOR UPDATE SKIP LOCKED
 ) UPDATE lms_private.sms_outbox o
 SET status='processing',attempts=attempts+1,lease_token=gen_random_uuid(),
     lease_until=now()+interval '5 minutes',updated_at=now()
 FROM target WHERE o.id=target.id RETURNING o.*;
END $$;

REVOKE ALL ON FUNCTION public.lms_claim_sms(integer),public.lms_claim_sms_test(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.lms_claim_sms(integer),public.lms_claim_sms_test(uuid,text) TO service_role;
COMMIT;
