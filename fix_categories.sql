-- SQL to Fix Categories Table (RLS & Missing Column)
-- Run this in Supabase SQL Editor

-- 1. Ensure slug column exists
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS slug TEXT;

-- 2. Enable RLS
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- 3. Drop existing policies to prevent conflicts
DROP POLICY IF EXISTS "Categories are viewable by everyone" ON public.categories;
DROP POLICY IF EXISTS "Admins can insert categories" ON public.categories;
DROP POLICY IF EXISTS "Admins can update categories" ON public.categories;
DROP POLICY IF EXISTS "Admins can delete categories" ON public.categories;

-- 4. Create new policies
-- Public view access
CREATE POLICY "Categories are viewable by everyone" 
ON public.categories FOR SELECT 
USING (true);

-- Admin management access
CREATE POLICY "Admins can insert categories" 
ON public.categories FOR INSERT 
WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update categories" 
ON public.categories FOR UPDATE 
USING (public.is_admin());

CREATE POLICY "Admins can delete categories" 
ON public.categories FOR DELETE 
USING (public.is_admin());

-- 5. Backfill slugs if any exist without it
UPDATE public.categories 
SET slug = LOWER(REPLACE(name, ' ', '-')) 
WHERE slug IS NULL;
