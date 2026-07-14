-- ============================================================
-- Migration 005: Super Admin bypass untuk daily_account
-- + Tambah super admin sebagai clinic member
-- Jalankan dalam Supabase SQL Editor
-- ============================================================

-- 1. Super admin bypass policy untuk daily_account
CREATE POLICY "Super admin full access to daily_account"
  ON daily_account FOR ALL
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- 2. Tambah super admin sebagai clinic member Klinik Pusrawi Batu Muda
--    (supaya DailyAccountPage boleh baca data dengan betul)
INSERT INTO clinic_members (user_id, clinic_id, role)
VALUES (
  'ddd9bec3-3303-4e76-9f84-6f8fdf955b16',
  'de28e5ec-b345-4979-86e8-3ca73fb87a4e',
  'admin'
)
ON CONFLICT DO NOTHING;
