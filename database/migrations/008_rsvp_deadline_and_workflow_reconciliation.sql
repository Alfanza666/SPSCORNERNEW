-- SPS Corner v5.12.0
-- Audited RSVP deadline updates, future-only workflow reconciliation, and
-- hardened execution privileges for privileged gathering RPCs.

BEGIN;

-- --------------------------------------------------------------------------
-- 1. Append-only RSVP deadline audit
-- --------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.program_rsvp_deadline_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id uuid NOT NULL REFERENCES public.union_programs(id) ON DELETE CASCADE,
  previous_deadline timestamptz,
  new_deadline timestamptz NOT NULL,
  reason text NOT NULL CHECK (char_length(btrim(reason)) BETWEEN 3 AND 500),
  changed_by uuid NOT NULL,
  registration_count integer NOT NULL DEFAULT 0 CHECK (registration_count >= 0),
  config_version integer,
  changed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_program_rsvp_deadline_audit_program_changed
  ON public.program_rsvp_deadline_audit(program_id, changed_at DESC);

ALTER TABLE public.program_rsvp_deadline_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS program_rsvp_deadline_audit_admin_read
  ON public.program_rsvp_deadline_audit;
CREATE POLICY program_rsvp_deadline_audit_admin_read
  ON public.program_rsvp_deadline_audit
  FOR SELECT TO authenticated
  USING (public.is_program_workflow_admin());

GRANT SELECT ON public.program_rsvp_deadline_audit TO authenticated;
GRANT ALL ON public.program_rsvp_deadline_audit TO service_role;

-- --------------------------------------------------------------------------
-- 2. Deadline-only update. This deliberately does not touch config_version,
--    workflow snapshots, or eligibility snapshots.
-- --------------------------------------------------------------------------

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
  IF p_expected_deadline IS DISTINCT FROM v_program.rsvp_deadline THEN
    RAISE EXCEPTION 'RSVP deadline changed by another administrator. Reload and try again'
      USING ERRCODE = '40001';
  END IF;
  -- start_date is date-only. Interpret the comparison in the application's
  -- business timezone and allow a deadline on, but not after, the event date.
  IF v_program.start_date IS NOT NULL
     AND (p_new_deadline AT TIME ZONE 'Asia/Makassar')::date > v_program.start_date THEN
    RAISE EXCEPTION 'RSVP deadline cannot be after the event date';
  END IF;

  SELECT count(*)::integer INTO v_registration_count
  FROM public.program_registrations
  WHERE program_id = p_program_id;

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

COMMENT ON FUNCTION public.update_program_rsvp_deadline(uuid, timestamptz, timestamptz, text, uuid) IS
  'Atomically updates only the operational RSVP deadline with optimistic concurrency and an append-only audit record.';

REVOKE ALL ON FUNCTION public.update_program_rsvp_deadline(uuid, timestamptz, timestamptz, text, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_program_rsvp_deadline(uuid, timestamptz, timestamptz, text, uuid)
  TO service_role;

-- --------------------------------------------------------------------------
-- 3. Create a new active workflow version for future RSVP submissions only.
--    Existing registrations remain pinned to workflow_config_id/version.
-- --------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.reconcile_program_workflow_v2(
  p_program_id uuid,
  p_config jsonb,
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
  v_active public.program_workflow_configs%ROWTYPE;
  v_new_id uuid;
  v_new_version integer;
  v_registration_count integer;
  v_form_id uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = p_actor_id AND role IN ('admin', 'superadmin')
  ) THEN
    RAISE EXCEPTION 'Unauthorized: admin role required';
  END IF;
  IF jsonb_typeof(p_config) <> 'object' THEN
    RAISE EXCEPTION 'Workflow configuration must be a JSON object';
  END IF;
  IF char_length(btrim(COALESCE(p_reason, ''))) < 5 THEN
    RAISE EXCEPTION 'A reconciliation reason of at least 5 characters is required';
  END IF;

  BEGIN
    v_form_id := NULLIF(p_config->>'dynamic_form_id', '')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION 'Invalid dynamic form ID';
  END;

  SELECT * INTO v_program
  FROM public.union_programs
  WHERE id = p_program_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Program not found'; END IF;
  IF v_program.program_type <> 'gathering' THEN
    RAISE EXCEPTION 'Only gathering workflows can be reconciled';
  END IF;
  IF v_form_id IS NULL OR v_form_id IS DISTINCT FROM v_program.dynamic_form_id THEN
    RAISE EXCEPTION 'The workflow form does not match the linked program form';
  END IF;

  SELECT * INTO v_active
  FROM public.program_workflow_configs
  WHERE program_id = p_program_id AND is_active = true
  ORDER BY version DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Active workflow configuration not found'; END IF;

  IF v_active.dynamic_form_id IS NOT DISTINCT FROM v_form_id
     AND v_active.field_bindings = COALESCE(p_config->'field_bindings', '{}'::jsonb)
     AND v_active.pricing_rules = COALESCE(p_config->'pricing_rules', '{}'::jsonb)
     AND v_active.entitlement_rules = COALESCE(p_config->'entitlement_rules', '{}'::jsonb)
     AND v_active.payment_rules = COALESCE(p_config->'payment_rules', '{}'::jsonb) THEN
    RETURN jsonb_build_object(
      'success', true,
      'idempotent', true,
      'workflow_config_id', v_active.id,
      'workflow_version', v_active.version,
      'applies_to_future_registrations_only', true
    );
  END IF;

  SELECT count(*)::integer INTO v_registration_count
  FROM public.program_registrations
  WHERE program_id = p_program_id;

  SELECT COALESCE(max(version), 0) + 1 INTO v_new_version
  FROM public.program_workflow_configs
  WHERE program_id = p_program_id;

  UPDATE public.program_workflow_configs
  SET is_active = false,
      updated_by = p_actor_id
  WHERE program_id = p_program_id AND is_active = true;

  INSERT INTO public.program_workflow_configs (
    program_id,
    dynamic_form_id,
    version,
    is_active,
    field_bindings,
    pricing_rules,
    entitlement_rules,
    payment_rules,
    metadata,
    created_by,
    updated_by
  ) VALUES (
    p_program_id,
    v_form_id,
    v_new_version,
    true,
    COALESCE(p_config->'field_bindings', '{}'::jsonb),
    COALESCE(p_config->'pricing_rules', '{}'::jsonb),
    COALESCE(p_config->'entitlement_rules', '{}'::jsonb),
    COALESCE(p_config->'payment_rules', '{}'::jsonb),
    COALESCE(p_config->'metadata', '{}'::jsonb) || jsonb_build_object(
      'reconciled_at', now(),
      'reconciled_by', p_actor_id,
      'reconciliation_reason', left(btrim(p_reason), 500),
      'previous_workflow_config_id', v_active.id,
      'previous_workflow_version', v_active.version,
      'registration_count_at_reconciliation', v_registration_count,
      'applies_to_future_registrations_only', true
    ),
    p_actor_id,
    p_actor_id
  )
  RETURNING id INTO v_new_id;

  RETURN jsonb_build_object(
    'success', true,
    'idempotent', false,
    'workflow_config_id', v_new_id,
    'workflow_version', v_new_version,
    'previous_workflow_config_id', v_active.id,
    'previous_workflow_version', v_active.version,
    'existing_registration_count', v_registration_count,
    'applies_to_future_registrations_only', true
  );
END;
$$;

COMMENT ON FUNCTION public.reconcile_program_workflow_v2(uuid, jsonb, text, uuid) IS
  'Creates an audited active workflow version for future registrations without changing eligibility config_version or historical registration snapshots.';

REVOKE ALL ON FUNCTION public.reconcile_program_workflow_v2(uuid, jsonb, text, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reconcile_program_workflow_v2(uuid, jsonb, text, uuid)
  TO service_role;

-- --------------------------------------------------------------------------
-- 4. Harden privileged SECURITY DEFINER functions. Protected Express routes
--    call these through the service-role client after authenticating admins.
-- --------------------------------------------------------------------------

REVOKE ALL ON FUNCTION public.validate_gathering_publish(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.validate_gathering_publish(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.publish_gathering(uuid, integer, jsonb, jsonb, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.publish_gathering(uuid, integer, jsonb, jsonb, uuid)
  TO service_role;

REVOKE ALL ON FUNCTION public.link_program_form_v2(uuid, uuid, jsonb, jsonb, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.link_program_form_v2(uuid, uuid, jsonb, jsonb, uuid)
  TO service_role;

-- Remove permissive policies that may exist on older production revisions.
-- The owner/admin policies from migrations 006/007 remain in force.
DROP POLICY IF EXISTS user_read_eligibility ON public.program_eligibility;
DROP POLICY IF EXISTS program_registrations_insert ON public.program_registrations;

COMMIT;
