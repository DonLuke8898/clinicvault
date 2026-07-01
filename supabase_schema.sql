-- ============================================================
-- ClinicVault — Supabase PostgreSQL Schema
-- Fasa 1: Setup Database
-- Jalankan keseluruhan script ini dalam Supabase SQL Editor
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";


-- ============================================================
-- 1. CLINICS — satu rekod per klinik
-- ============================================================
create table if not exists clinics (
  id            uuid primary key default uuid_generate_v4(),
  name          text not null,
  ssm           text,
  sst_no        text,
  sst_enabled   boolean default false,
  tax_rate      numeric default 24,
  created_at    timestamptz default now()
);


-- ============================================================
-- 2. PROFILES — sambungan kepada Supabase Auth user
-- ============================================================
create table if not exists profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  full_name     text,
  role          text default 'staff',   -- 'admin' | 'staff'
  created_at    timestamptz default now()
);

-- Auto-create profile bila user baru daftar
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();


-- ============================================================
-- 3. CLINIC_MEMBERS — hubungan user ↔ klinik
-- ============================================================
create table if not exists clinic_members (
  id            uuid primary key default uuid_generate_v4(),
  clinic_id     uuid references clinics(id) on delete cascade,
  user_id       uuid references profiles(id) on delete cascade,
  role          text default 'staff',   -- 'admin' | 'staff'
  created_at    timestamptz default now(),
  unique(clinic_id, user_id)
);


-- ============================================================
-- 4. INCOME — rekod pendapatan
-- ============================================================
create table if not exists income (
  id            uuid primary key default uuid_generate_v4(),
  clinic_id     uuid references clinics(id) on delete cascade,
  date          date not null,
  pay_type      text not null,   -- cash|panel|debit|qr|spay|tng|atome|transfer
  description   text not null,
  amt           numeric not null check (amt > 0),
  cat           text,            -- consultation|medication|procedure|panel|lab|other
  ref           text,
  notes         text,
  file_name     text,
  file_type     text,
  file_data     text,            -- base64 (migrate ke Supabase Storage kemudian)
  created_at    timestamptz default now(),
  created_by    uuid references profiles(id)
);


-- ============================================================
-- 5. EXPENSE — rekod perbelanjaan
-- ============================================================
create table if not exists expense (
  id            uuid primary key default uuid_generate_v4(),
  clinic_id     uuid references clinics(id) on delete cascade,
  date          date not null,
  cat           text not null,   -- daily|hr|supplies|utility|rent|equipment|other
  description   text not null,
  amt           numeric not null check (amt > 0),
  vendor        text,
  ref           text,
  tax_deduct    text default 'no',   -- yes|no|partial
  pay_method    text,                -- cash|transfer|cheque|card
  notes         text,
  file_name     text,
  file_type     text,
  file_data     text,
  created_at    timestamptz default now(),
  created_by    uuid references profiles(id)
);


-- ============================================================
-- 6. PANEL — bil panel & hutang insurans
-- ============================================================
create table if not exists panel (
  id            uuid primary key default uuid_generate_v4(),
  clinic_id     uuid references clinics(id) on delete cascade,
  name          text not null,
  invoice_no    text not null,
  bill_date     date not null,
  billed_amt    numeric not null check (billed_amt > 0),
  paid_amt      numeric default 0,
  paid_date     date,
  pay_term      integer default 60,
  notes         text,
  file_name     text,
  file_type     text,
  file_data     text,
  created_at    timestamptz default now(),
  created_by    uuid references profiles(id)
);


-- ============================================================
-- 7. DOCUMENTS — invois & resit
-- ============================================================
create table if not exists documents (
  id            uuid primary key default uuid_generate_v4(),
  clinic_id     uuid references clinics(id) on delete cascade,
  name          text not null,
  type          text,   -- invois|resit|lain
  date          date,
  amt           numeric,
  notes         text,
  file_name     text,
  file_type     text,
  file_data     text,
  created_at    timestamptz default now(),
  created_by    uuid references profiles(id)
);


-- ============================================================
-- 8. ROW LEVEL SECURITY (RLS)
-- Setiap user hanya boleh baca/tulis data klinik mereka sendiri
-- ============================================================

alter table clinics         enable row level security;
alter table profiles        enable row level security;
alter table clinic_members  enable row level security;
alter table income          enable row level security;
alter table expense         enable row level security;
alter table panel           enable row level security;
alter table documents       enable row level security;


-- Helper function: semak sama ada user adalah ahli klinik
create or replace function is_clinic_member(cid uuid)
returns boolean as $$
  select exists (
    select 1 from clinic_members
    where clinic_id = cid
      and user_id = auth.uid()
  );
$$ language sql security definer;

-- Helper function: semak sama ada user adalah admin klinik
create or replace function is_clinic_admin(cid uuid)
returns boolean as $$
  select exists (
    select 1 from clinic_members
    where clinic_id = cid
      and user_id = auth.uid()
      and role = 'admin'
  );
$$ language sql security definer;


-- RLS: Clinics
create policy "Ahli boleh lihat klinik mereka"
  on clinics for select
  using (is_clinic_member(id));

create policy "Admin boleh kemaskini tetapan klinik"
  on clinics for update
  using (is_clinic_admin(id));

-- RLS: Profiles
create policy "User boleh lihat profil sendiri"
  on profiles for select
  using (auth.uid() = id);

create policy "User boleh kemaskini profil sendiri"
  on profiles for update
  using (auth.uid() = id);

-- RLS: Clinic Members
create policy "Ahli boleh lihat senarai ahli klinik"
  on clinic_members for select
  using (is_clinic_member(clinic_id));

create policy "Admin boleh urus ahli klinik"
  on clinic_members for all
  using (is_clinic_admin(clinic_id));

-- RLS: Income
create policy "Ahli boleh baca income klinik"
  on income for select
  using (is_clinic_member(clinic_id));

create policy "Ahli boleh tambah income"
  on income for insert
  with check (is_clinic_member(clinic_id));

create policy "Ahli boleh kemaskini income"
  on income for update
  using (is_clinic_member(clinic_id));

create policy "Admin boleh padam income"
  on income for delete
  using (is_clinic_admin(clinic_id));

-- RLS: Expense
create policy "Ahli boleh baca expense klinik"
  on expense for select
  using (is_clinic_member(clinic_id));

create policy "Ahli boleh tambah expense"
  on expense for insert
  with check (is_clinic_member(clinic_id));

create policy "Ahli boleh kemaskini expense"
  on expense for update
  using (is_clinic_member(clinic_id));

create policy "Admin boleh padam expense"
  on expense for delete
  using (is_clinic_admin(clinic_id));

-- RLS: Panel
create policy "Ahli boleh baca panel klinik"
  on panel for select
  using (is_clinic_member(clinic_id));

create policy "Ahli boleh tambah panel"
  on panel for insert
  with check (is_clinic_member(clinic_id));

create policy "Ahli boleh kemaskini panel"
  on panel for update
  using (is_clinic_member(clinic_id));

create policy "Admin boleh padam panel"
  on panel for delete
  using (is_clinic_admin(clinic_id));

-- RLS: Documents
create policy "Ahli boleh baca documents klinik"
  on documents for select
  using (is_clinic_member(clinic_id));

create policy "Ahli boleh tambah documents"
  on documents for insert
  with check (is_clinic_member(clinic_id));

create policy "Ahli boleh kemaskini documents"
  on documents for update
  using (is_clinic_member(clinic_id));

create policy "Admin boleh padam documents"
  on documents for delete
  using (is_clinic_admin(clinic_id));


-- ============================================================
-- SELESAI — Schema berjaya dibuat
-- Seterusnya: dapatkan Project URL & API Key dari Settings → API
-- ============================================================
