-- ════════════════════════════════════════════════════════════════
-- RPC: create_manual_coupon_v2
-- Membuat kupon/tiket manual dengan tipe yang bisa diatur
-- TIDAK mengubah RPC lama (generate_manual_coupon)
-- TIDAK mengubah data kupon yang sudah ada
-- ════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION create_manual_coupon_v2(
  p_program_id UUID,
  p_nik TEXT,
  p_name TEXT,
  p_gate_type TEXT DEFAULT 'attendance',
  p_creator_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_coupon_id UUID;
  v_coupon_code TEXT;
  v_prefix TEXT;
  v_existing_id UUID;
BEGIN
  -- Validasi gate_type yang diizinkan
  IF p_gate_type NOT IN ('attendance', 'meal', 'doorprize', 'sembako', 'attendance_family', 'meal_family') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Tipe kupon tidak valid. Pilih: attendance, meal, doorprize, sembako, attendance_family, meal_family'
    );
  END IF;

  -- Cek apakah NIK + program + tipe sudah ada (hindari duplikat)
  SELECT id INTO v_existing_id
  FROM program_coupons
  WHERE program_id = p_program_id
    AND nik = p_nik
    AND (gate_type = p_gate_type OR coupon_type = p_gate_type)
    AND status != 'expired'
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Kupon dengan NIK dan tipe ini sudah ada untuk program ini.'
    );
  END IF;

  -- Generate coupon code berdasarkan tipe
  v_prefix := CASE p_gate_type
    WHEN 'attendance' THEN 'ATT-MNL'
    WHEN 'meal' THEN 'MEAL-MNL'
    WHEN 'doorprize' THEN 'DRW-MNL'
    WHEN 'sembako' THEN 'SMB-MNL'
    WHEN 'attendance_family' THEN 'ATF-MNL'
    WHEN 'meal_family' THEN 'MLF-MNL'
    ELSE 'TKT-MNL'
  END;
  v_coupon_code := v_prefix || '-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 8));

  -- Insert kupon baru
  INSERT INTO program_coupons (
    program_id,
    nik,
    name,
    coupon_code,
    gate_type,
    coupon_type,
    status,
    beneficiary_type,
    entitlement_code,
    metadata,
    created_at
  ) VALUES (
    p_program_id,
    p_nik,
    p_name,
    v_coupon_code,
    p_gate_type,
    p_gate_type,
    'active',
    CASE 
      WHEN p_gate_type LIKE '%_family' THEN 'family'
      ELSE 'employee'
    END,
    CASE p_gate_type
      WHEN 'attendance' THEN 'employee_attendance'
      WHEN 'meal' THEN 'employee_meal'
      WHEN 'attendance_family' THEN 'family_attendance'
      WHEN 'meal_family' THEN 'family_meal'
      ELSE p_gate_type
    END,
    jsonb_build_object(
      'manual', true,
      'created_by', p_creator_id,
      'created_at', NOW()
    ),
    NOW()
  )
  RETURNING id INTO v_coupon_id;

  RETURN jsonb_build_object(
    'success', true,
    'coupon_id', v_coupon_id,
    'coupon_code', v_coupon_code,
    'gate_type', p_gate_type,
    'message', 'Kupon ' || p_gate_type || ' berhasil dibuat untuk ' || p_name
  );
END;
$$;

-- Grant execute ke service role
GRANT EXECUTE ON FUNCTION create_manual_coupon_v2(UUID, TEXT, TEXT, TEXT, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION create_manual_coupon_v2(UUID, TEXT, TEXT, TEXT, UUID) TO authenticated;
