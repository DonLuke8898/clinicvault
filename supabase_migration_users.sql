-- ============================================================
-- ClinicVault: User & Clinic Registration Migration
-- Jalankan keseluruhan SQL ini dalam Supabase SQL Editor
-- ============================================================

-- 1. Extend clinics table dengan maklumat penuh
ALTER TABLE clinics
  ADD COLUMN IF NOT EXISTS address  text DEFAULT '',
  ADD COLUMN IF NOT EXISTS phone    text DEFAULT '',
  ADD COLUMN IF NOT EXISTS email    text DEFAULT '',
  ADD COLUMN IF NOT EXISTS kkm_no   text DEFAULT '',
  ADD COLUMN IF NOT EXISTS ssm_no   text DEFAULT '';

-- 2. Profiles table (simpan nama & emel user, boleh diakses sesama ahli klinik)
CREATE TABLE IF NOT EXISTS profiles (
  id         uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name  text DEFAULT '',
  email      text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- User boleh baca/tulis profil sendiri
CREATE POLICY "Users manage own profile"
  ON profiles FOR ALL
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Ahli klinik yang sama boleh lihat profil antara satu sama lain
CREATE POLICY "Clinic members view same-clinic profiles"
  ON profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM clinic_members a
      JOIN clinic_members b ON a.clinic_id = b.clinic_id
      WHERE a.user_id = auth.uid()
        AND b.user_id = profiles.id
    )
  );

-- 3. Auto-create profile apabila user baru daftar
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', ''),
    COALESCE(new.email, '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 4. Invitations table (kod jemputan untuk user baru)
CREATE TABLE IF NOT EXISTS invitations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id   uuid REFERENCES clinics(id) ON DELETE CASCADE NOT NULL,
  email       text NOT NULL,
  role        text NOT NULL DEFAULT 'staff'
                CHECK (role IN ('admin', 'doctor', 'staff')),
  code        text UNIQUE NOT NULL
                DEFAULT upper(encode(gen_random_bytes(4), 'hex')),
  created_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz DEFAULT now(),
  used_at     timestamptz,
  UNIQUE (clinic_id, email)
);

ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;

-- Admin klinik boleh urus jemputan
CREATE POLICY "Clinic admins manage invitations"
  ON invitations FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM clinic_members cm
      WHERE cm.clinic_id = invitations.clinic_id
        AND cm.user_id = auth.uid()
        AND cm.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM clinic_members cm
      WHERE cm.clinic_id = invitations.clinic_id
        AND cm.user_id = auth.uid()
        AND cm.role = 'admin'
    )
  );

-- Semua orang boleh baca jemputan (untuk verify kod semasa signup)
CREATE POLICY "Public can read invitations for code verification"
  ON invitations FOR SELECT
  USING (true);

-- 5. Update role check pada clinic_members (sokong admin/doctor/staff)
DO $$
BEGIN
  -- Drop existing constraint jika ada
  ALTER TABLE clinic_members DROP CONSTRAINT IF EXISTS clinic_members_role_check;
  -- Tambah constraint baru
  ALTER TABLE clinic_members
    ADD CONSTRAINT clinic_members_role_check
    CHECK (role IN ('admin', 'doctor', 'staff'));
EXCEPTION WHEN others THEN
  -- Ignore jika gagal (constraint mungkin tidak wujud)
  NULL;
END $$;
