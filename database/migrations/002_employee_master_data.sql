-- ============================================
-- Migration 002: Employee Master Data
-- Version: v5.3.0
-- Deskripsi: Tabel master data karyawan (NIK, Nama, Departemen)
-- untuk auto-sync nama profil & filtering departemen
-- ============================================

CREATE TABLE IF NOT EXISTS employees (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  nik text UNIQUE NOT NULL,
  name text NOT NULL,
  department text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Trigger untuk auto-update updated_at
CREATE OR REPLACE FUNCTION update_employees_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_employees_updated_at ON employees;
CREATE TRIGGER trg_employees_updated_at
  BEFORE UPDATE ON employees
  FOR EACH ROW
  EXECUTE FUNCTION update_employees_updated_at();

-- RLS
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;

-- Admin & superadmin: full CRUD
CREATE POLICY "admin_full_access" ON employees
  FOR ALL USING (
    auth.uid() IN (
      SELECT id FROM profiles WHERE role IN ('admin', 'superadmin')
    )
  );

-- Semua user terautentikasi: bisa baca (untuk lookup NIK)
CREATE POLICY "authenticated_read" ON employees
  FOR SELECT USING (auth.role() = 'authenticated');
