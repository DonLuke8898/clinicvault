-- ============================================================
-- Migration 004: Daily Account table
-- Run this in Supabase SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS daily_account (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id        uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  created_by       uuid REFERENCES auth.users(id),
  date             date NOT NULL,
  time_slot        text,
  subject          text,
  cash_collection  numeric(12,2) NOT NULL DEFAULT 0,
  panel_collection numeric(12,2) NOT NULL DEFAULT 0,
  online_transfer  numeric(12,2) NOT NULL DEFAULT 0,
  debit_credit     numeric(12,2) NOT NULL DEFAULT 0,
  locum_cash       numeric(12,2) NOT NULL DEFAULT 0,
  locum_transfer   numeric(12,2) NOT NULL DEFAULT 0,
  locum_insentif   numeric(12,2) NOT NULL DEFAULT 0,
  expenses         numeric(12,2) NOT NULL DEFAULT 0,
  is_holiday       boolean       NOT NULL DEFAULT false,
  holiday_name     text,
  notes            text,
  created_at       timestamptz   NOT NULL DEFAULT now()
);

-- Index for fast month queries
CREATE INDEX IF NOT EXISTS daily_account_clinic_date
  ON daily_account (clinic_id, date);

-- ── Row Level Security ──────────────────────────────────────
ALTER TABLE daily_account ENABLE ROW LEVEL SECURITY;

-- Members of the clinic can SELECT
CREATE POLICY "daily_account_select" ON daily_account
  FOR SELECT USING (
    clinic_id IN (
      SELECT clinic_id FROM clinic_members WHERE user_id = auth.uid()
    )
  );

-- Members can INSERT (own rows)
CREATE POLICY "daily_account_insert" ON daily_account
  FOR INSERT WITH CHECK (
    clinic_id IN (
      SELECT clinic_id FROM clinic_members WHERE user_id = auth.uid()
    )
  );

-- Admin / creator can UPDATE
CREATE POLICY "daily_account_update" ON daily_account
  FOR UPDATE USING (
    clinic_id IN (
      SELECT clinic_id FROM clinic_members
      WHERE user_id = auth.uid() AND role IN ('admin','super_admin')
    )
    OR created_by = auth.uid()
  );

-- Admin / creator can DELETE
CREATE POLICY "daily_account_delete" ON daily_account
  FOR DELETE USING (
    clinic_id IN (
      SELECT clinic_id FROM clinic_members
      WHERE user_id = auth.uid() AND role IN ('admin','super_admin')
    )
    OR created_by = auth.uid()
  );
