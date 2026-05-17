-- =====================================================
-- MIGRASI: Storage Bucket untuk Form Builder
-- =====================================================

-- 1. Buat Bucket 'program-files'
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'program-files',
    'program-files',
    true, -- Public readable
    5242880, -- 5MB
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- 2. Aktifkan RLS
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 3. Policies

-- Policy 1: PUBLIC READ (Semua orang bisa melihat gambar/form file)
DROP POLICY IF EXISTS "Public Access Program Files" ON storage.objects;
CREATE POLICY "Public Access Program Files" ON storage.objects
    FOR SELECT USING (bucket_id = 'program-files');

-- Policy 2: AUTHENTICATED UPLOAD (User hanya bisa upload jika set owner = dirinya sendiri)
DROP POLICY IF EXISTS "Authenticated Upload Program Files" ON storage.objects;
CREATE POLICY "Authenticated Upload Program Files" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'program-files' 
        AND auth.role() = 'authenticated' 
        AND auth.uid() = owner
    );

-- Policy 3: USER CAN UPDATE/DELETE OWN FILES
DROP POLICY IF EXISTS "User Update Own Program Files" ON storage.objects;
CREATE POLICY "User Update Own Program Files" ON storage.objects
    FOR UPDATE USING (
        bucket_id = 'program-files' 
        AND auth.role() = 'authenticated' 
        AND auth.uid() = owner
    );

DROP POLICY IF EXISTS "User Delete Own Program Files" ON storage.objects;
CREATE POLICY "User Delete Own Program Files" ON storage.objects
    FOR DELETE USING (
        bucket_id = 'program-files' 
        AND auth.role() = 'authenticated' 
        AND auth.uid() = owner
    );

-- Note: Saat frontend upload, client HARUS menyertakan field 'owner' dengan ID user yang login.