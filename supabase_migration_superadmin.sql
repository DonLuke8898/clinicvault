-- ============================================================
-- ClinicVault: Super Admin Migration
-- Jalankan dalam Supabase SQL Editor
-- ============================================================

-- 1. Super Admins table
CREATE TABLE IF NOT EXISTS super_admins (
  user_id    uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE super_admins ENABLE ROW LEVEL SECURITY;

-- Super admin boleh baca jadual ini (untuk self-check)
CREATE POLICY "Super admins can read their own record"
  ON super_admins FOR SELECT
  USING (auth.uid() = user_id);

-- 2. Helper function - semak sama ada user adalah super admin
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.super_admins
    WHERE user_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 3. RLS policies untuk Super Admin - bypass semua restrictions
-- Super admin boleh akses SEMUA data merentas semua klinik

-- clinics
CREATE POLICY "Super admin full access to clinics"
  ON clinics FOR ALL
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- income
CREATE POLICY "Super admin full access to income"
  ON income FOR ALL
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- expense
CREATE POLICY "Super admin full access to expense"
  ON expense FOR ALL
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- panel
CREATE POLICY "Super admin full access to panel"
  ON panel FOR ALL
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- documents
CREATE POLICY "Super admin full access to documents"
  ON documents FOR ALL
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- clinic_members
CREATE POLICY "Super admin full access to clinic_members"
  ON clinic_members FOR ALL
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- profiles
CREATE POLICY "Super admin full access to profiles"
  ON profiles FOR ALL
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- invitations
CREATE POLICY "Super admin full access to invitations"
  ON invitations FOR ALL
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- ============================================================
-- IMPORTANT: Selepas jalankan SQL ini, masukkan user_id anda
-- sebagai Super Admin dengan query berikut:
--
-- INSERT INTO super_admins (user_id)
-- VALUES ('<YOUR_USER_ID_HERE>');
--
-- Untuk dapatkan user_id anda:
-- SELECT id FROM auth.users WHERE email = 'your@email.com';
-- ============================================================
