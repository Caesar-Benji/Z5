-- ============================================================
-- Z5 SCHEMA v7 — Knowledge: week assignment for boot camp
-- Run in Supabase SQL Editor after schema_v6.
-- ============================================================

-- Add week column (1-4 for boot camp weeks, null for general material)
alter table knowledge_materials add column if not exists week int;
alter table knowledge_materials drop constraint if exists knowledge_week_check;
alter table knowledge_materials add constraint knowledge_week_check
  check (week is null or (week >= 1 and week <= 4));

-- Refresh PostgREST schema cache
notify pgrst, 'reload schema';
