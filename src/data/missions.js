// Z5 :: missions data layer
// Thin wrappers around supabase for mission CRUD and per-operator state.
import { supabase } from "../supabase";

// ---------- Mission list ---------------------------------------------

export async function listMissions({ squadId, onlyUpcoming = false, limit = 50 } = {}) {
  let q = supabase.from("missions")
    .select("*")
    .order("scheduled_at", { ascending: true, nullsFirst: false })
    .limit(limit);
  if (squadId) q = q.eq("squad_id", squadId);
  if (onlyUpcoming) {
    q = q.in("status", ["scheduled", "active"]);
  }
  const { data, error } = await q;
  return { data: data || [], error };
}

// Missions the current operator is personally assigned to.
export async function listMyUpcomingMissions(userId, { limit = 5 } = {}) {
  if (!userId) return { data: [], error: null };
  const { data: mops, error: e1 } = await supabase
    .from("mission_operators")
    .select("mission_id, role")
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

  // Join role locally.
  const roleByMission = Object.fromEntries((mops || []).map((m) => [m.mission_id, m.role]));
  const enriched = (data || []).map((m) => ({ ...m, my_role: roleByMission[m.id] }));
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
      .select("mission_id, user_id, role, profiles!inner(id, callsign, full_name, role)")
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
}) {
  const { data, error } = await supabase.rpc("create_mission", {
    p_name:         name,
    p_squad_id:     squadId,
    p_scheduled_at: scheduledAt || null,
    p_location:     location || "",
    p_notes:        notes || "",
    p_operators:    operators || [],
    p_items:        items || null,
  });
  return { data, error };
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
