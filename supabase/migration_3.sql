-- ============================================================
-- migration_3.sql  –  Run this in Supabase SQL Editor
-- Fixes saves for products/services/images + adds buffer_minutes
-- ============================================================

-- 1. Add missing columns to services table
ALTER TABLE services ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'single' CHECK (kind IN ('single', 'package'));
ALTER TABLE services ADD COLUMN IF NOT EXISTS image_url TEXT;

-- 2. Add missing column to products table
ALTER TABLE products ADD COLUMN IF NOT EXISTS image_url TEXT;

-- 3. Availability table (idempotent)
CREATE TABLE IF NOT EXISTS availability (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  weekday       INTEGER NOT NULL UNIQUE CHECK (weekday BETWEEN 0 AND 6),
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  start_time    TIME NOT NULL DEFAULT '09:00',
  end_time      TIME NOT NULL DEFAULT '18:00',
  break_start_time TIME,
  break_end_time   TIME,
  slot_minutes  INTEGER NOT NULL DEFAULT 30,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Booking settings table (idempotent) + buffer_minutes
CREATE TABLE IF NOT EXISTS booking_settings (
  id                   INTEGER PRIMARY KEY DEFAULT 1,
  booking_window_days  INTEGER NOT NULL DEFAULT 30,
  min_notice_minutes   INTEGER NOT NULL DEFAULT 60,
  buffer_minutes       INTEGER NOT NULL DEFAULT 0
);
ALTER TABLE booking_settings ADD COLUMN IF NOT EXISTS buffer_minutes INTEGER NOT NULL DEFAULT 0;

-- 5. Service package items table (idempotent)
CREATE TABLE IF NOT EXISTS service_package_items (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id     UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  item_service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  UNIQUE (package_id, item_service_id)
);

-- 6. Default availability rows (Mon-Sat active, Sun off)
INSERT INTO availability (weekday, is_active, start_time, end_time, slot_minutes)
VALUES
  (0, false, '09:00', '18:00', 30),
  (1, true,  '09:00', '18:00', 30),
  (2, true,  '09:00', '18:00', 30),
  (3, true,  '09:00', '18:00', 30),
  (4, true,  '09:00', '18:00', 30),
  (5, true,  '09:00', '18:00', 30),
  (6, true,  '09:00', '14:00', 30)
ON CONFLICT (weekday) DO NOTHING;

-- 7. Default booking settings row
INSERT INTO booking_settings (id, booking_window_days, min_notice_minutes, buffer_minutes)
VALUES (1, 30, 60, 0)
ON CONFLICT (id) DO NOTHING;

-- 8. RLS on new tables
ALTER TABLE availability          ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_settings      ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_package_items ENABLE ROW LEVEL SECURITY;

-- 9. Policies (drop then recreate to be safe)
DROP POLICY IF EXISTS "admin_all" ON availability;
CREATE POLICY "admin_all" ON availability USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "admin_all" ON booking_settings;
CREATE POLICY "admin_all" ON booking_settings USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "admin_all" ON service_package_items;
CREATE POLICY "admin_all" ON service_package_items USING (is_admin()) WITH CHECK (is_admin());

-- 10. Storage bucket for images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('media', 'media', true, 5242880, ARRAY['image/jpeg','image/png','image/webp','image/gif'])
ON CONFLICT (id) DO NOTHING;

-- 11. Storage policies
DROP POLICY IF EXISTS "media_public_read"  ON storage.objects;
DROP POLICY IF EXISTS "media_admin_insert" ON storage.objects;
DROP POLICY IF EXISTS "media_admin_delete" ON storage.objects;

CREATE POLICY "media_public_read"  ON storage.objects FOR SELECT USING (bucket_id = 'media');
CREATE POLICY "media_admin_insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'media' AND is_admin());
CREATE POLICY "media_admin_delete" ON storage.objects FOR DELETE USING (bucket_id = 'media' AND is_admin());

-- 12. Fix admin profile if needed (update your user id below if role is missing)
-- UPDATE profiles SET role = 'admin' WHERE id = auth.uid();
-- Or run: UPDATE profiles SET role = 'admin';  (if there's only one user)
