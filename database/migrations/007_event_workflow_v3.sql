-- ============================================================================
-- Migration 007: Event Workflow V3 — Employee Gathering
-- Target version: v5.9.0
--
-- Additive extensions for the Employee Gathering workflow:
--   1. Structured event/RSVP/entitlement/price/payment settings on programs.
--   2. Authoritative frozen recipient eligibility snapshot at publication.
--   3. Program/gate-aware scan ledger with append-only audit.
--   4. Doorprize eligibility derived from actual attendance only.
--   5. Reporting aggregate views for dashboard/Excel/PDF consistency.
--
-- This migration is idempotent and safe to rerun.
-- All new objects are additive; no existing columns or tables are removed.
-- ============================================================================

BEGIN;

-- --------------------------------------------------------------------------
-- Shared helpers
-- --------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.set_event_workflow_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.set_event_workflow_updated_at() IS
  'Maintains updated_at for Event Workflow V3 records.';

-- --------------------------------------------------------------------------
-- 1. Structured program fields for Employee Gathering
-- --------------------------------------------------------------------------

-- Add structured columns to union_programs for event workflow
ALTER TABLE public.union_programs
  ADD COLUMN IF NOT EXISTS program_type text NOT NULL DEFAULT 'generic'
    CHECK (program_type IN ('generic', 'gathering', 'kurban', 'bingkisan', 'turnamen')),
  ADD COLUMN IF NOT EXISTS rsvp_deadline timestamptz,
  ADD COLUMN IF NOT EXISTS registration_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS benefit_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS family_package_price numeric(14,2) NOT NULL DEFAULT 0 CHECK (family_package_price >= 0),
  ADD COLUMN IF NOT EXISTS shirt_price_map jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS camping_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS doorprize_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS payment_methods jsonb NOT NULL DEFAULT '["transfer", "qris"]'::jsonb,
  ADD COLUMN IF NOT EXISTS payment_accounts jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS qris_image_url text,
  ADD COLUMN IF NOT EXISTS config_version integer NOT NULL DEFAULT 1 CHECK (config_version > 0),
  ADD COLUMN IF NOT EXISTS published_at timestamptz,
  ADD COLUMN IF NOT EXISTS published_by uuid,
  ADD COLUMN IF NOT EXISTS publication_status text NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS eligibility_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS eligibility_source_filter jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS metadata_v3 jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Constraints
ALTER TABLE public.union_programs
  DROP CONSTRAINT IF EXISTS union_programs_payment_methods_object_check,
  DROP CONSTRAINT IF EXISTS union_programs_payment_accounts_object_check;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'union_programs_program_type_check'
      AND conrelid = 'public.union_programs'::regclass
  ) THEN
    ALTER TABLE public.union_programs
      ADD CONSTRAINT union_programs_program_type_check
      CHECK (program_type IN ('generic', 'gathering', 'kurban', 'bingkisan', 'turnamen'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'union_programs_shirt_price_map_object_check'
      AND conrelid = 'public.union_programs'::regclass
  ) THEN
    ALTER TABLE public.union_programs
      ADD CONSTRAINT union_programs_shirt_price_map_object_check
      CHECK (jsonb_typeof(shirt_price_map) = 'object');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'union_programs_payment_methods_array_check'
      AND conrelid = 'public.union_programs'::regclass
  ) THEN
    ALTER TABLE public.union_programs
      ADD CONSTRAINT union_programs_payment_methods_array_check
      CHECK (jsonb_typeof(payment_methods) = 'array');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'union_programs_payment_accounts_array_check'
      AND conrelid = 'public.union_programs'::regclass
  ) THEN
    ALTER TABLE public.union_programs
      ADD CONSTRAINT union_programs_payment_accounts_array_check
      CHECK (jsonb_typeof(payment_accounts) = 'array');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'union_programs_eligibility_snapshot_object_check'
      AND conrelid = 'public.union_programs'::regclass
  ) THEN
    ALTER TABLE public.union_programs
      ADD CONSTRAINT union_programs_eligibility_snapshot_object_check
      CHECK (jsonb_typeof(eligibility_snapshot) = 'object');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'union_programs_eligibility_source_filter_object_check'
      AND conrelid = 'public.union_programs'::regclass
  ) THEN
    ALTER TABLE public.union_programs
      ADD CONSTRAINT union_programs_eligibility_source_filter_object_check
      CHECK (jsonb_typeof(eligibility_source_filter) = 'object');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'union_programs_metadata_v3_object_check'
      AND conrelid = 'public.union_programs'::regclass
  ) THEN
    ALTER TABLE public.union_programs
      ADD CONSTRAINT union_programs_metadata_v3_object_check
      CHECK (jsonb_typeof(metadata_v3) = 'object');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'union_programs_publication_status_check'
      AND conrelid = 'public.union_programs'::regclass
  ) THEN
    ALTER TABLE public.union_programs
      ADD CONSTRAINT union_programs_publication_status_check
      CHECK (publication_status IN ('draft', 'published', 'closed'));
  END IF;
END;
$$;

COMMENT ON COLUMN public.union_programs.program_type IS
  'generic = legacy/default; gathering = Employee Gathering with RSVP/entitlement workflow.';
COMMENT ON COLUMN public.union_programs.rsvp_deadline IS
  'Hard deadline after which RSVP submissions are rejected.';
COMMENT ON COLUMN public.union_programs.family_package_price IS
  'Server-authoritative price per family member package.';
COMMENT ON COLUMN public.union_programs.shirt_price_map IS
  'JSON map of shirt size to surcharge, e.g. {"XXL": 25000, "XXXL": 50000}.';
COMMENT ON COLUMN public.union_programs.config_version IS
  'Immutable version counter incremented on each publish; prevents post-publication mutation.';
COMMENT ON COLUMN public.union_programs.eligibility_snapshot IS
  'Frozen recipient rows with source/filter snapshot at publication time.';
COMMENT ON COLUMN public.union_programs.eligibility_source_filter IS
  'NIK/department/join-date filter criteria used to resolve eligibility at publication.';

-- --------------------------------------------------------------------------
-- 2. Authoritative frozen recipient eligibility snapshot
-- --------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.program_eligibility (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id uuid NOT NULL REFERENCES public.union_programs(id) ON DELETE CASCADE,
  config_version integer NOT NULL CHECK (config_version > 0),
  nik text NOT NULL,
  employee_name text,
  department text,
  join_date date,
  source_filter jsonb NOT NULL DEFAULT '{}'::jsonb,
  snapshot_version integer NOT NULL DEFAULT 1 CHECK (snapshot_version > 0),
  published_at timestamptz NOT NULL DEFAULT now(),
  published_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT program_eligibility_nik_not_blank_check
    CHECK (length(btrim(nik)) > 0),
  CONSTRAINT program_eligibility_source_filter_object_check
    CHECK (jsonb_typeof(source_filter) = 'object')
);

-- Complete the smaller legacy eligibility table without replacing or deleting
-- any recipient row. Historical rows become snapshot version 1.
ALTER TABLE public.program_eligibility
  ADD COLUMN IF NOT EXISTS config_version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS employee_name text,
  ADD COLUMN IF NOT EXISTS department text,
  ADD COLUMN IF NOT EXISTS join_date date,
  ADD COLUMN IF NOT EXISTS source_filter jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS snapshot_version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS published_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS published_by uuid,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS uq_program_eligibility_program_nik_version
  ON public.program_eligibility(program_id, nik, config_version);

CREATE INDEX IF NOT EXISTS idx_program_eligibility_program_version
  ON public.program_eligibility(program_id, config_version);

CREATE INDEX IF NOT EXISTS idx_program_eligibility_nik
  ON public.program_eligibility(nik);

DROP TRIGGER IF EXISTS trg_program_eligibility_updated_at
  ON public.program_eligibility;

COMMENT ON TABLE public.program_eligibility IS
  'Frozen recipient rows at publication time. Authoritative source for RSVP eligibility.';
COMMENT ON COLUMN public.program_eligibility.config_version IS
  'Matches the union_programs.config_version at publication; prevents cross-version confusion.';
COMMENT ON COLUMN public.program_eligibility.source_filter IS
  'Snapshot of the filter criteria (NIK list, department, join-date cutoff) used to resolve this recipient.';

-- --------------------------------------------------------------------------
-- 3. Program/gate-aware scan ledger (append-only)
-- --------------------------------------------------------------------------

-- Extend program_coupon_redemptions with program and gate fields
ALTER TABLE public.program_coupon_redemptions
  ADD COLUMN IF NOT EXISTS program_id uuid REFERENCES public.union_programs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS gate text,
  ADD COLUMN IF NOT EXISTS entitlement_id uuid;

-- Legacy coupon installations do not all use the same primary-key type. Add
-- the FK only when the checked schema confirms a UUID key.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'program_coupons'
      AND column_name = 'id'
      AND udt_name = 'uuid'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'program_coupon_redemptions_entitlement_v3_fkey'
      AND conrelid = 'public.program_coupon_redemptions'::regclass
  ) THEN
    ALTER TABLE public.program_coupon_redemptions
      ADD CONSTRAINT program_coupon_redemptions_entitlement_v3_fkey
      FOREIGN KEY (entitlement_id) REFERENCES public.program_coupons(id) ON DELETE SET NULL;
  END IF;
END;
$$;

ALTER TABLE public.program_coupons
  ADD COLUMN IF NOT EXISTS scanned_at timestamptz,
  ADD COLUMN IF NOT EXISTS scanned_by uuid;

-- Indexes for the new fields
CREATE INDEX IF NOT EXISTS idx_program_coupon_redemptions_program_gate
  ON public.program_coupon_redemptions(program_id, gate, scanned_at DESC);

CREATE INDEX IF NOT EXISTS idx_program_coupon_redemptions_program_result
  ON public.program_coupon_redemptions(program_id, scan_result, scanned_at DESC);

CREATE INDEX IF NOT EXISTS idx_program_coupon_redemptions_entitlement
  ON public.program_coupon_redemptions(entitlement_id);

COMMENT ON COLUMN public.program_coupon_redemptions.program_id IS
  'Program context for the scan; enables gate/program-aware redemption logic.';
COMMENT ON COLUMN public.program_coupon_redemptions.gate IS
  'Gate identifier where the scan occurred; used for wrong-gate rejection.';
COMMENT ON COLUMN public.program_coupon_redemptions.entitlement_id IS
  'Direct link to the program_coupons row being scanned for V2 entitlements.';

-- --------------------------------------------------------------------------
-- 4. Doorprize eligibility from actual attendance
-- --------------------------------------------------------------------------

-- Add doorprize eligibility tracking to registrations
ALTER TABLE public.program_registrations
  ADD COLUMN IF NOT EXISTS doorprize_eligible boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS doorprize_eligible_at timestamptz;

-- Update the CHECK constraint for registration_status to include all V3 states
DO $$
BEGIN
  -- Drop old constraint if exists
  ALTER TABLE public.program_registrations
    DROP CONSTRAINT IF EXISTS program_registrations_registration_status_check;

  -- Add comprehensive constraint
  ALTER TABLE public.program_registrations
    ADD CONSTRAINT program_registrations_registration_status_check
    CHECK (registration_status IN (
      'draft', 'submitted', 'pending_payment', 'confirmed', 'cancelled',
      'not_started', 'declined', 'payment_pending', 'payment_review',
      'payment_rejected', 'locked'
    ));
END;
$$;

-- Update payment_status CHECK to include all V3 states
DO $$
BEGIN
  ALTER TABLE public.program_registrations
    DROP CONSTRAINT IF EXISTS program_registrations_payment_status_check;

  ALTER TABLE public.program_registrations
    ADD CONSTRAINT program_registrations_payment_status_check
    CHECK (payment_status IN (
      'not_required', 'pending', 'under_review', 'paid', 'failed',
      'expired', 'cancelled', 'refunded'
    ));
END;
$$;

COMMENT ON COLUMN public.program_registrations.doorprize_eligible IS
  'True only after a successful employee-attendance scan or audited manual override.';
COMMENT ON COLUMN public.program_registrations.doorprize_eligible_at IS
  'Timestamp when doorprize eligibility was established.';

-- --------------------------------------------------------------------------
-- 5. Reporting aggregate view
-- --------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.program_workflow_report AS
SELECT
  pr.program_id,
  up.name AS program_name,
  up.program_type,
  up.config_version,
  up.rsvp_deadline,
  up.published_at,
  -- RSVP summary
  COUNT(*) FILTER (WHERE pr.attendance_status = 'attending') AS attending_count,
  COUNT(*) FILTER (WHERE pr.attendance_status = 'declined') AS declined_count,
  COUNT(*) FILTER (WHERE pr.attendance_status = 'unknown') AS unanswered_count,
  COUNT(*) AS total_registrations,
  -- Shirt summary
  COUNT(*) FILTER (WHERE pr.shirt_size IS NOT NULL AND pr.shirt_size <> '') AS shirt_count,
  -- Camping
  COUNT(*) FILTER (WHERE pr.is_camping = true) AS camping_count,
  -- Family
  COALESCE(SUM(pr.family_count), 0) AS total_family_members,
  -- Payment summary
  COUNT(*) FILTER (WHERE pr.payment_status = 'paid') AS paid_count,
  COUNT(*) FILTER (WHERE pr.payment_status = 'pending' OR pr.payment_status = 'under_review') AS pending_payment_count,
  COUNT(*) FILTER (WHERE pr.payment_status = 'failed') AS failed_payment_count,
  COALESCE(SUM(pr.total_amount), 0) AS total_billed,
  COALESCE(SUM(pr.total_amount) FILTER (WHERE pr.payment_status = 'paid'), 0) AS total_paid,
  -- Entitlement summary (from program_coupons linked to V2 registrations)
  (SELECT COUNT(*) FROM public.program_coupons pc
    WHERE pc.program_registration_id = pr.id
      AND pc.entitlement_code = 'employee_attendance'
      AND pc.status = 'active') AS employee_attendance_active,
  (SELECT COUNT(*) FROM public.program_coupons pc
    WHERE pc.program_registration_id = pr.id
      AND pc.entitlement_code = 'employee_meal'
      AND pc.status = 'active') AS employee_meal_active,
  -- Doorprize
  COUNT(*) FILTER (WHERE pr.doorprize_eligible = true) AS doorprize_eligible_count,
  -- Scan audit summary
  (SELECT COUNT(*) FROM public.program_coupon_redemptions pcr
    WHERE pcr.program_id = pr.program_id
      AND pcr.scan_result = 'success') AS scan_success_count,
  (SELECT COUNT(*) FROM public.program_coupon_redemptions pcr
    WHERE pcr.program_id = pr.program_id
      AND pcr.scan_result = 'duplicate') AS scan_duplicate_count,
  (SELECT COUNT(*) FROM public.program_coupon_redemptions pcr
    WHERE pcr.program_id = pr.program_id
      AND pcr.scan_result = 'rejected') AS scan_rejected_count
FROM public.program_registrations pr
JOIN public.union_programs up ON up.id = pr.program_id
WHERE up.program_type = 'gathering'
GROUP BY pr.program_id, pr.id, up.name, up.program_type, up.config_version,
         up.rsvp_deadline, up.published_at;

COMMENT ON VIEW public.program_workflow_report IS
  'Unified reporting aggregate for Employee Gathering dashboard, Excel, and PDF exports.';

-- --------------------------------------------------------------------------
-- 6. RLS policies for new objects
-- --------------------------------------------------------------------------

-- program_eligibility RLS
ALTER TABLE public.program_eligibility ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'program_eligibility'
      AND policyname = 'program_eligibility_admin_all'
  ) THEN
    CREATE POLICY program_eligibility_admin_all
      ON public.program_eligibility
      FOR ALL TO authenticated
      USING (public.is_program_workflow_admin())
      WITH CHECK (public.is_program_workflow_admin());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'program_eligibility'
      AND policyname = 'program_eligibility_owner_read'
  ) THEN
    CREATE POLICY program_eligibility_owner_read
      ON public.program_eligibility
      FOR SELECT TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.profiles AS profile
          WHERE profile.id = auth.uid()
            AND profile.nik = program_eligibility.nik
        )
      );
  END IF;
END;
$$;

-- Grant privileges
GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.program_eligibility
  TO authenticated;

GRANT ALL
  ON public.program_eligibility
  TO service_role;

GRANT SELECT
  ON public.program_workflow_report
  TO authenticated;

-- --------------------------------------------------------------------------
-- 7. Helper function: validate gathering publication
-- --------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.validate_gathering_publish(
  p_program_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_program record;
  v_form_count integer;
  v_recipient_count integer;
  v_errors text[] := '{}';
BEGIN
  -- Fetch program
  SELECT * INTO v_program
  FROM public.union_programs
  WHERE id = p_program_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'valid', false,
      'errors', jsonb_build_array('Program not found')
    );
  END IF;

  -- Must be gathering type
  IF v_program.program_type <> 'gathering' THEN
    v_errors := array_append(v_errors, 'Program must be type gathering');
  END IF;

  -- Must have RSVP deadline
  IF v_program.rsvp_deadline IS NULL THEN
    v_errors := array_append(v_errors, 'RSVP deadline is required');
  ELSIF v_program.rsvp_deadline <= now() THEN
    v_errors := array_append(v_errors, 'RSVP deadline must be in the future');
  END IF;

  -- Must have a valid form
  SELECT COUNT(*) INTO v_form_count
  FROM public.program_workflow_configs
  WHERE program_id = p_program_id
    AND is_active = true
    AND dynamic_form_id IS NOT NULL;

  IF v_form_count = 0 THEN
    v_errors := array_append(v_errors, 'No active form configuration found');
  END IF;

  -- Must have recipients (check eligibility preview or existing snapshot)
  IF v_program.eligibility_snapshot IS NULL
     OR v_program.eligibility_snapshot = '{}'::jsonb THEN
    v_errors := array_append(v_errors, 'No eligibility snapshot found. Run preview first.');
  ELSE
    SELECT jsonb_array_length(
      CASE WHEN jsonb_typeof(v_program.eligibility_snapshot->'recipients') = 'array'
           THEN v_program.eligibility_snapshot->'recipients'
           ELSE '[]'::jsonb END
    ) INTO v_recipient_count;

    IF v_recipient_count = 0 THEN
      v_errors := array_append(v_errors, 'Eligibility snapshot contains no recipients');
    END IF;
  END IF;

  -- Return validation result
  IF array_length(v_errors, 1) > 0 THEN
    RETURN jsonb_build_object(
      'valid', false,
      'errors', to_jsonb(v_errors)
    );
  END IF;

  RETURN jsonb_build_object(
    'valid', true,
    'errors', '[]'::jsonb,
    'program_id', p_program_id,
    'config_version', v_program.config_version
  );
END;
$$;

COMMENT ON FUNCTION public.validate_gathering_publish(uuid) IS
  'Validates a gathering program is ready for publication. Returns validation result with errors.';

-- --------------------------------------------------------------------------
-- 8. Helper function: publish gathering (transactional)
-- --------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.publish_gathering(
  p_program_id uuid,
  p_config_version integer,
  p_eligibility_snapshot jsonb,
  p_eligibility_source_filter jsonb,
  p_admin_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_program record;
  v_active_config record;
  v_new_version integer;
  v_published_at timestamptz;
  v_recipient_count integer;
BEGIN
  -- The backend uses a service-role client, so auth.uid() is not the admin's
  -- identity. Verify the authenticated actor ID passed by the protected route.
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = p_admin_id AND role IN ('admin', 'superadmin')
  ) THEN
    RAISE EXCEPTION 'Unauthorized: admin role required';
  END IF;

  SELECT * INTO v_program
  FROM public.union_programs
  WHERE id = p_program_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Program not found: %', p_program_id;
  END IF;
  IF v_program.config_version <> p_config_version THEN
    RAISE EXCEPTION 'Program configuration changed. Reload before publishing.';
  END IF;
  IF v_program.program_type <> 'gathering' THEN
    RAISE EXCEPTION 'Only gathering programs use this publication workflow.';
  END IF;
  IF v_program.rsvp_deadline IS NULL OR v_program.rsvp_deadline <= now() THEN
    RAISE EXCEPTION 'A future RSVP deadline is required.';
  END IF;
  IF v_program.start_date IS NOT NULL AND v_program.rsvp_deadline > v_program.start_date THEN
    RAISE EXCEPTION 'RSVP deadline cannot be after the event starts.';
  END IF;
  IF jsonb_typeof(p_eligibility_snapshot->'recipients') <> 'array' THEN
    RAISE EXCEPTION 'Eligibility snapshot recipients must be an array.';
  END IF;
  v_recipient_count := jsonb_array_length(p_eligibility_snapshot->'recipients');
  IF v_recipient_count = 0 THEN
    RAISE EXCEPTION 'At least one eligible recipient is required.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.program_registrations WHERE program_id = p_program_id
  ) THEN
    RAISE EXCEPTION 'A program with registrations requires audited reconciliation, not republish.';
  END IF;

  SELECT * INTO v_active_config
  FROM public.program_workflow_configs
  WHERE program_id = p_program_id AND is_active = true
  ORDER BY version DESC
  LIMIT 1
  FOR UPDATE;
  IF NOT FOUND OR v_active_config.dynamic_form_id IS NULL THEN
    RAISE EXCEPTION 'An active RSVP form configuration is required.';
  END IF;

  SELECT GREATEST(
    v_program.config_version + 1,
    COALESCE(MAX(version), 0) + 1
  ) INTO v_new_version
  FROM public.program_workflow_configs
  WHERE program_id = p_program_id;

  -- Preserve the old immutable config and publish a new version snapshot.
  UPDATE public.program_workflow_configs
  SET is_active = false, updated_by = p_admin_id
  WHERE program_id = p_program_id AND is_active = true;

  INSERT INTO public.program_workflow_configs (
    program_id, dynamic_form_id, version, is_active, field_bindings,
    pricing_rules, entitlement_rules, payment_rules, metadata,
    created_by, updated_by
  ) VALUES (
    p_program_id, v_active_config.dynamic_form_id, v_new_version, true,
    v_active_config.field_bindings, v_active_config.pricing_rules,
    v_active_config.entitlement_rules, v_active_config.payment_rules,
    COALESCE(v_active_config.metadata, '{}'::jsonb) || jsonb_build_object(
      'published_from_config_id', v_active_config.id,
      'published_at', now()
    ),
    p_admin_id, p_admin_id
  );

  UPDATE public.union_programs
  SET config_version = v_new_version,
      published_at = now(),
      published_by = p_admin_id,
      publication_status = 'published',
      registration_enabled = true,
      eligibility_snapshot = p_eligibility_snapshot,
      eligibility_source_filter = p_eligibility_source_filter,
      updated_at = now()
  WHERE id = p_program_id
  RETURNING config_version, published_at
  INTO v_new_version, v_published_at;

  -- Append the frozen snapshot. Older versions are intentionally retained.
  INSERT INTO public.program_eligibility (
    program_id, config_version, nik, employee_name, department, join_date,
    source_filter, snapshot_version, published_at, published_by
  )
  SELECT
    p_program_id,
    v_new_version,
    btrim(recipient->>'nik'),
    NULLIF(btrim(recipient->>'name'), ''),
    NULLIF(btrim(recipient->>'department'), ''),
    CASE
      WHEN COALESCE(recipient->>'join_date', '') ~ '^\d{4}-\d{2}-\d{2}$'
        THEN (recipient->>'join_date')::date
      ELSE NULL
    END,
    p_eligibility_source_filter,
    v_new_version,
    v_published_at,
    p_admin_id
  FROM jsonb_array_elements(p_eligibility_snapshot->'recipients') AS recipient
  WHERE length(btrim(recipient->>'nik')) > 0
  ON CONFLICT (program_id, nik, config_version) DO NOTHING;

  -- Return success
  RETURN jsonb_build_object(
    'success', true,
    'program_id', p_program_id,
    'config_version', v_new_version,
    'published_at', v_published_at,
    'recipient_count', v_recipient_count
  );
END;
$$;

COMMENT ON FUNCTION public.publish_gathering(uuid, integer, jsonb, jsonb, uuid) IS
  'Transactional publication of a gathering program. Increments version, freezes eligibility, records audit.';

-- --------------------------------------------------------------------------
-- 9. Helper function: scan entitlement (gate/program-aware)
-- --------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.scan_entitlement_v2(
  p_program_id uuid,
  p_gate text,
  p_scanned_code text,
  p_scanner_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_coupon record;
  v_scan_result text;
  v_failure_reason text;
  v_redemption_id uuid;
  v_expected_gate text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = p_scanner_user_id AND role IN ('admin', 'superadmin')
  ) THEN
    RAISE EXCEPTION 'Unauthorized: admin role required';
  END IF;
  IF p_gate NOT IN ('attendance', 'meal') THEN
    RAISE EXCEPTION 'Gate must be attendance or meal';
  END IF;

  SELECT * INTO v_coupon
  FROM public.program_coupons
  WHERE coupon_code = p_scanned_code
    AND program_id = p_program_id
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    v_scan_result := 'rejected';
    v_failure_reason := 'Code not found for this program';
  ELSE
    v_expected_gate := CASE
      WHEN v_coupon.entitlement_code IN ('employee_attendance', 'family_attendance', 'attendance')
        OR v_coupon.gate_type IN ('attendance', 'attendance_family') THEN 'attendance'
      WHEN v_coupon.entitlement_code IN ('employee_meal', 'family_meal', 'meal')
        OR v_coupon.gate_type IN ('meal', 'meal_family', 'food') THEN 'meal'
      ELSE NULL
    END;
  END IF;

  IF v_scan_result IS NULL AND v_expected_gate IS NULL THEN
    v_scan_result := 'rejected';
    v_failure_reason := 'Entitlement type is not supported';
  ELSIF v_scan_result IS NULL AND v_expected_gate <> p_gate THEN
    v_scan_result := 'rejected';
    v_failure_reason := 'Wrong gate: use ' || v_expected_gate;
  ELSIF v_scan_result IS NULL AND (
    v_coupon.status = 'claimed' OR EXISTS (
      SELECT 1 FROM public.program_coupon_redemptions
      WHERE coupon_id = v_coupon.id
        AND scan_result = 'success'
    )
  ) THEN
    v_scan_result := 'duplicate';
    v_failure_reason := 'Code already scanned successfully';
  ELSIF v_scan_result IS NULL AND v_coupon.status <> 'active' THEN
    v_scan_result := 'rejected';
    v_failure_reason := 'Code is not active (status: ' || v_coupon.status || ')';
  ELSIF v_scan_result IS NULL THEN
    v_scan_result := 'success';
    UPDATE public.program_coupons
    SET status = 'claimed', scanned_at = now(), scanned_by = p_scanner_user_id
    WHERE id = v_coupon.id;
  END IF;

  INSERT INTO public.program_coupon_redemptions (
    coupon_id,
    entitlement_id,
    program_registration_id,
    program_id,
    scanned_code,
    entitlement_code,
    gate,
    scan_result,
    failure_reason,
    scanner_user_id,
    scanned_at,
    metadata
  ) VALUES (
    v_coupon.id,
    v_coupon.id,
    v_coupon.program_registration_id,
    p_program_id,
    'token-hash:' || md5(p_scanned_code),
    v_coupon.entitlement_code,
    p_gate,
    v_scan_result,
    v_failure_reason,
    p_scanner_user_id,
    now(),
    jsonb_build_object(
      'entitlement_code', v_coupon.entitlement_code,
      'beneficiary_type', v_coupon.beneficiary_type,
      'beneficiary_index', v_coupon.beneficiary_index
    )
  )
  RETURNING id INTO v_redemption_id;

  -- If successful attendance scan, mark doorprize eligible
  IF v_scan_result = 'success'
     AND v_coupon.entitlement_code = 'employee_attendance'
     AND v_coupon.beneficiary_type = 'employee' THEN
    UPDATE public.program_registrations
    SET doorprize_eligible = true,
        doorprize_eligible_at = now(),
        registration_status = 'locked'
    WHERE id = v_coupon.program_registration_id;
  END IF;

  RETURN jsonb_build_object(
    'scan_result', v_scan_result,
    'failure_reason', v_failure_reason,
    'redemption_id', v_redemption_id,
    'entitlement_code', v_coupon.entitlement_code,
    'beneficiary_type', v_coupon.beneficiary_type,
    'beneficiary_index', v_coupon.beneficiary_index,
    'name', v_coupon.name,
    'nik', v_coupon.nik,
    'gate', p_gate,
    'program_id', p_program_id
  );
END;
$$;

COMMENT ON FUNCTION public.scan_entitlement_v2(uuid, text, text, uuid) IS
  'Gate/program-aware scan with append-only audit. Returns scan result with entitlement details.';

-- --------------------------------------------------------------------------
-- 10. Helper function: manual attendance override
-- --------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.attendance_override(
  p_program_id uuid,
  p_nik text,
  p_reason text,
  p_admin_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_registration record;
  v_redemption_id uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = p_admin_id AND role IN ('admin', 'superadmin')
  ) THEN
    RAISE EXCEPTION 'Unauthorized: admin role required';
  END IF;

  IF p_reason IS NULL OR length(trim(p_reason)) < 3 THEN
    RAISE EXCEPTION 'Override reason is required';
  END IF;

  -- Find registration
  SELECT * INTO v_registration
  FROM public.program_registrations
  WHERE program_id = p_program_id
    AND nik = p_nik;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Registration not found for NIK'
    );
  END IF;

  -- Mark doorprize eligible
  UPDATE public.program_registrations
  SET doorprize_eligible = true,
      doorprize_eligible_at = now(),
      registration_status = 'locked',
      metadata = metadata || jsonb_build_object(
        'override_reason', p_reason,
        'override_by', p_admin_id,
        'override_at', now()::text
      )
  WHERE id = v_registration.id;

  -- Create audit record
  INSERT INTO public.program_coupon_redemptions (
    program_registration_id,
    program_id,
    scanned_code,
    entitlement_code,
    gate,
    scan_result,
    failure_reason,
    scanner_user_id,
    scanned_at,
    metadata
  ) VALUES (
    v_registration.id,
    p_program_id,
    'override-registration:' || v_registration.id,
    'employee_attendance',
    'attendance',
    'success',
    'Manual attendance override: ' || p_reason,
    p_admin_id,
    now(),
    jsonb_build_object(
      'override', true,
      'reason', p_reason,
      'registration_id', v_registration.id
    )
  )
  RETURNING id INTO v_redemption_id;

  RETURN jsonb_build_object(
    'success', true,
    'registration_id', v_registration.id,
    'doorprize_eligible', true,
    'redemption_id', v_redemption_id
  );
END;
$$;

COMMENT ON FUNCTION public.attendance_override(uuid, text, text, uuid) IS
  'Admin manual attendance override with required reason and permanent audit trail.';

-- --------------------------------------------------------------------------
-- 11. Atomic form/program binding and workflow config versioning
-- --------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.link_program_form_v2(
  p_program_id uuid,
  p_form_id uuid,
  p_config jsonb,
  p_form_fields jsonb,
  p_actor_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_version integer;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = p_actor_id AND role IN ('admin', 'superadmin')
  ) THEN
    RAISE EXCEPTION 'Unauthorized: admin role required';
  END IF;

  PERFORM 1 FROM public.union_programs WHERE id = p_program_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Program not found'; END IF;

  IF EXISTS (
    SELECT 1 FROM public.program_registrations WHERE program_id = p_program_id
  ) THEN
    RAISE EXCEPTION 'Cannot relink a form after registrations exist';
  END IF;

  UPDATE public.program_workflow_configs
  SET is_active = false, updated_by = p_actor_id
  WHERE program_id = p_program_id AND is_active = true;

  IF p_form_id IS NULL THEN
    UPDATE public.union_programs
    SET dynamic_form_id = NULL, publication_status = 'draft', updated_at = now()
    WHERE id = p_program_id;
    RETURN jsonb_build_object('success', true, 'unlinked', true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.dynamic_forms WHERE id = p_form_id) THEN
    RAISE EXCEPTION 'Form not found';
  END IF;
  IF jsonb_typeof(p_form_fields) <> 'array' THEN
    RAISE EXCEPTION 'Form fields must be a JSON array';
  END IF;

  UPDATE public.dynamic_forms
  SET fields = p_form_fields
  WHERE id = p_form_id;

  SELECT COALESCE(MAX(version), 0) + 1 INTO v_version
  FROM public.program_workflow_configs
  WHERE program_id = p_program_id;

  INSERT INTO public.program_workflow_configs (
    program_id, dynamic_form_id, version, is_active, field_bindings,
    pricing_rules, entitlement_rules, payment_rules, metadata,
    created_by, updated_by
  ) VALUES (
    p_program_id,
    p_form_id,
    v_version,
    true,
    COALESCE(p_config->'field_bindings', '{}'::jsonb),
    COALESCE(p_config->'pricing_rules', '{}'::jsonb),
    COALESCE(p_config->'entitlement_rules', '{}'::jsonb),
    COALESCE(p_config->'payment_rules', '{}'::jsonb),
    COALESCE(p_config->'metadata', '{}'::jsonb) || jsonb_build_object('linked_at', now()),
    p_actor_id,
    p_actor_id
  );

  UPDATE public.union_programs
  SET dynamic_form_id = p_form_id, publication_status = 'draft', updated_at = now()
  WHERE id = p_program_id;

  RETURN jsonb_build_object(
    'success', true,
    'program_id', p_program_id,
    'form_id', p_form_id,
    'workflow_version', v_version
  );
END;
$$;

REVOKE ALL ON FUNCTION public.link_program_form_v2(uuid, uuid, jsonb, jsonb, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.link_program_form_v2(uuid, uuid, jsonb, jsonb, uuid) TO service_role;

COMMIT;
