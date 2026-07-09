-- Add tanggal_masuk (join date) to employees
ALTER TABLE employees ADD COLUMN IF NOT EXISTS tanggal_masuk date;

-- Add target_cutoff_date to dynamic_forms for filtering by join date
ALTER TABLE dynamic_forms ADD COLUMN IF NOT EXISTS target_cutoff_date date;

-- Add target_cutoff_date to union_programs for filtering by join date
ALTER TABLE union_programs ADD COLUMN IF NOT EXISTS target_cutoff_date date;
