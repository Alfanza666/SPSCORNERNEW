-- ============================================================
-- SPS Corner Moments — Database Schema
-- CREATED: 2026-08-15
-- NOTE: ADDITIVE ONLY — NO existing tables affected
-- ============================================================

-- 1. Tabel Events
CREATE TABLE IF NOT EXISTS moments_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL DEFAULT 'Employee Gathering 2026',
  subtitle TEXT DEFAULT 'FORWARD AS ONE',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Tabel Frames
CREATE TABLE IF NOT EXISTS moments_frames (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES moments_events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  image_url TEXT NOT NULL,
  source TEXT DEFAULT 'admin' CHECK (source IN ('admin', 'ai')),
  prompt_used TEXT,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Tabel Photos
CREATE TABLE IF NOT EXISTS moments_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES moments_events(id) ON DELETE SET NULL,
  frame_id UUID REFERENCES moments_frames(id) ON DELETE SET NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  photo_raw TEXT NOT NULL,
  photo_final TEXT NOT NULL,
  device_info JSONB DEFAULT '{}',
  likes INTEGER DEFAULT 0,
  is_featured BOOLEAN DEFAULT false,
  is_hidden BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Indexes untuk performa
CREATE INDEX IF NOT EXISTS idx_moments_photos_event ON moments_photos(event_id);
CREATE INDEX IF NOT EXISTS idx_moments_photos_created ON moments_photos(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_moments_photos_featured ON moments_photos(is_featured) WHERE is_featured = true;
CREATE INDEX IF NOT EXISTS idx_moments_photos_hidden ON moments_photos(is_hidden);
CREATE INDEX IF NOT EXISTS idx_moments_frames_event ON moments_frames(event_id);

-- 5. RLS Policies
ALTER TABLE moments_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE moments_frames ENABLE ROW LEVEL SECURITY;
ALTER TABLE moments_photos ENABLE ROW LEVEL SECURITY;

-- Public read access untuk events dan frames (camera butuh akses tanpa login)
CREATE POLICY "moments_events_public_read" ON moments_events
  FOR SELECT USING (true);

CREATE POLICY "moments_frames_public_read" ON moments_frames
  FOR SELECT USING (true);

-- Public insert untuk photos (user bisa foto tanpa login)
CREATE POLICY "moments_photos_public_insert" ON moments_photos
  FOR INSERT WITH CHECK (true);

-- Public read untuk photos yang tidak hidden
CREATE POLICY "moments_photos_public_read" ON moments_photos
  FOR SELECT USING (is_hidden = false);

-- Authenticated users bisa read semua photos termasuk hidden (untuk gallery)
CREATE POLICY "moments_photos_auth_read" ON moments_photos
  FOR SELECT USING (auth.role() = 'authenticated');

-- Admin bisa manage semua
CREATE POLICY "moments_events_admin_all" ON moments_events
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'superadmin'))
  );

CREATE POLICY "moments_frames_admin_all" ON moments_frames
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'superadmin'))
  );

CREATE POLICY "moments_photos_admin_all" ON moments_photos
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'superadmin'))
  );

-- 6. Insert default event
INSERT INTO moments_events (name, subtitle, is_active)
VALUES ('Employee Gathering 2026', 'FORWARD AS ONE', true)
ON CONFLICT DO NOTHING;

-- 7. Trigger untuk update updated_at
CREATE OR REPLACE FUNCTION update_moments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER moments_events_updated_at
  BEFORE UPDATE ON moments_events
  FOR EACH ROW
  EXECUTE FUNCTION update_moments_updated_at();

-- ============================================================
-- STORAGE BUCKET: moments
-- Jalankan manual di Supabase Dashboard > Storage > New Bucket
-- Name: moments
-- Public: true
-- File size limit: 10MB
-- Allowed MIME types: image/png, image/jpeg, image/webp
-- ============================================================
