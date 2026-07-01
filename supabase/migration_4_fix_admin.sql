-- ============================================================
-- migration_4_fix_admin.sql  –  Run this in Supabase SQL Editor
-- Fixes: admin profile, storage policy, auto-profile trigger
-- ============================================================

-- 1. Ensure every existing auth user has a profile with role = 'admin'
--    (safe to run multiple times - only updates, no data loss)
INSERT INTO public.profiles (id, full_name, role)
SELECT
  id,
  COALESCE(raw_user_meta_data->>'full_name', email, 'Admin') AS full_name,
  'admin' AS role
FROM auth.users
ON CONFLICT (id) DO UPDATE SET role = 'admin';

-- 2. Auto-create profile for future users (trigger)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', new.email, 'Admin'),
    'admin'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 3. Simplify storage policies (remove dependency on is_admin() for storage)
--    Only authenticated users can upload (the admin is the only auth user anyway)
DROP POLICY IF EXISTS "media_public_read"  ON storage.objects;
DROP POLICY IF EXISTS "media_admin_insert" ON storage.objects;
DROP POLICY IF EXISTS "media_admin_delete" ON storage.objects;
DROP POLICY IF EXISTS "public_read"        ON storage.objects;
DROP POLICY IF EXISTS "admin_upload"       ON storage.objects;
DROP POLICY IF EXISTS "admin_delete"       ON storage.objects;

CREATE POLICY "media_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'media');

CREATE POLICY "media_auth_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'media' AND auth.role() = 'authenticated');

CREATE POLICY "media_auth_update"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'media' AND auth.role() = 'authenticated');

CREATE POLICY "media_auth_delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'media' AND auth.role() = 'authenticated');

-- 4. Verify (you should see your user with role='admin')
SELECT id, full_name, role FROM profiles;
