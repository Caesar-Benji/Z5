// Z5 :: missions data layer
// Thin wrappers around supabase for mission CRUD and per-operator state.
import { supabase } from "../supabase";

// ---------- Mission list ---------------------------------------------

export async function listMissions({ squadId, kind, onlyUpcoming = false, limit = 50 } = {}) {
  let q = supabase.from("missions")
    .select("*")
    .order("scheduled_at", { ascending: true, nullsFirst: false })
    .limit(limit);
  if (squadId) q = q.eq("squad_id", squadId);
  if (kind)    q = q.eq("kind", kind);
  if (onlyUpcoming) {
    q = q.in("status", ["scheduled", "active"]);
  }
  const { data, error } = await q;
  return { data: data || [], error };
}

// Missions whose scheduled_at OR due_at falls inside [fromISO, toISO).
// Used by the Calendar screen. RLS handles visibility filtering.
export async function listMissionsInRange({ fromISO, toISO } = {}) {
  if (!fromISO || !toISO) return { data: [], error: null };
  const [{ data: a, error: e1 }, { data: b, error: e2 }] = await Promise.all([
    supabase.from("missions").select("*")
      .gte("scheduled_at", fromISO).lt("scheduled_at", toISO),
    supabase.from("missions").select("*")
      .gte("due_at", fromISO).lt("due_at", toISO),
  ]);
  if (e1) return { data: [], error: e1 };
  if (e2) return { data: [], error: e2 };
  const map = new Map();
  for (const m of [...(a || []), ...(b || [])]) map.set(m.id, m);
  return { data: Array.from(map.values()), error: null };
}

// Missions the current operator is personally assigned to.
export async function listMyUpcomingMissions(userId, { limit = 5 } = {}) {
  if (!userId) return { data: [], error: null };
  const { data: mops, error: e1 } = await supabase
    .from("mission_operators")
    .select("mission_id, role, done")
    .eq("user_id", userId);
  if (e1) return { data: [], error: e1 };
  const ids = (mops || []).map((m) => m.mission_id);
  if (ids.length === 0) return { data: [], error: null };

  const { data, error } = await supabase
    .from("missions")
    .select("*")
    .in("id", ids)
    .in("status", ["scheduled", "active"])
    .order("scheduled_at", { ascending: true, nullsFirst: false })
    .limit(limit);
  if (error) return { data: [], error };

  const byMission = Object.fromEntries(
    (mops || []).map((m) => [m.mission_id, { role: m.role, done: m.done }])
  );
  const enriched = (data || []).map((m) => ({
    ...m,
    my_role: byMission[m.id]?.role ?? null,
    my_done: !!byMission[m.id]?.done,
  }));
  return { data: enriched, error: null };
}

// ---------- Single mission -------------------------------------------

export async function getMission(missionId) {
  const [{ data: mission, error: e1 }, itemsResp, opsResp] = await Promise.all([
    supabase.from("missions").select("*").eq("id", missionId).maybeSingle(),
    supabase.from("mission_checklist_items")
      .select("*").eq("mission_id", missionId)
      .order("section").order("order_no"),
    supabase.from("mission_operators")
      .select("mission_id, user_id, role, done, done_at, profiles!inner(id, callsign, full_name, role)")
      .eq("mission_id", missionId),
  ]);
  if (e1) return { error: e1 };
  if (!mission) return { error: new Error("Mission not found") };
  return {
    mission,
    items: itemsResp.data || [],
    operators: (opsResp.data || []).map((o) => ({
      user_id: o.user_id,
      role: o.role,
      done: !!o.done,
      done_at: o.done_at,
      callsign: o.profiles?.callsign,
      full_name: o.profiles?.full_name,
      profile_role: o.profiles?.role,
    })),
  };
}

// Current operator's checklist state for a mission.
export async function getMyChecklistState(missionId, userId) {
  if (!missionId || !userId) return { data: [], error: null };
  const { data, error } = await supabase
    .from("mission_operator_state")
    .select("item_id, checked, checked_at")
    .eq("mission_id", missionId)
    .eq("user_id", userId);
  return { data: data || [], error };
}

// Full per-operator state (squad leader / officer rollup view).
export async function getAllChecklistState(missionId) {
  if (!missionId) return { data: [], error: null };
  const { data, error } = await supabase
    .from("mission_operator_state")
    .select("user_id, item_id, checked, checked_at")
    .eq("mission_id", missionId);
  return { data: data || [], error };
}

// ---------- Mutations ------------------------------------------------

export async function createMission({
  name, squadId, scheduledAt, location, notes, operators, items,
  kind = "operational", dueAt = null,
}) {
  const { data, error } = await supabase.rpc("create_mission", {
    p_name:         name,
    p_squad_id:     squadId || null,
    p_scheduled_at: scheduledAt || null,
    p_location:     location || "",
    p_notes:        notes || "",
    p_operators:    operators || [],
    p_items:        kind === "admin" ? null : (items || null),
    p_kind:         kind,
    p_due_at:       dueAt || null,
  });
  return { data, error };
}

export async function setAdminTaskDone({ missionId, done }) {
  const { error } = await supabase.rpc("set_admin_task_done", {
    p_mission_id: missionId,
    p_done:       done,
  });
  return { error };
}

export async function getAdminTaskReadiness(missionId) {
  const { data, error } = await supabase.rpc("admin_task_readiness", {
    p_mission_id: missionId,
  });
  return { data: data || [], error };
}

export async function toggleChecklistItem({ missionId, itemId, checked }) {
  const { error } = await supabase.rpc("toggle_checklist_item", {
    p_mission_id: missionId,
    p_item_id:    itemId,
    p_checked:    checked,
  });
  return { error };
}

export async function updateMissionStatus(missionId, status) {
  const { error } = await supabase
    .from("missions")
    .update({ status })
    .eq("id", missionId);
  return { error };
}

export async function deleteMission(missionId) {
  const { error } = await supabase
    .from("missions")
    .delete()
    .eq("id", missionId);
  return { error };
}

// ---------- Readiness rollup -----------------------------------------

export async function getMissionReadiness(missionId) {
  const { data, error } = await supabase.rpc("mission_readiness", {
    p_mission_id: missionId,
  });
  return { data: data || [], error };
}

// ---------- Realtime subscription helper -----------------------------

export function subscribeMissionRealtime(missionId, onChange) {
  const channel = supabase.channel(`mission:${missionId}`)
    .on("postgres_changes", {
      event: "*", schema: "public", table: "mission_operator_state",
      filter: `mission_id=eq.${missionId}`,
    }, onChange)
    .on("postgres_changes", {
      event: "*", schema: "public", table: "mission_checklist_items",
      filter: `mission_id=eq.${missionId}`,
    }, onChange)
    .on("postgres_changes", {
      event: "*", schema: "public", table: "mission_operators",
      filter: `mission_id=eq.${missionId}`,
    }, onChange)
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}
