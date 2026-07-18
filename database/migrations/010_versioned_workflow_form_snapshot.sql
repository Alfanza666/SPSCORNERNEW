-- SPS Corner v5.12.0
-- Freeze the rendered form schema alongside each workflow version so drafts
-- and future reconciliations cannot alter historical RSVP validation/UI.

BEGIN;

UPDATE public.program_workflow_configs AS workflow
SET metadata = COALESCE(workflow.metadata, '{}'::jsonb) || jsonb_build_object(
  'form_snapshot',
  jsonb_build_object(
    'id', form.id,
    'dynamic_form_id', form.id,
    'title', form.title,
    'fields', COALESCE(form.fields, '[]'::jsonb),
    'experience_version', CASE
      WHEN workflow.metadata->>'experience_version' IN ('1', '2')
        THEN (workflow.metadata->>'experience_version')::integer
      ELSE 1
    END
  )
)
FROM public.dynamic_forms AS form
WHERE workflow.dynamic_form_id = form.id
  AND NOT (COALESCE(workflow.metadata, '{}'::jsonb) ? 'form_snapshot');

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
  v_form_snapshot jsonb;
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
  v_form_snapshot := p_config #> '{metadata,form_snapshot}';
  IF jsonb_typeof(v_form_snapshot) <> 'object'
     OR jsonb_typeof(v_form_snapshot->'fields') <> 'array'
     OR COALESCE(v_form_snapshot->>'dynamic_form_id', v_form_snapshot->>'id', '') <> v_form_id::text THEN
    RAISE EXCEPTION 'A matching immutable form snapshot is required';
  END IF;

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
     AND v_active.payment_rules = COALESCE(p_config->'payment_rules', '{}'::jsonb)
     AND COALESCE(v_active.metadata->'form_snapshot', 'null'::jsonb) = v_form_snapshot THEN
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

REVOKE ALL ON FUNCTION public.reconcile_program_workflow_v2(uuid, jsonb, text, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reconcile_program_workflow_v2(uuid, jsonb, text, uuid)
  TO service_role;

COMMIT;
