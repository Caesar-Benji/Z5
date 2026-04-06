-- =====================================================================
-- Z5 :: SCHEMA v2 (PHASE 1)
-- Auth + squads + roles + gear inventory.
-- Run this once in Supabase SQL Editor.
-- =====================================================================

-- ---------- DROP LEGACY (v1 mission checklist) ----------------------

drop table if exists checklist_state cascade;
drop table if exists equipment       cascade;
drop table if exists operators       cascade;
drop table if exists missions        cascade;

-- Drop v2 tables if re-running this script
drop table if exists gear     cascade;
drop table if exists invites  cascade;
drop table if exists profiles cascade;
drop table if exists squads   cascade;

-- ---------- TABLES ---------------------------------------------------

create table squads (
  id          uuid primary key default gen_random_uuid(),
  name        text unique not null,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now()
);

create table profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  callsign    text unique,
  full_name   text default '',
  role        text not null default 'sniper'
              check (role in ('admin','officer','squad_leader','sniper')),
  squad_id    uuid references squads(id) on delete set null,
  created_at  timestamptz not null default now()
);

create table invites (
  id          uuid primary key default gen_random_uuid(),
  code        text unique not null,
  squad_id    uuid not null references squads(id) on delete cascade,
  role        text not null default 'sniper'
              check (role in ('squad_leader','sniper')),
  created_by  uuid references auth.users(id) on delete set null,
  expires_at  timestamptz,
  used_by     uuid references auth.users(id) on delete set null,
  used_at     timestamptz,
  created_at  timestamptz not null default now()
);

create table gear (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  slot        text not null,
  model       text not null default '',
  serial      text not null default '',
  notes       text not null default '',
  sort_order  int  not null default 0,
  created_at  timestamptz not null default now()
);

create index if not exists idx_profiles_squad on profiles(squad_id);
create index if not exists idx_gear_user      on gear(user_id);
create index if not exists idx_invites_squad  on invites(squad_id);

-- ---------- HELPER FUNCTIONS -----------------------------------------
-- SECURITY DEFINER so RLS policies can call them without recursion.

create or replace function public.current_role() returns text
language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid()
$$;

create or replace function public.current_squad() returns uuid
language sql stable security definer set search_path = public as $$
  select squad_id from profiles where id = auth.uid()
$$;

create or replace function public.is_admin_or_officer() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role from profiles where id = auth.uid()) in ('admin','officer'), false)
$$;

-- ---------- SIGNUP TRIGGER -------------------------------------------
-- Auto-create a profiles row when a new auth.users row is inserted.
-- Bootstraps Benji as admin if his email is the one signing up.

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, role)
  values (
    new.id,
    new.email,
    case when lower(new.email) = 'benjaminaidinov@gmail.com'
         then 'admin' else 'sniper' end
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ---------- INVITE REDEMPTION RPC ------------------------------------
-- Called by the client right after signup. Validates the code,
-- updates the user's profile (squad + role), and marks invite used.

create or replace function public.redeem_invite(invite_code text)
returns json
language plpgsql security definer set search_path = public as $$
declare
  inv record;
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'NOT AUTHENTICATED';
  end if;

  select * into inv from invites where code = invite_code;
  if inv is null then
    raise exception 'INVITE CODE NOT FOUND';
  end if;
  if inv.used_by is not null then
    raise exception 'INVITE CODE ALREADY USED';
  end if;
  if inv.expires_at is not null and inv.expires_at < now() then
    raise exception 'INVITE CODE EXPIRED';
  end if;

  update profiles
     set squad_id = inv.squad_id,
         role     = inv.role
   where id = uid;

  update invites
     set used_by = uid, used_at = now()
   where id = inv.id;

  return json_build_object('squad_id', inv.squad_id, 'role', inv.role);
end;
$$;

-- ---------- PROFILE UPDATE RPC ---------------------------------------
-- Lets users set their callsign and name without RLS gymnastics.

create or replace function public.update_my_profile(p_callsign text, p_full_name text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'NOT AUTHENTICATED'; end if;
  update profiles
     set callsign  = nullif(trim(p_callsign), ''),
         full_name = coalesce(p_full_name, '')
   where id = auth.uid();
end;
$$;

-- ---------- ROW LEVEL SECURITY ---------------------------------------

alter table squads   enable row level security;
alter table profiles enable row level security;
alter table invites  enable row level security;
alter table gear     enable row level security;

-- SQUADS
drop policy if exists squads_select on squads;
drop policy if exists squads_write  on squads;

create policy squads_select on squads for select
  to authenticated using (true);

create policy squads_write on squads for all
  to authenticated
  using (public.is_admin_or_officer())
  with check (public.is_admin_or_officer());

-- PROFILES
drop policy if exists profiles_select_self    on profiles;
drop policy if exists profiles_select_squad   on profiles;
drop policy if exists profiles_select_admin   on profiles;
drop policy if exists profiles_update_self    on profiles;
drop policy if exists profiles_update_admin   on profiles;

create policy profiles_select_self on profiles for select
  to authenticated using (id = auth.uid());

create policy profiles_select_squad on profiles for select
  to authenticated using (squad_id is not null and squad_id = public.current_squad());

create policy profiles_select_admin on profiles for select
  to authenticated using (public.is_admin_or_officer());

create policy profiles_update_self on profiles for update
  to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy profiles_update_admin on profiles for update
  to authenticated
  using (public.is_admin_or_officer())
  with check (public.is_admin_or_officer());

-- INVITES
drop policy if exists invites_select_admin on invites;
drop policy if exists invites_select_lead  on invites;
drop policy if exists invites_insert_admin on invites;
drop policy if exists invites_insert_lead  on invites;

create policy invites_select_admin on invites for select
  to authenticated using (public.is_admin_or_officer());

create policy invites_select_lead on invites for select
  to authenticated using (
    public.current_role() = 'squad_leader'
    and squad_id = public.current_squad()
  );

create policy invites_insert_admin on invites for insert
  to authenticated with check (public.is_admin_or_officer());

create policy invites_insert_lead on invites for insert
  to authenticated with check (
    public.current_role() = 'squad_leader'
    and squad_id = public.current_squad()
    and role = 'sniper'   -- squad leaders can only invite snipers
  );

-- GEAR
drop policy if exists gear_select_self  on gear;
drop policy if exists gear_select_squad on gear;
drop policy if exists gear_select_admin on gear;
drop policy if exists gear_write_self   on gear;
drop policy if exists gear_write_admin  on gear;

create policy gear_select_self on gear for select
  to authenticated using (user_id = auth.uid());

create policy gear_select_squad on gear for select
  to authenticated using (
    exists (select 1 from profiles p
            where p.id = gear.user_id
              and p.squad_id is not null
              and p.squad_id = public.current_squad())
  );

create policy gear_select_admin on gear for select
  to authenticated using (public.is_admin_or_officer());

create policy gear_write_self on gear for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy gear_write_admin on gear for all
  to authenticated
  using (public.is_admin_or_officer())
  with check (public.is_admin_or_officer());

-- ---------- REALTIME -------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and tablename = 'profiles') then
    alter publication supabase_realtime add table profiles;
  end if;
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and tablename = 'squads') then
    alter publication supabase_realtime add table squads;
  end if;
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and tablename = 'invites') then
    alter publication supabase_realtime add table invites;
  end if;
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and tablename = 'gear') then
    alter publication supabase_realtime add table gear;
  end if;
end $$;
