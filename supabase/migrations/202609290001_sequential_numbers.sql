-- 202609290001_sequential_numbers.sql
-- Human-readable, sequential numbers instead of random UUIDs.
--   member_no : BUDDHA-<year>-<5 digits>   admin = 00000, members from 00001 (per year)
--   cert_no   : CERT-<code>-<year>-<4 digits>   code LAW = 불교의례법사, EXP = 불교의례해설사 (per code, per year)
-- The numbers are assigned inside the database, so every path that inserts a user
-- (lms-auth register/admin-register, legacy RPCs) gets the same format without redeploying functions.

CREATE TABLE IF NOT EXISTS lms_private.number_counters(
  key text PRIMARY KEY,
  last_value integer NOT NULL CHECK (last_value >= 0)
);
REVOKE ALL ON lms_private.number_counters FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION lms_private.next_number(p_key text) RETURNS integer LANGUAGE sql SET search_path=pg_catalog,pg_temp AS $$
  INSERT INTO lms_private.number_counters AS c(key, last_value) VALUES (p_key, 1)
  ON CONFLICT (key) DO UPDATE SET last_value = c.last_value + 1
  RETURNING last_value;
$$;
REVOKE ALL ON FUNCTION lms_private.next_number(text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION lms_private.kst_year() RETURNS text LANGUAGE sql STABLE SET search_path=pg_catalog,pg_temp AS $$
  SELECT to_char(now() AT TIME ZONE 'Asia/Seoul', 'YYYY');
$$;

CREATE OR REPLACE FUNCTION lms_private.cert_code(p_course_id text) RETURNS text LANGUAGE sql IMMUTABLE SET search_path=pg_catalog,pg_temp AS $$
  SELECT CASE p_course_id
    WHEN 'course_rit_02' THEN 'LAW'
    WHEN 'course_rit_exp_02' THEN 'EXP'
    ELSE upper(left(regexp_replace(coalesce(p_course_id, 'GEN'), '[^A-Za-z0-9]', '', 'g'), 6))
  END;
$$;

-- Member number: always assigned by the database on insert (any value sent by a client is replaced).
CREATE OR REPLACE FUNCTION lms_private.assign_member_no() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE y text := lms_private.kst_year(); admin_no text;
BEGIN
  admin_no := 'BUDDHA-' || y || '-00000';
  IF NEW.role = 'admin' AND NOT EXISTS (SELECT 1 FROM public.users WHERE member_no = admin_no) THEN
    NEW.member_no := admin_no;
  ELSE
    NEW.member_no := 'BUDDHA-' || y || '-' || lpad(lms_private.next_number('member:' || y)::text, 5, '0');
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS users_assign_member_no ON public.users;
CREATE TRIGGER users_assign_member_no BEFORE INSERT ON public.users
  FOR EACH ROW EXECUTE FUNCTION lms_private.assign_member_no();

-- Certificate number: taken only when a certificate is really created (no number is burned on a repeat claim).
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
          uid,p_course_id,profile.member_no,profile.name,nullif(trim(profile.dharma_name),''),profile.birth_date,course.title,CURRENT_DATE::text,CURRENT_DATE,'valid')
   RETURNING * INTO cert;
  END IF;
 END IF;
 PERFORM public.lms_sync_completion(uid,p_course_id);
 RETURN to_jsonb(cert);
END $$;

-- Existing data -------------------------------------------------------------
-- Members: the admin becomes 00000; members already on the BUDDHA-2026-NNNNN format keep their number;
-- members with a random number get the next numbers in sign-up order.
UPDATE public.users SET member_no = 'BUDDHA-2026-00000'
WHERE id = (SELECT id FROM public.users WHERE role = 'admin' ORDER BY created_at, id LIMIT 1);

WITH numbered AS (
  SELECT u.id, (SELECT coalesce(max(substring(member_no from '^BUDDHA-2026-(\d{5})$')::int), 0)
                FROM public.users WHERE member_no ~ '^BUDDHA-2026-\d{5}$' AND role <> 'admin')
               + row_number() OVER (ORDER BY u.created_at, u.id) AS n
  FROM public.users u
  WHERE u.member_no !~ '^BUDDHA-\d{4}-\d{5}$'
)
UPDATE public.users u SET member_no = 'BUDDHA-2026-' || lpad(numbered.n::text, 5, '0')
FROM numbered WHERE u.id = numbered.id;

-- Certificates: renumber the random ones per course code in issue order, and copy the current member number.
WITH ordered AS (
  SELECT c.cert_no AS old_no,
         'CERT-' || lms_private.cert_code(c.course_id) || '-' || to_char(c.issued_at, 'YYYY') || '-' ||
         lpad(row_number() OVER (PARTITION BY lms_private.cert_code(c.course_id), to_char(c.issued_at, 'YYYY') ORDER BY c.issued_at, c.cert_no)::text, 4, '0') AS new_no
  FROM public.certificates c
  WHERE c.cert_no !~ '^CERT-[A-Z0-9]+-\d{4}-\d{4}$'
)
UPDATE public.certificates c SET cert_no = ordered.new_no
FROM ordered WHERE c.cert_no = ordered.old_no;

UPDATE public.certificates c SET member_no = u.member_no
FROM public.users u WHERE u.id = c.user_id AND c.member_no IS DISTINCT FROM u.member_no;

-- Counters continue after the highest number now in use.
INSERT INTO lms_private.number_counters(key, last_value)
SELECT 'member:2026', coalesce(max(substring(member_no from '^BUDDHA-2026-(\d{5})$')::int), 0)
FROM public.users WHERE member_no ~ '^BUDDHA-2026-\d{5}$'
ON CONFLICT (key) DO UPDATE SET last_value = GREATEST(lms_private.number_counters.last_value, excluded.last_value);

INSERT INTO lms_private.number_counters(key, last_value)
SELECT 'cert:' || m[1] || ':' || m[2], max(m[3]::int)
FROM public.certificates, regexp_match(cert_no, '^CERT-([A-Z0-9]+)-(\d{4})-(\d{4})$') AS m
WHERE m IS NOT NULL
GROUP BY m[1], m[2]
ON CONFLICT (key) DO UPDATE SET last_value = GREATEST(lms_private.number_counters.last_value, excluded.last_value);
