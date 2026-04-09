// Z5 :: announcements data layer
import { supabase } from "../supabase";

export async function listRecentAnnouncements({ limit = 5 } = {}) {
  const { data, error } = await supabase
    .from("announcements")
    .select("*")
    .order("posted_at", { ascending: false })
    .limit(limit);
  return { data: data || [], error };
}

export async function postAnnouncement({ scope, squadId, title, body }) {
  const payload = {
    scope,
    squad_id: scope === "squad" ? squadId : null,
    title: title || "",
    body,
  };
  const { error } = await supabase.from("announcements").insert(payload);
  return { error };
}

export async function updateAnnouncement(id, { title, body }) {
  const { error } = await supabase.from("announcements")
    .update({ title, body })
    .eq("id", id);
  return { error };
}

export async function deleteAnnouncement(id) {
  const { error } = await supabase.from("announcements").delete().eq("id", id);
  return { error };
}

export function subscribeAnnouncements(onChange) {
  const ch = supabase.channel("z5-announcements")
    .on("postgres_changes",
        { event: "*", schema: "public", table: "announcements" },
        onChange)
    .subscribe();
  return () => { supabase.removeChannel(ch); };
}
