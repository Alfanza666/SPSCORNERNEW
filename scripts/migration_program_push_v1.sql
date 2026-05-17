-- =====================================================
-- MIGRASI: Program Serikat Push Method v1.0
-- Fungsi: Auto-generate kupon, Multi-gate, Doorprize
-- =====================================================

-- 1. Tambah kolom baru di union_programs untuk konfigurasi gates
ALTER TABLE union_programs 
ADD COLUMN IF NOT EXISTS gate_1_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS gate_2_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS auto_generate_food BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS auto_generate_doorprize BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS food_coupon_prefix VARCHAR(20) DEFAULT 'FOOD',
ADD COLUMN IF NOT EXISTS doorprize_coupon_prefix VARCHAR(20) DEFAULT 'DOOR',
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- 2. Buat tabel program_coupons (Kupon per participant)
CREATE TABLE IF NOT EXISTS program_coupons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    program_id UUID REFERENCES union_programs(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    nik VARCHAR(50),
    name VARCHAR(255) NOT NULL,
    qr_code VARCHAR(100) UNIQUE NOT NULL,
    barcode VARCHAR(100) UNIQUE NOT NULL,
    coupon_type VARCHAR(50) DEFAULT 'attendance', -- 'attendance', 'food', 'doorprize', 'manual'
    status VARCHAR(20) DEFAULT 'active', -- 'active', 'claimed', 'expired'
    parent_coupon_id UUID REFERENCES program_coupons(id), -- untuk kupon turunan (food/doorprize)
    claimed_at TIMESTAMPTZ,
    scanned_by UUID REFERENCES auth.users(id),
    generated_at TIMESTAMPTZ DEFAULT now(),
    is_remote BOOLEAN DEFAULT false, -- untuk bypass kehadiran
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Index untuk pencarian cepat
CREATE INDEX IF NOT EXISTS idx_program_coupons_program ON program_coupons(program_id);
CREATE INDEX IF NOT EXISTS idx_program_coupons_qr ON program_coupons(qr_code);
CREATE INDEX IF NOT EXISTS idx_program_coupons_barcode ON program_coupons(barcode);
CREATE INDEX IF NOT EXISTS idx_program_coupons_nik ON program_coupons(nik);
CREATE INDEX IF NOT EXISTS idx_program_coupons_user ON program_coupons(user_id);
CREATE INDEX IF NOT EXISTS idx_program_coupons_status ON program_coupons(status);

-- 3. Buat tabel program_doorprize_log (Log pemenang)
CREATE TABLE IF NOT EXISTS program_doorprize_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    program_id UUID REFERENCES union_programs(id) ON DELETE CASCADE,
    coupon_id UUID REFERENCES program_coupons(id),
    winner_name VARCHAR(255) NOT NULL,
    winner_nik VARCHAR(50),
    winner_user_id UUID REFERENCES auth.users(id),
    prize_name VARCHAR(255) NOT NULL,
    draw_sequence INT,
    drawn_at TIMESTAMPTZ DEFAULT now(),
    drawn_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_doorprize_log_program ON program_doorprize_log(program_id);

-- 4. Update program_eligibility - tambah link ke coupon
ALTER TABLE program_eligibility
ADD COLUMN IF NOT EXISTS coupon_id UUID REFERENCES program_coupons(id),
ADD COLUMN IF NOT EXISTS qr_code VARCHAR(100),
ADD COLUMN IF NOT EXISTS barcode VARCHAR(100),
ADD COLUMN IF NOT EXISTS is_remote BOOLEAN DEFAULT false;

-- 5. Enable RLS
ALTER TABLE program_coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE program_doorprize_log ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies untuk program_coupons
-- Admin bisa lihat semua
CREATE POLICY "Admin full access coupons" ON program_coupons
    FOR ALL USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin'))
    );

-- User bisa lihat kupon sendiri
CREATE POLICY "User sees own coupons" ON program_coupons
    FOR SELECT USING (user_id = auth.uid());

-- 7. RLS Policies untuk program_doorprize_log
CREATE POLICY "Admin full access doorprize" ON program_doorprize_log
    FOR ALL USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin'))
    );

-- 8. Function: Auto-generate coupons from eligibility
CREATE OR REPLACE FUNCTION generate_program_coupons(
    p_program_id UUID,
    p_coupon_type VARCHAR DEFAULT 'attendance',
    p_prefix VARCHAR DEFAULT 'ATT'
)
RETURNS INT AS $$
DECLARE
    v_count INT := 0;
    v_eligibility RECORD;
    v_qr_code VARCHAR;
    v_barcode VARCHAR;
    v_coupon_id UUID;
BEGIN
    FOR v_eligibility IN 
        SELECT pe.nik, p.name as profile_name, pe.id as eligibility_id
        FROM program_eligibility pe
        LEFT JOIN profiles p ON pe.nik = p.nik
        WHERE pe.program_id = p_program_id
        AND pe.coupon_id IS NULL
    LOOP
        -- Generate unique QR and Barcode
        v_qr_code := p_prefix || '-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT), 1, 8));
        v_barcode := p_prefix || '-' || LPAD(v_eligibility.eligibility_id::TEXT, 8, '0');
        
        INSERT INTO program_coupons (
            program_id,
            user_id,
            nik,
            name,
            qr_code,
            barcode,
            coupon_type,
            status
        ) VALUES (
            p_program_id,
            (SELECT id FROM profiles WHERE nik = v_eligibility.nik LIMIT 1),
            v_eligibility.nik,
            COALESCE(v_eligibility.profile_name, 'Unknown'),
            v_qr_code,
            v_barcode,
            p_coupon_type,
            'active'
        )
        RETURNING id INTO v_coupon_id;
        
        -- Update eligibility with coupon reference
        UPDATE program_eligibility 
        SET coupon_id = v_coupon_id, qr_code = v_qr_code, barcode = v_barcode
        WHERE id = v_eligibility.eligibility_id;
        
        v_count := v_count + 1;
    END LOOP;
    
    RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- 9. Function: Claim coupon (scan)
CREATE OR REPLACE FUNCTION claim_program_coupon(
    p_qr_code VARCHAR,
    p_scanner_user_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_coupon RECORD;
    v_result JSONB;
    v_program RECORD;
    v_new_food_coupon_id UUID;
    v_new_doorprize_coupon_id UUID;
BEGIN
    -- Find coupon
    SELECT pc.*, up.name as program_name, up.gate_1_enabled, up.gate_2_enabled, 
           up.auto_generate_food, up.auto_generate_doorprize,
           up.food_coupon_prefix, up.doorprize_coupon_prefix
    INTO v_coupon
    FROM program_coupons pc
    JOIN union_programs up ON pc.program_id = up.id
    WHERE pc.qr_code = p_qr_code OR pc.barcode = p_qr_code;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Kupon tidak ditemukan');
    END IF;
    
    -- Check if already claimed
    IF v_coupon.status = 'claimed' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Kupon sudah digunakan pada ' || v_coupon.claimed_at);
    END IF;
    
    IF v_coupon.status = 'expired' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Kupon sudah expired');
    END IF;
    
    -- Claim the coupon
    UPDATE program_coupons 
    SET status = 'claimed', claimed_at = now(), scanned_by = p_scanner_user_id
    WHERE id = v_coupon.id;
    
    v_result := jsonb_build_object(
        'success', true,
        'coupon_type', v_coupon.coupon_type,
        'participant_name', v_coupon.name,
        'participant_nik', v_coupon.nik,
        'program_name', v_coupon.program_name,
        'claimed_at', now()
    );
    
    -- Auto-generate Gate 2 coupons if enabled
    IF v_coupon.coupon_type = 'attendance' AND v_coupon.gate_2_enabled THEN
        -- Generate Food Coupon
        IF v_coupon.auto_generate_food THEN
            INSERT INTO program_coupons (
                program_id, user_id, nik, name, 
                qr_code, barcode, coupon_type, status, parent_coupon_id
            ) VALUES (
                v_coupon.program_id, v_coupon.user_id, v_coupon.nik, v_coupon.name,
                v_coupon.food_coupon_prefix || '-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT), 1, 8)),
                v_coupon.food_coupon_prefix || '-' || LPAD(v_coupon.id::TEXT, 8, '0'),
                'food', 'active', v_coupon.id
            ) RETURNING id INTO v_new_food_coupon_id;
            
            v_result := v_result || jsonb_build_object('food_coupon_generated', true);
        END IF;
        
        -- Generate Doorprize Coupon
        IF v_coupon.auto_generate_doorprize THEN
            INSERT INTO program_coupons (
                program_id, user_id, nik, name,
                qr_code, barcode, coupon_type, status, parent_coupon_id
            ) VALUES (
                v_coupon.program_id, v_coupon.user_id, v_coupon.nik, v_coupon.name,
                v_coupon.doorprize_coupon_prefix || '-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT), 1, 8)),
                v_coupon.doorprize_coupon_prefix || '-' || LPAD(v_coupon.id::TEXT, 8, '0'),
                'doorprize', 'active', v_coupon.id
            ) RETURNING id INTO v_new_doorprize_coupon_id;
            
            v_result := v_result || jsonb_build_object('doorprize_coupon_generated', true);
        END IF;
    END IF;
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- 10. Function: Bypass attendance (remote doorprize)
CREATE OR REPLACE FUNCTION bypass_attendance_coupon(
    p_program_id UUID,
    p_nik VARCHAR,
    p_scanner_user_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_coupon_id UUID;
    v_coupon RECORD;
    v_program RECORD;
BEGIN
    -- Get program config
    SELECT * INTO v_program FROM union_programs WHERE id = p_program_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Program tidak ditemukan');
    END IF;
    
    IF NOT v_program.auto_generate_doorprize THEN
        RETURN jsonb_build_object('success', false, 'error', 'Doorprize tidak diaktifkan untuk program ini');
    END IF;
    
    -- Create remote attendance coupon (claimed immediately)
    INSERT INTO program_coupons (
        program_id, nik, name, qr_code, barcode,
        coupon_type, status, claimed_at, scanned_by, is_remote
    ) VALUES (
        p_program_id, p_nik, p_nik,
        'REMOTE-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT), 1, 8)),
        'REMOTE-' || LPAD(EXTRACT(EPOCH FROM now())::TEXT, 12, '0'),
        'attendance', 'claimed', now(), p_scanner_user_id, true
    )
    RETURNING id INTO v_coupon_id;
    
    -- Create doorprize coupon
    INSERT INTO program_coupons (
        program_id, nik, name, qr_code, barcode,
        coupon_type, status, parent_coupon_id, is_remote
    ) VALUES (
        p_program_id, p_nik, p_nik,
        v_program.doorprize_coupon_prefix || '-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT), 1, 8)),
        v_program.doorprize_coupon_prefix || '-' || LPAD(v_coupon_id::TEXT, 8, '0'),
        'doorprize', 'active', v_coupon_id, true
    );
    
    RETURN jsonb_build_object(
        'success', true, 
        'message', 'Remote doorprize diaktifkan',
        'coupon_id', v_coupon_id
    );
END;
$$ LANGUAGE plpgsql;

-- 11. Function: Draw doorprize winner
CREATE OR REPLACE FUNCTION draw_doorprize_winner(
    p_program_id UUID,
    p_prize_name VARCHAR,
    p_drawer_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_coupon RECORD;
    v_winner_id UUID;
BEGIN
    -- Get random active doorprize coupon (claimed attendance but not won yet)
    SELECT * INTO v_coupon
    FROM program_coupons
    WHERE program_id = p_program_id
    AND coupon_type = 'doorprize'
    AND status = 'active'
    AND is_remote = false
    AND parent_coupon_id IN (
        SELECT id FROM program_coupons 
        WHERE program_id = p_program_id AND coupon_type = 'attendance' AND status = 'claimed'
    )
    ORDER BY RANDOM()
    LIMIT 1;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Tidak ada kupon doorprize yang valid');
    END IF;
    
    -- Update coupon to claimed (won)
    UPDATE program_coupons SET status = 'claimed', claimed_at = now(), scanned_by = p_drawer_id
    WHERE id = v_coupon.id;
    
    -- Log the winner
    INSERT INTO program_doorprize_log (
        program_id, coupon_id, winner_name, winner_nik, winner_user_id, 
        prize_name, draw_sequence, drawn_by
    ) VALUES (
        p_program_id, v_coupon.id, v_coupon.name, v_coupon.nik, v_coupon.user_id,
        p_prize_name, 
        (SELECT COALESCE(MAX(draw_sequence), 0) + 1 FROM program_doorprize_log WHERE program_id = p_program_id),
        p_drawer_id
    );
    
    RETURN jsonb_build_object(
        'success', true,
        'winner_name', v_coupon.name,
        'winner_nik', v_coupon.nik,
        'prize', p_prize_name,
        'coupon_code', v_coupon.qr_code
    );
END;
$$ LANGUAGE plpgsql;

-- 12. Function: Generate manual coupon (external)
CREATE OR REPLACE FUNCTION generate_manual_coupon(
    p_program_id UUID,
    p_nik VARCHAR,
    p_name VARCHAR,
    p_creator_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_qr_code VARCHAR;
    v_barcode VARCHAR;
    v_coupon_id UUID;
BEGIN
    v_qr_code := 'MANUAL-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT), 1, 8));
    v_barcode := 'MANUAL-' || LPAD(EXTRACT(EPOCH FROM now())::TEXT, 12, '0');
    
    INSERT INTO program_coupons (
        program_id, nik, name, qr_code, barcode,
        coupon_type, status, metadata
    ) VALUES (
        p_program_id, p_nik, p_name, v_qr_code, v_barcode,
        'manual', 'active', jsonb_build_object('created_by', p_creator_id, 'created_at', now())
    )
    RETURNING id INTO v_coupon_id;
    
    RETURN jsonb_build_object(
        'success', true,
        'coupon_id', v_coupon_id,
        'qr_code', v_qr_code,
        'barcode', v_barcode,
        'name', p_name,
        'nik', p_nik
    );
END;
$$ LANGUAGE plpgsql;

DO $$ 
BEGIN 
    RAISE NOTICE 'Migration completed successfully!';
END $$;