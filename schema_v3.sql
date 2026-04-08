-- =====================================================================
-- Z5 :: SCHEMA v3 (PHASE 2 — MISSIONS + CHECKLISTS + ANNOUNCEMENTS)
-- Incremental migration. Run AFTER schema_v2.sql.
-- Safe to re-run: drops and recreates v3 tables, leaves v2 intact.
-- =====================================================================

-- ---------- DROP v3 (for re-runs) ------------------------------------
drop table if exists mission_operator_state  cascade;
drop table if exists mission_checklist_items cascade;
drop table if exists mission_operators       cascade;
drop table if exists missions                cascade;
drop table if exists announcements           cascade;

-- ---------- TABLES ---------------------------------------------------

create table missions (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  squad_id      uuid not null references squads(id) on delete cascade,
  scheduled_at  timestamptz,
  location      text not null default '',
  notes         text not null default '',
  status        text not null default 'scheduled'
                check (status in ('draft','scheduled','active','complete','cancelled')),
  created_by    uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now()
);

create table mission_checklist_items (
  id         uuid primary key default gen_random_uuid(),
  mission_id uuid not null references missions(id) on delete cascade,
  section    text not null
             check (section in (
               'sniper_rec10','sniper_bolt','spotter_tl',
               'all','final_check','final_ready'
             )),
  order_no   int  not null default 0,
  label      text not null
);

create table mission_operators (
  mission_id uuid not null references missions(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       text not null
             check (role in ('rec10','bolt','spotter_tl')),
  primary key (mission_id, user_id)
);

create table mission_operator_state (
  mission_id uuid not null references missions(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  item_id    uuid not null references mission_checklist_items(id) on delete cascade,
  checked    boolean not null default false,
  checked_at timestamptz,
  primary key (mission_id, user_id, item_id)
);

create table announcements (
  id        uuid primary key default gen_random_uuid(),
  scope     text not null check (scope in ('global','squad')),
  squad_id  uuid references squads(id) on delete cascade,
  title     text not null default '',
  body      text not null,
  posted_by uuid references auth.users(id) on delete set null,
  posted_at timestamptz not null default now(),
  check (
    (scope = 'global' and squad_id is null) or
    (scope = 'squad'  and squad_id is not null)
  )
);

create index idx_missions_squad     on missions(squad_id);
create index idx_missions_scheduled on missions(scheduled_at);
create index idx_mci_mission        on mission_checklist_items(mission_id);
create index idx_mop_mission        on mission_operators(mission_id);
create index idx_mos_mission_user   on mission_operator_state(mission_id, user_id);
create index idx_announcements_squad on announcements(squad_id);
create index idx_announcements_posted on announcements(posted_at desc);

-- ---------- HELPER: which sections apply to which operator role ------
-- Sections 'all', 'final_check', 'final_ready' apply to every operator.
-- Section 'sniper_rec10' applies only to rec10 operators, etc.

create or replace function public.section_applies_to_role(
  p_section text, p_role text
) returns boolean
language sql immutable as $$
  select case
    when p_section in ('all','final_check','final_ready') then true
    when p_section = 'sniper_rec10' and p_role = 'rec10'       then true
    when p_section = 'sniper_bolt'  and p_role = 'bolt'        then true
    when p_section = 'spotter_tl'   and p_role = 'spotter_tl'  then true
    else false
  end
$$;

-- ---------- DEFAULT CHECKLIST TEMPLATE --------------------------------
-- Returns the canonical Z5 loadout checklist as rows. create_mission
-- copies from here when the caller doesn't supply custom items.

create or replace function public.default_checklist_items()
returns table (section text, order_no int, label text)
language sql immutable as $$
  values
    -- SNIPER — REC10
    ('sniper_rec10', 1, 'Rifle (REC10)'),
    ('sniper_rec10', 2, 'Suppressor'),
    ('sniper_rec10', 3, '5× Magazines'),
    ('sniper_rec10', 4, 'Day Optic'),
    ('sniper_rec10', 5, 'Night Optic'),
    ('sniper_rec10', 6, 'Delta Point'),
    ('sniper_rec10', 7, 'Shooting Tripod'),
    ('sniper_rec10', 8, 'Helmet Night Vision'),
    ('sniper_rec10', 9, 'Batteries'),
    -- SNIPER — BOLT ACTION
    ('sniper_bolt',  1, 'Bolt Rifle'),
    ('sniper_bolt',  2, 'Suppressor'),
    ('sniper_bolt',  3, '5× Magazines'),
    ('sniper_bolt',  4, 'Day Optic'),
    ('sniper_bolt',  5, 'Night Optic'),
    ('sniper_bolt',  6, 'Tripod'),
    ('sniper_bolt',  7, 'AR15'),
    ('sniper_bolt',  8, 'AR15 Optic'),
    ('sniper_bolt',  9, 'Helmet NV'),
    ('sniper_bolt', 10, 'Batteries'),
    -- SPOTTER / TEAM LEADER
    ('spotter_tl',   1, 'AR15'),
    ('spotter_tl',   2, 'Day Optic'),
    ('spotter_tl',   3, 'Radio'),
    ('spotter_tl',   4, 'Day Spotter Optic'),
    ('spotter_tl',   5, 'Thermal Optic'),
    ('spotter_tl',   6, 'Helmet NV'),
    ('spotter_tl',   7, 'Batteries'),
    -- ALL TEAM MEMBERS
    ('all',          1, 'Plate Carrier'),
    ('all',          2, 'Helmet'),
    ('all',          3, 'Backpack'),
    ('all',          4, 'Camouflage Kit'),
    ('all',          5, 'Water'),
    ('all',          6, 'Food'),
    ('all',          7, 'Medical Kit'),
    -- FINAL QUICK CHECK
    ('final_check',  1, 'Weapon System'),
    ('final_check',  2, 'Optics (Day/Night)'),
    ('final_check',  3, 'Vision (NV/Thermal)'),
    ('final_check',  4, 'Comms'),
    ('final_check',  5, 'Support Gear'),
    ('final_check',  6, 'Batteries'),
    -- FINAL READY
    ('final_ready',  1, 'No Missing Gear'),
    ('final_ready',  2, 'No Loose Items'),
    ('final_ready',  3, 'Weight Balanced'),
    ('final_ready',  4, 'Systems Working');
$$;

-- ---------- PERMISSION HELPERS ---------------------------------------

create or replace function public.can_author_mission_for(p_squad uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select
    public.is_admin_or_officer()
    or (public.current_role() = 'squad_leader' and public.current_squad() = p_squad)
$$;

create or replace function public.can_see_mission(p_mission_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from missions m
    where m.id = p_mission_id
      and (
        public.is_admin_or_officer()
        or m.squad_id = public.current_squad()
      )
  )
$$;

-- ---------- RPC: create_mission --------------------------------------
-- p_operators: jsonb array of {user_id: uuid, role: text}
-- p_items:     jsonb array of {section, order_no, label}
--              If null/empty, falls back to default_checklist_items().
-- Returns the new mission uuid.

create or replace function public.create_mission(
  p_name         text,
  p_squad_id     uuid,
  p_scheduled_at timestamptz,
  p_location     text,
  p_notes        text,
  p_operators    jsonb,
  p_items        jsonb
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  new_id uuid;
  has_custom boolean := p_items is not null
                    and jsonb_typeof(p_items) = 'array'
                    and jsonb_array_length(p_items) > 0;
begin
  if auth.uid() is null then raise exception 'NOT AUTHENTICATED'; end if;
  if not public.can_author_mission_for(p_squad_id) then
    raise exception 'NOT AUTHORIZED to create mission for this squad';
  end if;
  if coalesce(trim(p_name),'') = '' then
    raise exception 'Mission name required';
  end if;

  insert into missions (name, squad_id, scheduled_at, location, notes, created_by)
  values (p_name, p_squad_id, p_scheduled_at,
          coalesce(p_location,''), coalesce(p_notes,''), auth.uid())
  returning id into new_id;

  -- Insert checklist items (custom override, else default template)
  if has_custom then
    insert into mission_checklist_items (mission_id, section, order_no, label)
    select new_id,
           (elem->>'section')::text,
           coalesce((elem->>'order_no')::int, 0),
           (elem->>'label')::text
      from jsonb_array_elements(p_items) as elem
     where (elem->>'label') is not null
       and trim(elem->>'label') <> '';
  else
    insert into mission_checklist_items (mission_id, section, order_no, label)
    select new_id, t.section, t.order_no, t.label
      from public.default_checklist_items() t;
  end if;

  -- Insert operator assignments
  if p_operators is not null and jsonb_typeof(p_operators) = 'array' then
    insert into mission_operators (mission_id, user_id, role)
    select new_id,
           (elem->>'user_id')::uuid,
           (elem->>'role')::text
      from jsonb_array_elements(p_operators) as elem
     where (elem->>'user_id') is not null
    on conflict (mission_id, user_id) do update set role = excluded.role;
  end if;

  -- Pre-create per-operator checklist state rows so readiness rollups
  -- can be computed from a simple count on mission_operator_state.
  insert into mission_operator_state (mission_id, user_id, item_id, checked)
  select mo.mission_id, mo.user_id, mci.id, false
    from mission_operators mo
    join mission_checklist_items mci on mci.mission_id = mo.mission_id
   where mo.mission_id = new_id
     and public.section_applies_to_role(mci.section, mo.role);

  return new_id;
end;
$$;

-- ---------- RPC: toggle_checklist_item -------------------------------
-- Operator flips a single item on/off for themselves.

create or replace function public.toggle_checklist_item(
  p_mission_id uuid,
  p_item_id    uuid,
  p_checked    boolean
) returns void
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  is_operator boolean;
begin
  if uid is null then raise exception 'NOT AUTHENTICATED'; end if;

  select exists (
    select 1 from mission_operators
    where mission_id = p_mission_id and user_id = uid
  ) into is_operator;

  if not is_operator then
    raise exception 'NOT AN OPERATOR on this mission';
  end if;

  insert into mission_operator_state (mission_id, user_id, item_id, checked, checked_at)
  values (p_mission_id, uid, p_item_id, p_checked,
          case when p_checked then now() else null end)
  on conflict (mission_id, user_id, item_id) do update
    set checked    = excluded.checked,
        checked_at = excluded.checked_at;
end;
$$;

-- ---------- RPC: mission_readiness -----------------------------------
-- Returns one row per operator with their completion percentage and
-- whether all their final_ready items are checked.

create or replace function public.mission_readiness(p_mission_id uuid)
returns table (
  user_id         uuid,
  callsign        text,
  full_name       text,
  op_role         text,
  total_items     int,
  checked_items   int,
  pct             int,
  ready_to_move   boolean
)
language sql stable security definer set search_path = public as $$
  with op as (
    select mo.user_id, mo.role
      from mission_operators mo
     where mo.mission_id = p_mission_id
  ),
  agg as (
    select s.user_id,
           count(*)::int                              as total,
           (count(*) filter (where s.checked))::int   as checked
      from mission_operator_state s
     where s.mission_id = p_mission_id
     group by s.user_id
  ),
  ready as (
    select s.user_id,
           bool_and(s.checked) as all_ready
      from mission_operator_state s
      join mission_checklist_items mci on mci.id = s.item_id
     where s.mission_id = p_mission_id
       and mci.section  = 'final_ready'
     group by s.user_id
  )
  select
    op.user_id,
    p.callsign,
    p.full_name,
    op.role                                         as op_role,
    coalesce(a.total, 0)                            as total_items,
    coalesce(a.checked, 0)                          as checked_items,
    case when coalesce(a.total, 0) = 0 then 0
         else round(100.0 * a.checked / a.total)::int
    end                                             as pct,
    coalesce(r.all_ready, false)                    as ready_to_move
  from op
  join profiles p on p.id = op.user_id
  left join agg   a on a.user_id = op.user_id
  left join ready r on r.user_id = op.user_id
  order by p.callsign nulls last;
$$;

-- ---------- ROW LEVEL SECURITY ---------------------------------------

alter table missions                enable row level security;
alter table mission_checklist_items enable row level security;
alter table mission_operators       enable row level security;
alter table mission_operator_state  enable row level security;
alter table announcements           enable row level security;

-- MISSIONS ------------------------------------------------------------
drop policy if exists missions_select        on missions;
drop policy if exists missions_write_admin   on missions;
drop policy if exists missions_write_lead    on missions;

create policy missions_select on missions for select
  to authenticated using (
    public.is_admin_or_officer()
    or squad_id = public.current_squad()
  );

create policy missions_write_admin on missions for all
  to authenticated
  using (public.is_admin_or_officer())
  with check (public.is_admin_or_officer());

create policy missions_write_lead on missions for all
  to authenticated
  using (
    public.current_role() = 'squad_leader'
    and squad_id = public.current_squad()
  )
  with check (
    public.current_role() = 'squad_leader'
    and squad_id = public.current_squad()
  );

-- MISSION_CHECKLIST_ITEMS --------------------------------------------
drop policy if exists mci_select        on mission_checklist_items;
drop policy if exists mci_write_admin   on mission_checklist_items;
drop policy if exists mci_write_lead    on mission_checklist_items;

create policy mci_select on mission_checklist_items for select
  to authenticated using (public.can_see_mission(mission_id));

create policy mci_write_admin on mission_checklist_items for all
  to authenticated
  using (public.is_admin_or_officer())
  with check (public.is_admin_or_officer());

create policy mci_write_lead on mission_checklist_items for all
  to authenticated
  using (
    exists (
      select 1 from missions m
      where m.id = mission_checklist_items.mission_id
        and public.current_role() = 'squad_leader'
        and m.squad_id = public.current_squad()
    )
  )
  with check (
    exists (
      select 1 from missions m
      where m.id = mission_checklist_items.mission_id
        and public.current_role() = 'squad_leader'
        and m.squad_id = public.current_squad()
    )
  );

-- MISSION_OPERATORS ---------------------------------------------------
drop policy if exists mop_select        on mission_operators;
drop policy if exists mop_write_admin   on mission_operators;
drop policy if exists mop_write_lead    on mission_operators;

create policy mop_select on mission_operators for select
  to authenticated using (public.can_see_mission(mission_id));

create policy mop_write_admin on mission_operators for all
  to authenticated
  using (public.is_admin_or_officer())
  with check (public.is_admin_or_officer());

create policy mop_write_lead on mission_operators for all
  to authenticated
  using (
    exists (
      select 1 from missions m
      where m.id = mission_operators.mission_id
        and public.current_role() = 'squad_leader'
        and m.squad_id = public.current_squad()
    )
  )
  with check (
    exists (
      select 1 from missions m
      where m.id = mission_operators.mission_id
        and public.current_role() = 'squad_leader'
        and m.squad_id = public.current_squad()
    )
  );

-- MISSION_OPERATOR_STATE ----------------------------------------------
drop policy if exists mos_select_self    on mission_operator_state;
drop policy if exists mos_select_squad   on mission_operator_state;
drop policy if exists mos_select_admin   on mission_operator_state;
drop policy if exists mos_write_self     on mission_operator_state;

create policy mos_select_self on mission_operator_state for select
  to authenticated using (user_id = auth.uid());

-- Squad leaders and officers/admins see every row for missions they
-- can see (needed for the roll-up view).
create policy mos_select_squad on mission_operator_state for select
  to authenticated using (
    public.is_admin_or_officer()
    or exists (
      select 1 from missions m
      where m.id = mission_operator_state.mission_id
        and (
          public.is_admin_or_officer()
          or m.squad_id = public.current_squad()
        )
    )
  );

-- Operators can only write their own rows.
create policy mos_write_self on mission_operator_state for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ANNOUNCEMENTS -------------------------------------------------------
drop policy if exists ann_select_global on announcements;
drop policy if exists ann_select_squad  on announcements;
drop policy if exists ann_select_admin  on announcements;
drop policy if exists ann_write_admin   on announcements;
drop policy if exists ann_write_lead    on announcements;

create policy ann_select_global on announcements for select
  to authenticated using (scope = 'global');

create policy ann_select_squad on announcements for select
  to authenticated using (
    scope = 'squad' and squad_id = public.current_squad()
  );

create policy ann_select_admin on announcements for select
  to authenticated using (public.is_admin_or_officer());

create policy ann_write_admin on announcements for all
  to authenticated
  using (public.is_admin_or_officer())
  with check (public.is_admin_or_officer());

create policy ann_write_lead on announcements for all
  to authenticated
  using (
    public.current_role() = 'squad_leader'
    and scope = 'squad'
    and squad_id = public.current_squad()
  )
  with check (
    public.current_role() = 'squad_leader'
    and scope = 'squad'
    and squad_id = public.current_squad()
  );

-- ---------- REALTIME -------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and tablename = 'missions') then
    alter publication supabase_realtime add table missions;
  end if;
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and tablename = 'mission_checklist_items') then
    alter publication supabase_realtime add table mission_checklist_items;
  end if;
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and tablename = 'mission_operators') then
    alter publication supabase_realtime add table mission_operators;
  end if;
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and tablename = 'mission_operator_state') then
    alter publication supabase_realtime add table mission_operator_state;
  end if;
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and tablename = 'announcements') then
    alter publication supabase_realtime add table announcements;
  end if;
end $$;
