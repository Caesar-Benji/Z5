-- ============================================================
-- Z5 SCHEMA v6 — Boot camp squads + Knowledge materials
-- Run in Supabase SQL Editor after all previous migrations.
-- ============================================================

-- 1. Add is_bootcamp flag to squads
alter table squads add column if not exists is_bootcamp boolean not null default false;

-- 2. Knowledge materials table
create table if not exists knowledge_materials (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  description text not null default '',
  category    text not null default 'general',
  file_name   text not null,
  file_path   text not null,           -- path inside Supabase Storage bucket
  file_size   bigint not null default 0,
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  sort_order  int not null default 0
);

create index if not exists idx_knowledge_category on knowledge_materials(category);
create index if not exists idx_knowledge_created  on knowledge_materials(created_at desc);

-- 3. RLS for knowledge_materials
alter table knowledge_materials enable row level security;

-- Everyone authenticated can read
drop policy if exists knowledge_select on knowledge_materials;
create policy knowledge_select on knowledge_materials for select
  to authenticated using (true);

-- Admin, officer, instructor can insert/update/delete
drop policy if exists knowledge_write_admin on knowledge_materials;
create policy knowledge_write_admin on knowledge_materials for all
  to authenticated
  using (
    public.current_role() in ('admin', 'officer', 'instructor')
  )
  with check (
    public.current_role() in ('admin', 'officer', 'instructor')
  );

-- 4. Create Supabase Storage bucket for knowledge files
-- NOTE: Supabase Storage bucket creation must be done via the Dashboard
-- or the storage API. Run this insert only if the bucket doesn't exist yet.
-- Go to Supabase Dashboard → Storage → New Bucket → name: "knowledge" → Public: ON
-- (public so the PDF viewer can load files by URL without auth headers)

-- 5. Storage RLS policies (for the 'knowledge' bucket)
-- These go into the storage schema. Supabase auto-creates the storage.objects table.

-- Allow authenticated users to read all files in 'knowledge' bucket
drop policy if exists knowledge_storage_select on storage.objects;
create policy knowledge_storage_select on storage.objects for select
  to authenticated
  using (bucket_id = 'knowledge');

-- Allow public read (for PDF iframe viewer)
drop policy if exists knowledge_storage_public on storage.objects;
create policy knowledge_storage_public on storage.objects for select
  to anon
  using (bucket_id = 'knowledge');

-- Allow admin/officer/instructor to upload
drop policy if exists knowledge_storage_insert on storage.objects;
create policy knowledge_storage_insert on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'knowledge'
    and public.current_role() in ('admin', 'officer', 'instructor')
  );

-- Allow admin/officer/instructor to delete
drop policy if exists knowledge_storage_delete on storage.objects;
create policy knowledge_storage_delete on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'knowledge'
    and public.current_role() in ('admin', 'officer', 'instructor')
  );

-- 6. Realtime for knowledge_materials
do $$
begin
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and tablename = 'knowledge_materials') then
    alter publication supabase_realtime add table knowledge_materials;
  end if;
end $$;

-- Refresh PostgREST schema cache
notify pgrst, 'reload schema';
