-- ============================================================
-- Migration 006: Tambah kolum atome_spaylater ke daily_account
-- Jalankan dalam Supabase SQL Editor
-- ============================================================

ALTER TABLE daily_account
  ADD COLUMN IF NOT EXISTS atome_spaylater numeric DEFAULT 0;
