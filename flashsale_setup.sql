-- FLASH SALE STABILIZATION & STORAGE SETUP
-- Run this in Supabase SQL Editor

-- 1. Create sps_assets table if not exists
CREATE TABLE IF NOT EXISTS public.sps_assets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    description TEXT,
    estimated_price DECIMAL NOT NULL,
    image_url TEXT,
    status TEXT DEFAULT 'open' CHECK (status IN ('open', 'sold')),
    winner_id UUID REFERENCES public.profiles(id),
    final_price DECIMAL,
    start_time TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Memastikan kolom baru ada jika tabel sudah terlanjur dibuat sebelumnya
ALTER TABLE public.sps_assets ADD COLUMN IF NOT EXISTS start_time TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());
ALTER TABLE public.sps_assets ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE public.sps_assets ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'open';
ALTER TABLE public.sps_assets ADD COLUMN IF NOT EXISTS winner_id UUID REFERENCES public.profiles(id);
ALTER TABLE public.sps_assets ADD COLUMN IF NOT EXISTS final_price DECIMAL;

-- Ensure constraint is correct
DO $$ 
BEGIN 
    ALTER TABLE public.sps_assets DROP CONSTRAINT IF EXISTS sps_assets_status_check;
    ALTER TABLE public.sps_assets ADD CONSTRAINT sps_assets_status_check CHECK (status IN ('open', 'sold'));
EXCEPTION WHEN OTHERS THEN 
    NULL; 
END $$;

-- 2. Create asset_bookings table if not exists
CREATE TABLE IF NOT EXISTS public.asset_bookings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    asset_id UUID REFERENCES public.sps_assets(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id),
    booking_time TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'won', 'lost')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 3. Enable RLS
ALTER TABLE public.sps_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_bookings ENABLE ROW LEVEL SECURITY;

-- 4. Policies for sps_assets
DROP POLICY IF EXISTS "Anyone can view assets" ON public.sps_assets;
CREATE POLICY "Anyone can view assets" ON public.sps_assets FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can manage assets" ON public.sps_assets;
CREATE POLICY "Admins can manage assets" ON public.sps_assets 
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND (role = 'admin' OR role = 'superadmin')
    )
) WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND (role = 'admin' OR role = 'superadmin')
    )
);

-- 5. Policies for asset_bookings
DROP POLICY IF EXISTS "Users can view own bookings" ON public.asset_bookings;
CREATE POLICY "Users can view own bookings" ON public.asset_bookings FOR SELECT USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND (role = 'admin' OR role = 'superadmin')));

DROP POLICY IF EXISTS "Users can create bookings" ON public.asset_bookings;
CREATE POLICY "Users can create bookings" ON public.asset_bookings FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can update bookings" ON public.asset_bookings;
CREATE POLICY "Admins can update bookings" ON public.asset_bookings FOR UPDATE USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND (role = 'admin' OR role = 'superadmin')));

-- 6. Storage Bucket Setup for 'flashsale'
-- Note: If this fails, create manually in Supabase Storage with name 'flashsale' and public=true
INSERT INTO storage.buckets (id, name, public) 
VALUES ('flashsale', 'flashsale', true)
ON CONFLICT (id) DO NOTHING;

-- 7. Storage Policies for 'flashsale'
DROP POLICY IF EXISTS "Flashsale public view" ON storage.objects;
CREATE POLICY "Flashsale public view" ON storage.objects FOR SELECT USING (bucket_id = 'flashsale');

DROP POLICY IF EXISTS "Admins can upload flashsale images" ON storage.objects;
CREATE POLICY "Admins can upload flashsale images" ON storage.objects FOR INSERT WITH CHECK (
    bucket_id = 'flashsale' AND 
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND (role = 'admin' OR role = 'superadmin'))
);
