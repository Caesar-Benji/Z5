// Z5 :: knowledge materials data layer
import { supabase } from "../supabase";

const BUCKET = "knowledge";

// Predefined subject categories
export const SUBJECTS = [
  { key: "wind",              label: "Wind" },
  { key: "shooting_technique", label: "Shooting technique" },
  { key: "physics",           label: "Physics" },
  { key: "gear",              label: "Gear" },
  { key: "camouflage",        label: "Camouflage" },
  { key: "navigation",        label: "Navigation" },
  { key: "communication",     label: "Communication" },
  { key: "general",           label: "General" },
];

export const SUBJECT_MAP = Object.fromEntries(SUBJECTS.map((s) => [s.key, s.label]));

export const WEEKS = [1, 2, 3, 4];

export async function listMaterials({ category, week } = {}) {
  let q = supabase
    .from("knowledge_materials")
    .select("*")
    .order("week", { ascending: true, nullsFirst: true })
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });
  if (category && category !== "all") {
    q = q.eq("category", category);
  }
  if (week !== undefined && week !== null && week !== "all") {
    q = q.eq("week", week);
  }
  const { data, error } = await q;
  return { data: data || [], error };
}

export async function listCategories() {
  const { data, error } = await supabase
    .from("knowledge_materials")
    .select("category");
  if (error) return { data: [], error };
  const unique = [...new Set((data || []).map((d) => d.category))].sort();
  return { data: unique, error: null };
}

export async function uploadMaterial({ file, title, description, category, week }) {
  const ts = Date.now();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const filePath = `${ts}_${safeName}`;

  const { error: uploadErr } = await supabase.storage
    .from(BUCKET)
    .upload(filePath, file, { upsert: false });
  if (uploadErr) return { error: uploadErr };

  const { error: dbErr } = await supabase.from("knowledge_materials").insert({
    title: title.trim(),
    description: description.trim(),
    category: category.trim() || "general",
    file_name: file.name,
    file_path: filePath,
    file_size: file.size,
    week: week || null,
  });
  if (dbErr) return { error: dbErr };

  return { error: null };
}

export async function deleteMaterial(material) {
  const { error: storErr } = await supabase.storage
    .from(BUCKET)
    .remove([material.file_path]);
  if (storErr) console.warn("Storage delete failed:", storErr);

  const { error } = await supabase
    .from("knowledge_materials")
    .delete()
    .eq("id", material.id);
  return { error };
}

export function getMaterialUrl(filePath) {
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(filePath);
  return data?.publicUrl || "";
}

export function subscribeKnowledge(onChange) {
  const ch = supabase.channel("z5-knowledge")
    .on("postgres_changes",
        { event: "*", schema: "public", table: "knowledge_materials" },
        onChange)
    .subscribe();
  return () => { supabase.removeChannel(ch); };
}
