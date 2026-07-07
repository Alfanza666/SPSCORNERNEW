-- Migration 004: Add image field support, target_niks & target_departments to dynamic_forms
-- Add target_departments to union_programs

-- 1. Add target columns to dynamic_forms
ALTER TABLE dynamic_forms
  ADD COLUMN IF NOT EXISTS target_niks text[] DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS target_departments text[] DEFAULT NULL;

-- 2. Add target_departments to union_programs
ALTER TABLE union_programs
  ADD COLUMN IF NOT EXISTS target_departments text[] DEFAULT NULL;
