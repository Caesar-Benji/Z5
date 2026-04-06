-- =====================================================================
-- MISSION CHECKLIST :: SUPABASE SCHEMA
-- Run this once in Supabase SQL Editor (left sidebar -> SQL Editor).
-- =====================================================================

-- ---------- TABLES ---------------------------------------------------

create table if not exists missions (
  id            uuid primary key default gen_random_uuid(),
  code          text unique not null,            -- short mission code operators type to join
  password_hash text not null,                   -- sha-256 hex of squad password
  name          text not null default '',
  callsign      text not null default '',        -- team callsign
  date_time     text not null default '',        -- free-form, operator-controlled
  notes         text not null default '',
  created_at    timestamptz not null default now()
);

create table if not exists operators (
  id          uuid primary key default gen_random_uuid(),
  mission_id  uuid not null references missions(id) on delete cascade,
  callsign    text not null,
  name        text not null default '',
  last_seen   timestamptz not null default now(),
  created_at  timestamptz not null default now(),
  unique (mission_id, callsign)
);

create table if not exists checklist_state (
  operator_id uuid not null references operators(id) on delete cascade,
  step_key    text not null,
  checked     boolean not null default false,
  checked_at  timestamptz,
  primary key (operator_id, step_key)
);

create table if not exists equipment (
  id          uuid primary key default gen_random_uuid(),
  operator_id uuid not null references operators(id) on delete cascade,
  slot        text not null,            -- e.g. 'PRIMARY', 'SCOPE', or custom label
  model       text not null default '',
  serial      text not null default '',
  sort_order  int  not null default 0
);

-- ---------- INDEXES --------------------------------------------------

create index if not exists idx_operators_mission on operators(mission_id);
create index if not exists idx_checklist_op on checklist_state(operator_id);
create index if not exists idx_equipment_op on equipment(operator_id);

-- ---------- ROW LEVEL SECURITY ---------------------------------------
-- Anon key is exposed in the browser, so RLS is the real gate.
-- Strategy: anyone who knows the mission code can read/write that mission's
-- data. Squad password is verified client-side before the app reveals data.
-- This is a closed internal team tool; security model is shared-secret.

alter table missions          enable row level security;
alter table operators         enable row level security;
alter table checklist_state   enable row level security;
alter table equipment         enable row level security;

-- Missions: anon can read everything (so they can look up by code) and insert
-- new missions. Updates/deletes restricted to row owners is not enforceable
-- without auth, so we allow updates but not deletes.
drop policy if exists "missions_read"   on missions;
drop policy if exists "missions_insert" on missions;
drop policy if exists "missions_update" on missions;

create policy "missions_read"   on missions for select using (true);
create policy "missions_insert" on missions for insert with check (true);
create policy "missions_update" on missions for update using (true) with check (true);

-- Operators: full read/write for anon (gated by app-level password check).
drop policy if exists "operators_all" on operators;
create policy "operators_all" on operators for all using (true) with check (true);

-- Checklist state
drop policy if exists "checklist_all" on checklist_state;
create policy "checklist_all" on checklist_state for all using (true) with check (true);

-- Equipment
drop policy if exists "equipment_all" on equipment;
create policy "equipment_all" on equipment for all using (true) with check (true);

-- ---------- REALTIME -------------------------------------------------
-- Add tables to the supabase_realtime publication so the frontend can
-- subscribe to live changes.

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'missions'
  ) then
    alter publication supabase_realtime add table missions;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'operators'
  ) then
    alter publication supabase_realtime add table operators;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'checklist_state'
  ) then
    alter publication supabase_realtime add table checklist_state;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'equipment'
  ) then
    alter publication supabase_realtime add table equipment;
  end if;
end $$;
