-- =====================================================================
-- Z5 :: SCHEMA v4 (PHASE 3 — ADMIN TASKS + CALENDAR + INSTRUCTOR + SQUAD STATUS)
-- Incremental migration. Run AFTER schema_v3.sql.
-- Safe to re-run: all alters are idempotent / guarded.
-- =====================================================================

-- ---------- PROFILES: add 'instructor' role -------------------------
alter table profiles drop constraint if exists profiles_role_check;
alter table profiles add  constraint profiles_role_check
  check (role in ('admin','officer','squad_leader','sniper','instructor'));

-- ---------- SQUADS: add lifecycle status ----------------------------
alter table squads add column if not exists status text not null default 'active';
alter table squads drop constraint if exists squads_status_check;
alter table squads add  constraint squads_status_check
  check (status in ('active','training','archived'));
create index if not exists idx_squads_status on squads(status);

-- ---------- MISSIONS: add kind + due_at -----------------------------
alter table missions add column if not exists kind text not null default 'operational';
alter table missions drop constraint if exists missions_kind_check;
alter table missions add  constraint missions_kind_check
  check (kind in ('operational','admin'));

alter table missions add column if not exists due_at timestamptz;

-- squad_id becomes nullable so "whole team" admin tasks can exist
alter table missions alter column squad_id drop not null;

create index if not exists idx_missions_kind     on missions(kind);
create index if not exists idx_missions_due      on missions(due_at);

-- ---------- MISSION_OPERATORS: allow null role + done fields -------
alter table mission_operators drop constraint if exists mission_operators_role_check;
alter table mission_operators alter column role drop not null;
alter table mission_operators add  constraint mission_operators_role_check
  check (role is null or role in ('rec10','bolt','spotter_tl'));

alter table mission_operators add column if not exists done    boolean not null default false;
alter table mission_operators add column if not exists done_at timestamptz;

-- ---------- PERMISSION HELPERS (updated) ----------------------------
-- can_see_mission now handles:
--   * operational → same squad (or admin/officer)
--   * admin       → same squad (if set), or user is an assignee, or whole-team (null squad)
-- Admin tasks with null squad are visible to all authenticated operators
-- who are in `mission_operators` OR to admin/officer always.

create or replace function public.can_see_mission(p_mission_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from missions m
    where m.id = p_mission_id
      and (
        public.is_admin_or_officer()
        or (m.kind = 'operational' and m.squad_id = public.current_squad())
        or (m.kind = 'admin' and (
              (m.squad_id is not null and m.squad_id = public.current_squad())
              or exists (
                select 1 from mission_operators mo
                where mo.mission_id = m.id and mo.user_id = auth.uid()
              )
              or m.squad_id is null  -- whole-team task, visible to everyone
           ))
      )
  )
$$;

-- can_author_mission_for: unchanged logic but now tolerates null squad
-- (null squad → only admin/officer can author).
create or replace function public.can_author_mission_for(p_squad uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select
    public.is_admin_or_officer()
    or (
      p_squad is not null
      and public.current_role() = 'squad_leader'
      and public.current_squad() = p_squad
    )
$$;

-- ---------- RPC: create_mission (updated signature) ----------------
-- Drop previous version so we can change signature cleanly.
drop function if exists public.create_mission(text,uuid,timestamptz,text,text,jsonb,jsonb);

create or replace function public.create_mission(
  p_name         text,
  p_squad_id     uuid,
  p_scheduled_at timestamptz,
  p_location     text,
  p_notes        text,
  p_operators    jsonb,
  p_items        jsonb,
  p_kind         text default 'operational',
  p_due_at       timestamptz default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  new_id uuid;
  has_custom boolean := p_items is not null
                    and jsonb_typeof(p_items) = 'array'
                    and jsonb_array_length(p_items) > 0;
  v_kind text := coalesce(p_kind, 'operational');
begin
  if auth.uid() is null then raise exception 'NOT AUTHENTICATED'; end if;
  if v_kind not in ('operational','admin') then
    raise exception 'INVALID kind %', v_kind;
  end if;

  -- Operational missions must have a squad.
  if v_kind = 'operational' and p_squad_id is null then
    raise exception 'Operational missions require a squad';
  end if;

  if not public.can_author_mission_for(p_squad_id) then
    raise exception 'NOT AUTHORIZED to create mission for this squad';
  end if;
  if coalesce(trim(p_name),'') = '' then
    raise exception 'Mission name required';
  end if;

  insert into missions (name, squad_id, scheduled_at, due_at, location, notes, created_by, kind)
  values (p_name, p_squad_id, p_scheduled_at, p_due_at,
          coalesce(p_location,''), coalesce(p_notes,''), auth.uid(), v_kind)
  returning id into new_id;

  if v_kind = 'operational' then
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
  end if;

  -- Insert operator assignments. For admin kind, role may be null.
  if p_operators is not null and jsonb_typeof(p_operators) = 'array' then
    insert into mission_operators (mission_id, user_id, role)
    select new_id,
           (elem->>'user_id')::uuid,
           nullif(elem->>'role','')::text
      from jsonb_array_elements(p_operators) as elem
     where (elem->>'user_id') is not null
    on conflict (mission_id, user_id) do update set role = excluded.role;
  end if;

  if v_kind = 'operational' then
    -- Pre-create per-operator checklist state rows.
    insert into mission_operator_state (mission_id, user_id, item_id, checked)
    select mo.mission_id, mo.user_id, mci.id, false
      from mission_operators mo
      join mission_checklist_items mci on mci.mission_id = mo.mission_id
     where mo.mission_id = new_id
       and mo.role is not null
       and public.section_applies_to_role(mci.section, mo.role);
  end if;

  return new_id;
end;
$$;

-- ---------- RPC: set_admin_task_done -------------------------------
-- Per-assignee done toggle for admin-kind missions.
create or replace function public.set_admin_task_done(
  p_mission_id uuid,
  p_done       boolean
) returns void
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  v_kind text;
  is_assignee boolean;
begin
  if uid is null then raise exception 'NOT AUTHENTICATED'; end if;

  select kind into v_kind from missions where id = p_mission_id;
  if v_kind is null then raise exception 'Mission not found'; end if;
  if v_kind <> 'admin' then
    raise exception 'Not an admin task';
  end if;

  select exists (
    select 1 from mission_operators
    where mission_id = p_mission_id and user_id = uid
  ) into is_assignee;

  if not is_assignee then
    raise exception 'NOT AUTHORIZED: you are not assigned to this task';
  end if;

  update mission_operators
     set done    = p_done,
         done_at = case when p_done then now() else null end
   where mission_id = p_mission_id and user_id = uid;
end;
$$;

-- ---------- RPC: admin_task_readiness ------------------------------
-- Per-assignee done/not-done rollup for admin tasks (mirrors
-- mission_readiness but for the admin kind).

create or replace function public.admin_task_readiness(p_mission_id uuid)
returns table (
  user_id   uuid,
  callsign  text,
  full_name text,
  done      boolean,
  done_at   timestamptz
)
language sql stable security definer set search_path = public as $$
  select
    mo.user_id,
    p.callsign,
    p.full_name,
    mo.done,
    mo.done_at
  from mission_operators mo
  join profiles p on p.id = mo.user_id
  where mo.mission_id = p_mission_id
  order by mo.done asc, p.callsign nulls last;
$$;

-- ---------- RLS: missions_select needs kind awareness --------------
-- Replace the old squad-only select policy with one that uses
-- can_see_mission so admin tasks with null squad / assignee-based
-- visibility work correctly.

drop policy if exists missions_select on missions;

create policy missions_select on missions for select
  to authenticated using (
    public.is_admin_or_officer()
    or public.can_see_mission(id)
  );

-- squad_leader write policy needs to also allow null squad_id guard
-- (no change needed because the check compares to current_squad() which
-- will never match null; admins/officers handle the null-squad case).

-- ---------- Done. --------------------------------------------------
