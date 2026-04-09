-- =====================================================================
-- Z5 :: SCHEMA v5 — MISSION DELETE BY CREATOR
-- Incremental migration. Run AFTER schema_v4.sql.
-- =====================================================================

-- Allow mission creators to delete their own missions, regardless of
-- current squad assignment. Admin/officer/squad_leader already have
-- write-all policies; this specifically covers the edge case where a
-- creator's squad changes after mission creation.

drop policy if exists missions_delete_creator on missions;

create policy missions_delete_creator on missions for delete
  to authenticated using (created_by = auth.uid());

-- Done.
