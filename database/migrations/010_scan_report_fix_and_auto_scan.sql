-- Migration 010: Scan Report Fix + Auto-Scan RPC
-- Fixes:
-- 1. Retroactive: fill claimed_at from scanned_at for V2-scanned coupons
-- 2. Update scan_entitlement_v2 to set claimed_at
-- 3. New scan_entitlement_auto RPC (no program_id/gate required)

-- =========================================================================
-- 1. RETROACTIVE DATA FIX: fill claimed_at where NULL
-- =========================================================================
-- This ensures all historical scan data appears in AdminCouponReports
-- which filters by claimed_at. Data is preserved, only a NULL column is filled.

UPDATE public.program_coupons
SET claimed_at = scanned_at
WHERE status = 'claimed'
  AND scanned_at IS NOT NULL
  AND claimed_at IS NULL;

-- =========================================================================
-- 2. UPDATE scan_entitlement_v2: also set claimed_at
-- =========================================================================
-- The V2 scanner sets scanned_at but not claimed_at.
-- AdminCouponReports queries by claimed_at, so scans were invisible.

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
    SET status = 'claimed', scanned_at = now(), claimed_at = now(), scanned_by = p_scanner_user_id
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
  'Gate/program-aware scan with append-only audit. Now also sets claimed_at. Returns scan result with entitlement details.';

-- =========================================================================
-- 3. NEW RPC: scan_entitlement_auto
-- Auto-detect program and gate from scanned code.
-- Admin only needs to scan — no manual program/gate selection.
-- =========================================================================

CREATE OR REPLACE FUNCTION public.scan_entitlement_auto(
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
  v_program_name text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = p_scanner_user_id AND role IN ('admin', 'superadmin')
  ) THEN
    RAISE EXCEPTION 'Unauthorized: admin role required';
  END IF;

  -- Find coupon by code across ALL programs
  SELECT pc.*, up.name AS program_name_found
  INTO v_coupon
  FROM public.program_coupons pc
  LEFT JOIN public.union_programs up ON up.id = pc.program_id
  WHERE pc.coupon_code = p_scanned_code
  LIMIT 1
  FOR UPDATE OF pc;

  IF NOT FOUND THEN
    v_scan_result := 'rejected';
    v_failure_reason := 'Kode tidak ditemukan';
  ELSE
    v_program_name := v_coupon.program_name_found;

    -- Auto-detect gate from coupon data
    v_expected_gate := CASE
      WHEN v_coupon.entitlement_code IN ('employee_attendance', 'family_attendance', 'attendance')
        OR v_coupon.gate_type IN ('attendance', 'attendance_family') THEN 'attendance'
      WHEN v_coupon.entitlement_code IN ('employee_meal', 'family_meal', 'meal')
        OR v_coupon.gate_type IN ('meal', 'meal_family', 'food') THEN 'meal'
      ELSE NULL
    END;

    IF v_expected_gate IS NULL THEN
      v_scan_result := 'rejected';
      v_failure_reason := 'Jenis tiket tidak dikenali';
    ELSIF (
      v_coupon.status = 'claimed' OR EXISTS (
        SELECT 1 FROM public.program_coupon_redemptions
        WHERE coupon_id = v_coupon.id
          AND scan_result = 'success'
      )
    ) THEN
      v_scan_result := 'duplicate';
      v_failure_reason := 'Kode sudah di-scan sebelumnya';
    ELSIF v_coupon.status <> 'active' THEN
      v_scan_result := 'rejected';
      v_failure_reason := 'Tiket tidak aktif (status: ' || v_coupon.status || ')';
    ELSE
      v_scan_result := 'success';
      UPDATE public.program_coupons
      SET status = 'claimed', scanned_at = now(), claimed_at = now(), scanned_by = p_scanner_user_id
      WHERE id = v_coupon.id;
    END IF;

    -- Always insert audit record
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
      v_coupon.program_id,
      'token-hash:' || md5(p_scanned_code),
      v_coupon.entitlement_code,
      v_expected_gate,
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
    'gate', v_expected_gate,
    'program_id', v_coupon.program_id,
    'program_name', v_program_name
  );
END;
$$;

COMMENT ON FUNCTION public.scan_entitlement_auto(text, uuid) IS
  'Auto-detect scan: finds coupon by code across all programs, auto-detects gate type. Admin only needs to scan the QR.';
