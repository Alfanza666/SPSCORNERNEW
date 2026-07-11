-- ============================================================================
-- Migration 006: Program Registration Workflow V2
-- Target version: v5.8.0
--
-- Additive foundation for:
--   1. Versioned program/form workflow bindings and pricing rules.
--   2. Idempotent employee RSVP registrations and priced line items.
--   3. Manual or gateway-backed program payments.
--   4. Employee/family coupon entitlement relations.
--   5. Immutable coupon scan/redemption audit records.
--
-- This migration intentionally does not rename or remove legacy columns from
-- union_programs, dynamic_forms, dynamic_form_responses, or program_coupons.
-- See docs/form-workflow-v2-schema.md before wiring application writes.
-- ============================================================================

BEGIN;

-- --------------------------------------------------------------------------
-- Shared helpers
-- --------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.set_program_workflow_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.set_program_workflow_updated_at() IS
  'Maintains updated_at for Program Workflow V2 records.';

CREATE OR REPLACE FUNCTION public.is_program_workflow_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles AS profile
    WHERE profile.id = auth.uid()
      AND profile.role IN ('admin', 'superadmin')
  );
$$;

REVOKE ALL ON FUNCTION public.is_program_workflow_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_program_workflow_admin() TO authenticated, service_role;

COMMENT ON FUNCTION public.is_program_workflow_admin() IS
  'RLS helper for Program Workflow V2 admin and superadmin authorization.';

-- --------------------------------------------------------------------------
-- Versioned workflow configuration
-- --------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.program_workflow_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id uuid NOT NULL REFERENCES public.union_programs(id) ON DELETE CASCADE,
  dynamic_form_id uuid REFERENCES public.dynamic_forms(id) ON DELETE SET NULL,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  is_active boolean NOT NULL DEFAULT false,
  field_bindings jsonb NOT NULL DEFAULT '{}'::jsonb,
  pricing_rules jsonb NOT NULL DEFAULT '{}'::jsonb,
  entitlement_rules jsonb NOT NULL DEFAULT '{}'::jsonb,
  payment_rules jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT program_workflow_configs_program_version_key UNIQUE (program_id, version),
  CONSTRAINT program_workflow_configs_field_bindings_object_check
    CHECK (jsonb_typeof(field_bindings) = 'object'),
  CONSTRAINT program_workflow_configs_pricing_rules_object_check
    CHECK (jsonb_typeof(pricing_rules) = 'object'),
  CONSTRAINT program_workflow_configs_entitlement_rules_object_check
    CHECK (jsonb_typeof(entitlement_rules) = 'object'),
  CONSTRAINT program_workflow_configs_payment_rules_object_check
    CHECK (jsonb_typeof(payment_rules) = 'object'),
  CONSTRAINT program_workflow_configs_metadata_object_check
    CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_program_workflow_configs_one_active
  ON public.program_workflow_configs(program_id)
  WHERE is_active;

CREATE INDEX IF NOT EXISTS idx_program_workflow_configs_form
  ON public.program_workflow_configs(dynamic_form_id);

DROP TRIGGER IF EXISTS trg_program_workflow_configs_updated_at
  ON public.program_workflow_configs;
CREATE TRIGGER trg_program_workflow_configs_updated_at
  BEFORE UPDATE ON public.program_workflow_configs
  FOR EACH ROW
  EXECUTE FUNCTION public.set_program_workflow_updated_at();

COMMENT ON TABLE public.program_workflow_configs IS
  'Versioned semantic field bindings, pricing, entitlement, and payment rules for a union program form.';
COMMENT ON COLUMN public.program_workflow_configs.field_bindings IS
  'Stable semantic keys mapped to dynamic form field IDs, e.g. attendance, shirt_size, camping, family_count.';
COMMENT ON COLUMN public.program_workflow_configs.pricing_rules IS
  'Server-authoritative pricing rules. Never trust totals submitted by the browser.';
COMMENT ON COLUMN public.program_workflow_configs.entitlement_rules IS
  'Rules describing which employee/family attendance and meal entitlements are issued.';

-- --------------------------------------------------------------------------
-- RSVP / event registration aggregate
-- --------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.program_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id uuid NOT NULL REFERENCES public.union_programs(id) ON DELETE CASCADE,
  workflow_config_id uuid REFERENCES public.program_workflow_configs(id) ON DELETE SET NULL,
  workflow_version integer CHECK (workflow_version IS NULL OR workflow_version > 0),
  dynamic_form_id uuid REFERENCES public.dynamic_forms(id) ON DELETE SET NULL,
  form_response_id uuid REFERENCES public.dynamic_form_responses(id) ON DELETE SET NULL,
  user_id uuid,
  nik text NOT NULL,
  attendee_name text,
  attendance_status text NOT NULL DEFAULT 'unknown'
    CHECK (attendance_status IN ('unknown', 'attending', 'declined')),
  registration_status text NOT NULL DEFAULT 'draft'
    CHECK (registration_status IN (
      'draft', 'submitted', 'pending_payment', 'confirmed', 'cancelled'
    )),
  shirt_size text,
  is_camping boolean,
  family_count integer NOT NULL DEFAULT 0 CHECK (family_count >= 0),
  currency text NOT NULL DEFAULT 'IDR' CHECK (char_length(currency) = 3),
  subtotal_amount numeric(14,2) NOT NULL DEFAULT 0 CHECK (subtotal_amount >= 0),
  total_amount numeric(14,2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
  payment_status text NOT NULL DEFAULT 'not_required'
    CHECK (payment_status IN (
      'not_required', 'pending', 'under_review', 'paid', 'failed',
      'expired', 'cancelled', 'refunded'
    )),
  answers_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  pricing_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  submitted_at timestamptz,
  confirmed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT program_registrations_nik_not_blank_check
    CHECK (length(btrim(nik)) > 0),
  CONSTRAINT program_registrations_answers_object_check
    CHECK (jsonb_typeof(answers_snapshot) = 'object'),
  CONSTRAINT program_registrations_pricing_object_check
    CHECK (jsonb_typeof(pricing_snapshot) = 'object'),
  CONSTRAINT program_registrations_metadata_object_check
    CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_program_registrations_program_nik
  ON public.program_registrations(program_id, nik);

CREATE UNIQUE INDEX IF NOT EXISTS uq_program_registrations_program_user
  ON public.program_registrations(program_id, user_id)
  WHERE user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_program_registrations_form_response
  ON public.program_registrations(form_response_id)
  WHERE form_response_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_program_registrations_status
  ON public.program_registrations(program_id, attendance_status, registration_status);

CREATE INDEX IF NOT EXISTS idx_program_registrations_payment_status
  ON public.program_registrations(program_id, payment_status);

DROP TRIGGER IF EXISTS trg_program_registrations_updated_at
  ON public.program_registrations;
CREATE TRIGGER trg_program_registrations_updated_at
  BEFORE UPDATE ON public.program_registrations
  FOR EACH ROW
  EXECUTE FUNCTION public.set_program_workflow_updated_at();

COMMENT ON TABLE public.program_registrations IS
  'One idempotent RSVP aggregate per program and employee/NIK, including answer and price snapshots.';
COMMENT ON COLUMN public.program_registrations.answers_snapshot IS
  'Only visible/submitted answers captured at finalization time; the dynamic response remains the detailed source record.';
COMMENT ON COLUMN public.program_registrations.pricing_snapshot IS
  'Immutable-at-confirmation description of the server-side rules used to calculate the total.';

-- --------------------------------------------------------------------------
-- Server-calculated registration line items
-- --------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.program_registration_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id uuid NOT NULL REFERENCES public.program_registrations(id) ON DELETE CASCADE,
  item_code text NOT NULL,
  item_name text NOT NULL,
  item_type text NOT NULL DEFAULT 'other'
    CHECK (item_type IN (
      'shirt_surcharge', 'family_entry', 'family_meal', 'camping', 'other'
    )),
  beneficiary_type text NOT NULL DEFAULT 'employee'
    CHECK (beneficiary_type IN ('employee', 'family')),
  beneficiary_index integer CHECK (beneficiary_index IS NULL OR beneficiary_index > 0),
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price numeric(14,2) NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
  line_total numeric(14,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT program_registration_items_code_not_blank_check
    CHECK (length(btrim(item_code)) > 0),
  CONSTRAINT program_registration_items_name_not_blank_check
    CHECK (length(btrim(item_name)) > 0),
  CONSTRAINT program_registration_items_metadata_object_check
    CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE INDEX IF NOT EXISTS idx_program_registration_items_registration
  ON public.program_registration_items(registration_id);

CREATE INDEX IF NOT EXISTS idx_program_registration_items_type
  ON public.program_registration_items(item_type);

COMMENT ON TABLE public.program_registration_items IS
  'Server-calculated, auditable item snapshots for shirt surcharge, family entry, family meals, and other program charges.';

-- --------------------------------------------------------------------------
-- Manual and payment-gateway records
-- --------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.program_registration_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id uuid NOT NULL REFERENCES public.program_registrations(id) ON DELETE CASCADE,
  payment_method text NOT NULL DEFAULT 'manual_transfer',
  provider text NOT NULL DEFAULT 'manual',
  reference_id text,
  idempotency_key text,
  expected_amount numeric(14,2) NOT NULL CHECK (expected_amount >= 0),
  paid_amount numeric(14,2) CHECK (paid_amount IS NULL OR paid_amount >= 0),
  currency text NOT NULL DEFAULT 'IDR' CHECK (char_length(currency) = 3),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN (
      'pending', 'under_review', 'paid', 'rejected', 'failed',
      'expired', 'cancelled', 'refunded'
    )),
  proof_url text,
  proof_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  provider_transaction_id text,
  provider_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  verified_by uuid,
  verified_at timestamptz,
  paid_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT program_registration_payments_idempotency_key UNIQUE (idempotency_key),
  CONSTRAINT program_registration_payments_method_not_blank_check
    CHECK (length(btrim(payment_method)) > 0),
  CONSTRAINT program_registration_payments_provider_not_blank_check
    CHECK (length(btrim(provider)) > 0),
  CONSTRAINT program_registration_payments_proof_metadata_object_check
    CHECK (jsonb_typeof(proof_metadata) = 'object'),
  CONSTRAINT program_registration_payments_provider_payload_object_check
    CHECK (jsonb_typeof(provider_payload) = 'object')
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'program_registration_payments_idempotency_key'
      AND conrelid = 'public.program_registration_payments'::regclass
  ) THEN
    ALTER TABLE public.program_registration_payments
      ADD CONSTRAINT program_registration_payments_idempotency_key
      UNIQUE (idempotency_key);
  END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_program_registration_payments_reference
  ON public.program_registration_payments(provider, reference_id)
  WHERE reference_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_program_registration_payments_registration
  ON public.program_registration_payments(registration_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_program_registration_payments_status
  ON public.program_registration_payments(status, created_at);

DROP TRIGGER IF EXISTS trg_program_registration_payments_updated_at
  ON public.program_registration_payments;
CREATE TRIGGER trg_program_registration_payments_updated_at
  BEFORE UPDATE ON public.program_registration_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.set_program_workflow_updated_at();

COMMENT ON TABLE public.program_registration_payments IS
  'Program-only payment ledger supporting manual verification and gateway callbacks without overloading kiosk transactions.';
COMMENT ON COLUMN public.program_registration_payments.expected_amount IS
  'Amount computed on the server from workflow configuration and item snapshots.';
COMMENT ON COLUMN public.program_registration_payments.provider_payload IS
  'Sanitized gateway callback/audit payload; secrets and full payment credentials must never be stored here.';

-- --------------------------------------------------------------------------
-- Additive relations on the existing coupon table
-- --------------------------------------------------------------------------

ALTER TABLE public.program_coupons
  ADD COLUMN IF NOT EXISTS program_registration_id uuid,
  ADD COLUMN IF NOT EXISTS program_registration_item_id uuid,
  ADD COLUMN IF NOT EXISTS beneficiary_type text,
  ADD COLUMN IF NOT EXISTS beneficiary_index integer,
  ADD COLUMN IF NOT EXISTS entitlement_code text,
  ADD COLUMN IF NOT EXISTS entitlement_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS issued_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'program_coupons_registration_v2_fkey'
      AND conrelid = 'public.program_coupons'::regclass
  ) THEN
    ALTER TABLE public.program_coupons
      ADD CONSTRAINT program_coupons_registration_v2_fkey
      FOREIGN KEY (program_registration_id)
      REFERENCES public.program_registrations(id)
      ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'program_coupons_registration_item_v2_fkey'
      AND conrelid = 'public.program_coupons'::regclass
  ) THEN
    ALTER TABLE public.program_coupons
      ADD CONSTRAINT program_coupons_registration_item_v2_fkey
      FOREIGN KEY (program_registration_item_id)
      REFERENCES public.program_registration_items(id)
      ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'program_coupons_beneficiary_type_v2_check'
      AND conrelid = 'public.program_coupons'::regclass
  ) THEN
    ALTER TABLE public.program_coupons
      ADD CONSTRAINT program_coupons_beneficiary_type_v2_check
      CHECK (
        beneficiary_type IS NULL
        OR beneficiary_type IN ('employee', 'family')
      ) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'program_coupons_beneficiary_index_v2_check'
      AND conrelid = 'public.program_coupons'::regclass
  ) THEN
    ALTER TABLE public.program_coupons
      ADD CONSTRAINT program_coupons_beneficiary_index_v2_check
      CHECK (beneficiary_index IS NULL OR beneficiary_index > 0) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'program_coupons_entitlement_metadata_v2_check'
      AND conrelid = 'public.program_coupons'::regclass
  ) THEN
    ALTER TABLE public.program_coupons
      ADD CONSTRAINT program_coupons_entitlement_metadata_v2_check
      CHECK (jsonb_typeof(entitlement_metadata) = 'object') NOT VALID;
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_program_coupons_registration_v2
  ON public.program_coupons(program_registration_id);

CREATE INDEX IF NOT EXISTS idx_program_coupons_registration_item_v2
  ON public.program_coupons(program_registration_item_id);

CREATE INDEX IF NOT EXISTS idx_program_coupons_entitlement_v2
  ON public.program_coupons(program_registration_id, entitlement_code, beneficiary_type);

CREATE UNIQUE INDEX IF NOT EXISTS uq_program_coupons_entitlement_beneficiary_v2
  ON public.program_coupons(
    program_registration_id,
    entitlement_code,
    COALESCE(beneficiary_type, 'employee'),
    COALESCE(beneficiary_index, 0)
  )
  WHERE program_registration_id IS NOT NULL
    AND entitlement_code IS NOT NULL;

COMMENT ON COLUMN public.program_coupons.program_registration_id IS
  'Optional link from a legacy coupon row to its Program Workflow V2 registration.';
COMMENT ON COLUMN public.program_coupons.beneficiary_type IS
  'employee or family; family members use beneficiary_index 1..N.';
COMMENT ON COLUMN public.program_coupons.entitlement_code IS
  'Stable benefit code such as attendance or meal, independent of legacy gate/coupon column names.';

-- --------------------------------------------------------------------------
-- Immutable redemption/scan audit
-- --------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.program_coupon_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id uuid,
  program_registration_id uuid REFERENCES public.program_registrations(id) ON DELETE SET NULL,
  scanned_code text NOT NULL,
  entitlement_code text,
  scan_result text NOT NULL
    CHECK (scan_result IN ('success', 'duplicate', 'rejected', 'reversed')),
  failure_reason text,
  scanner_user_id uuid,
  scanned_at timestamptz NOT NULL DEFAULT now(),
  reversal_of uuid REFERENCES public.program_coupon_redemptions(id) ON DELETE RESTRICT,
  device_context jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT program_coupon_redemptions_code_not_blank_check
    CHECK (length(btrim(scanned_code)) > 0),
  CONSTRAINT program_coupon_redemptions_device_context_object_check
    CHECK (jsonb_typeof(device_context) = 'object'),
  CONSTRAINT program_coupon_redemptions_metadata_object_check
    CHECK (jsonb_typeof(metadata) = 'object'),
  CONSTRAINT program_coupon_redemptions_reversal_check
    CHECK (
      (scan_result = 'reversed' AND reversal_of IS NOT NULL)
      OR (scan_result <> 'reversed' AND reversal_of IS NULL)
    )
);

-- program_coupons is a legacy table whose checked-in migration is missing.
-- Add its FK only when its primary key is confirmed to be UUID.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'program_coupons'
      AND column_name = 'id'
      AND udt_name = 'uuid'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'program_coupon_redemptions_coupon_v2_fkey'
      AND conrelid = 'public.program_coupon_redemptions'::regclass
  ) THEN
    ALTER TABLE public.program_coupon_redemptions
      ADD CONSTRAINT program_coupon_redemptions_coupon_v2_fkey
      FOREIGN KEY (coupon_id)
      REFERENCES public.program_coupons(id)
      ON DELETE SET NULL;
  END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_program_coupon_redemptions_success_once
  ON public.program_coupon_redemptions(coupon_id)
  WHERE coupon_id IS NOT NULL AND scan_result = 'success';

CREATE UNIQUE INDEX IF NOT EXISTS uq_program_coupon_redemptions_reversal_once
  ON public.program_coupon_redemptions(reversal_of)
  WHERE reversal_of IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_program_coupon_redemptions_registration
  ON public.program_coupon_redemptions(program_registration_id, scanned_at DESC);

CREATE INDEX IF NOT EXISTS idx_program_coupon_redemptions_scanner
  ON public.program_coupon_redemptions(scanner_user_id, scanned_at DESC);

CREATE INDEX IF NOT EXISTS idx_program_coupon_redemptions_scanned_code
  ON public.program_coupon_redemptions(scanned_code);

COMMENT ON TABLE public.program_coupon_redemptions IS
  'Append-only audit of successful, duplicate, rejected, and reversed coupon scan attempts.';
COMMENT ON COLUMN public.program_coupon_redemptions.reversal_of IS
  'A correction is appended as a reversed row; the original successful audit row is never edited or deleted.';

-- --------------------------------------------------------------------------
-- Row Level Security
-- --------------------------------------------------------------------------

ALTER TABLE public.program_workflow_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.program_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.program_registration_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.program_registration_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.program_coupon_redemptions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'program_workflow_configs'
      AND policyname = 'program_workflow_configs_admin_all'
  ) THEN
    CREATE POLICY program_workflow_configs_admin_all
      ON public.program_workflow_configs
      FOR ALL TO authenticated
      USING (public.is_program_workflow_admin())
      WITH CHECK (public.is_program_workflow_admin());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'program_workflow_configs'
      AND policyname = 'program_workflow_configs_authenticated_read'
  ) THEN
    CREATE POLICY program_workflow_configs_authenticated_read
      ON public.program_workflow_configs
      FOR SELECT TO authenticated
      USING (is_active);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'program_registrations'
      AND policyname = 'program_registrations_admin_all'
  ) THEN
    CREATE POLICY program_registrations_admin_all
      ON public.program_registrations
      FOR ALL TO authenticated
      USING (public.is_program_workflow_admin())
      WITH CHECK (public.is_program_workflow_admin());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'program_registrations'
      AND policyname = 'program_registrations_owner_read'
  ) THEN
    CREATE POLICY program_registrations_owner_read
      ON public.program_registrations
      FOR SELECT TO authenticated
      USING (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'program_registration_items'
      AND policyname = 'program_registration_items_admin_all'
  ) THEN
    CREATE POLICY program_registration_items_admin_all
      ON public.program_registration_items
      FOR ALL TO authenticated
      USING (public.is_program_workflow_admin())
      WITH CHECK (public.is_program_workflow_admin());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'program_registration_items'
      AND policyname = 'program_registration_items_owner_read'
  ) THEN
    CREATE POLICY program_registration_items_owner_read
      ON public.program_registration_items
      FOR SELECT TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.program_registrations AS registration
          WHERE registration.id = program_registration_items.registration_id
            AND registration.user_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'program_registration_payments'
      AND policyname = 'program_registration_payments_admin_all'
  ) THEN
    CREATE POLICY program_registration_payments_admin_all
      ON public.program_registration_payments
      FOR ALL TO authenticated
      USING (public.is_program_workflow_admin())
      WITH CHECK (public.is_program_workflow_admin());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'program_registration_payments'
      AND policyname = 'program_registration_payments_owner_read'
  ) THEN
    CREATE POLICY program_registration_payments_owner_read
      ON public.program_registration_payments
      FOR SELECT TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.program_registrations AS registration
          WHERE registration.id = program_registration_payments.registration_id
            AND registration.user_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'program_coupon_redemptions'
      AND policyname = 'program_coupon_redemptions_admin_all'
  ) THEN
    CREATE POLICY program_coupon_redemptions_admin_all
      ON public.program_coupon_redemptions
      FOR ALL TO authenticated
      USING (public.is_program_workflow_admin())
      WITH CHECK (public.is_program_workflow_admin());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'program_coupon_redemptions'
      AND policyname = 'program_coupon_redemptions_owner_read'
  ) THEN
    CREATE POLICY program_coupon_redemptions_owner_read
      ON public.program_coupon_redemptions
      FOR SELECT TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.program_registrations AS registration
          WHERE registration.id = program_coupon_redemptions.program_registration_id
            AND registration.user_id = auth.uid()
        )
      );
  END IF;
END;
$$;

-- SQL privileges are broad enough for admin policies and future SECURITY
-- DEFINER RPCs; RLS deliberately leaves normal users read-only.
GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.program_workflow_configs,
     public.program_registrations,
     public.program_registration_items,
     public.program_registration_payments,
     public.program_coupon_redemptions
  TO authenticated;

GRANT ALL
  ON public.program_workflow_configs,
     public.program_registrations,
     public.program_registration_items,
     public.program_registration_payments,
     public.program_coupon_redemptions
  TO service_role;

COMMIT;
