-- 비밀번호 셀프 재설정(아이디·이름·생년월일 확인) 계정별 실패 잠금: 5회 실패 시 30분.
-- lms-auth Edge Function(service_role)만 호출한다.
CREATE TABLE IF NOT EXISTS lms_private.self_reset_failures(
  user_id text PRIMARY KEY,
  failures integer NOT NULL DEFAULT 0,
  locked_until timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE lms_private.self_reset_failures ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.lms_self_reset_locked(p_user_id text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,lms_private,pg_temp AS $$
  SELECT coalesce((SELECT locked_until > now() FROM lms_private.self_reset_failures WHERE user_id = p_user_id), false)
$$;

CREATE OR REPLACE FUNCTION public.lms_self_reset_fail(p_user_id text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,lms_private,pg_temp AS $$
DECLARE v_failures integer;
BEGIN
  INSERT INTO lms_private.self_reset_failures(user_id, failures, updated_at) VALUES (p_user_id, 1, now())
  ON CONFLICT (user_id) DO UPDATE SET
    -- 잠금이 끝났거나 마지막 실패 후 30분이 지나면 다시 1회부터 센다
    failures = CASE WHEN self_reset_failures.locked_until IS NOT NULL OR self_reset_failures.updated_at < now() - interval '30 minutes'
                    THEN 1 ELSE self_reset_failures.failures + 1 END,
    locked_until = NULL,
    updated_at = now()
  RETURNING failures INTO v_failures;
  IF v_failures >= 5 THEN
    UPDATE lms_private.self_reset_failures SET locked_until = now() + interval '30 minutes' WHERE user_id = p_user_id;
    RETURN true;
  END IF;
  RETURN false;
END $$;

CREATE OR REPLACE FUNCTION public.lms_self_reset_clear(p_user_id text) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,lms_private,pg_temp AS $$
  DELETE FROM lms_private.self_reset_failures WHERE user_id = p_user_id
$$;

REVOKE ALL ON FUNCTION public.lms_self_reset_locked(text), public.lms_self_reset_fail(text), public.lms_self_reset_clear(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.lms_self_reset_locked(text), public.lms_self_reset_fail(text), public.lms_self_reset_clear(text) TO service_role;
