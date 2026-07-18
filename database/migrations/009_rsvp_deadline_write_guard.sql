-- SPS Corner v5.12.0
-- Enforce the audited RSVP deadline write path at the database boundary.

BEGIN;

CREATE OR REPLACE FUNCTION public.guard_program_rsvp_deadline_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NEW.rsvp_deadline IS DISTINCT FROM OLD.rsvp_deadline
     AND current_setting('sps.allow_rsvp_deadline_update', true) IS DISTINCT FROM 'on' THEN
    RAISE EXCEPTION 'RSVP deadline must be changed through the audited deadline operation'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_program_rsvp_deadline_update()
  FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS trg_guard_program_rsvp_deadline_update
  ON public.union_programs;
CREATE TRIGGER trg_guard_program_rsvp_deadline_update
  BEFORE UPDATE OF rsvp_deadline ON public.union_programs
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_program_rsvp_deadline_update();

CREATE OR REPLACE FUNCTION public.update_program_rsvp_deadline(
  p_program_id uuid,
  p_new_deadline timestamptz,
  p_expected_deadline timestamptz,
  p_reason text,
  p_actor_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_program public.union_programs%ROWTYPE;
  v_registration_count integer;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = p_actor_id AND role IN ('admin', 'superadmin')
  ) THEN
    RAISE EXCEPTION 'Unauthorized: admin role required';
  END IF;

  IF p_new_deadline IS NULL OR p_new_deadline <= now() THEN
    RAISE EXCEPTION 'RSVP deadline must be a valid future time';
  END IF;
  IF char_length(btrim(COALESCE(p_reason, ''))) < 3 THEN
    RAISE EXCEPTION 'A change reason of at least 3 characters is required';
  END IF;

  SELECT * INTO v_program
  FROM public.union_programs
  WHERE id = p_program_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Program not found';
  END IF;
  IF v_program.program_type <> 'gathering' THEN
    RAISE EXCEPTION 'RSVP deadlines are only supported for gathering programs';
  END IF;
  IF v_program.publication_status = 'closed' OR NOT v_program.is_active THEN
    RAISE EXCEPTION 'A closed or inactive program cannot be reopened from the deadline editor';
  END IF;

  -- Retry-safe: if the first request committed but its response was lost, the
  -- same requested target is already satisfied and must not fail concurrency.
  IF v_program.rsvp_deadline IS NOT DISTINCT FROM p_new_deadline THEN
    RETURN jsonb_build_object(
      'success', true,
      'idempotent', true,
      'data', jsonb_build_object(
        'id', v_program.id,
        'rsvp_deadline', v_program.rsvp_deadline,
        'config_version', v_program.config_version
      )
    );
  END IF;

  IF p_expected_deadline IS DISTINCT FROM v_program.rsvp_deadline THEN
    RAISE EXCEPTION 'RSVP deadline changed by another administrator. Reload and try again'
      USING ERRCODE = '40001';
  END IF;
  IF v_program.start_date IS NOT NULL
     AND (p_new_deadline AT TIME ZONE 'Asia/Makassar')::date > v_program.start_date THEN
    RAISE EXCEPTION 'RSVP deadline cannot be after the event date';
  END IF;

  SELECT count(*)::integer INTO v_registration_count
  FROM public.program_registrations
  WHERE program_id = p_program_id;

  PERFORM pg_catalog.set_config('sps.allow_rsvp_deadline_update', 'on', true);
  UPDATE public.union_programs
  SET rsvp_deadline = p_new_deadline,
      updated_at = now()
  WHERE id = p_program_id;

  INSERT INTO public.program_rsvp_deadline_audit (
    program_id,
    previous_deadline,
    new_deadline,
    reason,
    changed_by,
    registration_count,
    config_version
  ) VALUES (
    p_program_id,
    v_program.rsvp_deadline,
    p_new_deadline,
    left(btrim(p_reason), 500),
    p_actor_id,
    v_registration_count,
    v_program.config_version
  );

  RETURN jsonb_build_object(
    'success', true,
    'idempotent', false,
    'data', jsonb_build_object(
      'id', v_program.id,
      'rsvp_deadline', p_new_deadline,
      'previous_deadline', v_program.rsvp_deadline,
      'config_version', v_program.config_version,
      'registration_count', v_registration_count
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.update_program_rsvp_deadline(uuid, timestamptz, timestamptz, text, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_program_rsvp_deadline(uuid, timestamptz, timestamptz, text, uuid)
  TO service_role;

COMMIT;
