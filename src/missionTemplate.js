// Z5 :: shared mission / checklist constants
//
// These must stay in sync with schema_v3.sql's
// `default_checklist_items()` function and the `section_applies_to_role`
// helper. Any change here requires a matching SQL change (and a
// re-run of schema_v3.sql in Supabase).

// ---------- Sections ---------------------------------------------------

export const SECTIONS = [
  { key: "sniper_rec10", label: "Sniper — REC10",        role: "rec10"      },
  { key: "sniper_bolt",  label: "Sniper — Bolt Action",  role: "bolt"       },
  { key: "spotter_tl",   label: "Spotter / Team Leader", role: "spotter_tl" },
  { key: "all",          label: "All Team Members",      role: null         },
  { key: "final_check",  label: "Final Quick Check",     role: null         },
  { key: "final_ready",  label: "Final Ready",           role: null         },
];

export const SECTION_LABELS = Object.fromEntries(
  SECTIONS.map((s) => [s.key, s.label])
);

// Sections that apply to every operator regardless of their assigned role.
export const COMMON_SECTIONS = new Set(["all", "final_check", "final_ready"]);

// ---------- Operator roles --------------------------------------------

export const OPERATOR_ROLES = [
  { key: "rec10",      label: "REC10 Sniper" },
  { key: "bolt",       label: "Bolt Sniper"  },
  { key: "spotter_tl", label: "Spotter / TL" },
];

export const OPERATOR_ROLE_LABELS = Object.fromEntries(
  OPERATOR_ROLES.map((r) => [r.key, r.label])
);

// Given an operator role, return the set of section keys that operator
// is responsible for on a mission. Used to filter items in the UI.
export function sectionsForRole(role) {
  const base = new Set(["all", "final_check", "final_ready"]);
  if (role === "rec10")      base.add("sniper_rec10");
  if (role === "bolt")       base.add("sniper_bolt");
  if (role === "spotter_tl") base.add("spotter_tl");
  return base;
}

// ---------- Default template ------------------------------------------
// Mirror of schema_v3.sql's default_checklist_items(). When the Create
// Mission form opens with no overrides, this is what gets shown in
// the editor so the author can tweak before saving.

export const DEFAULT_ITEMS = [
  // SNIPER — REC10
  { section: "sniper_rec10", order_no: 1, label: "Rifle (REC10)" },
  { section: "sniper_rec10", order_no: 2, label: "Suppressor" },
  { section: "sniper_rec10", order_no: 3, label: "5× Magazines" },
  { section: "sniper_rec10", order_no: 4, label: "Day Optic" },
  { section: "sniper_rec10", order_no: 5, label: "Night Optic" },
  { section: "sniper_rec10", order_no: 6, label: "Delta Point" },
  { section: "sniper_rec10", order_no: 7, label: "Shooting Tripod" },
  { section: "sniper_rec10", order_no: 8, label: "Helmet Night Vision" },
  { section: "sniper_rec10", order_no: 9, label: "Batteries" },
  // SNIPER — BOLT ACTION
  { section: "sniper_bolt",  order_no: 1,  label: "Bolt Rifle" },
  { section: "sniper_bolt",  order_no: 2,  label: "Suppressor" },
  { section: "sniper_bolt",  order_no: 3,  label: "5× Magazines" },
  { section: "sniper_bolt",  order_no: 4,  label: "Day Optic" },
  { section: "sniper_bolt",  order_no: 5,  label: "Night Optic" },
  { section: "sniper_bolt",  order_no: 6,  label: "Tripod" },
  { section: "sniper_bolt",  order_no: 7,  label: "AR15" },
  { section: "sniper_bolt",  order_no: 8,  label: "AR15 Optic" },
  { section: "sniper_bolt",  order_no: 9,  label: "Helmet NV" },
  { section: "sniper_bolt",  order_no: 10, label: "Batteries" },
  // SPOTTER / TEAM LEADER
  { section: "spotter_tl",   order_no: 1, label: "AR15" },
  { section: "spotter_tl",   order_no: 2, label: "Day Optic" },
  { section: "spotter_tl",   order_no: 3, label: "Radio" },
  { section: "spotter_tl",   order_no: 4, label: "Day Spotter Optic" },
  { section: "spotter_tl",   order_no: 5, label: "Thermal Optic" },
  { section: "spotter_tl",   order_no: 6, label: "Helmet NV" },
  { section: "spotter_tl",   order_no: 7, label: "Batteries" },
  // ALL TEAM MEMBERS
  { section: "all",          order_no: 1, label: "Plate Carrier" },
  { section: "all",          order_no: 2, label: "Helmet" },
  { section: "all",          order_no: 3, label: "Backpack" },
  { section: "all",          order_no: 4, label: "Camouflage Kit" },
  { section: "all",          order_no: 5, label: "Water" },
  { section: "all",          order_no: 6, label: "Food" },
  { section: "all",          order_no: 7, label: "Medical Kit" },
  // FINAL QUICK CHECK
  { section: "final_check",  order_no: 1, label: "Weapon System" },
  { section: "final_check",  order_no: 2, label: "Optics (Day/Night)" },
  { section: "final_check",  order_no: 3, label: "Vision (NV/Thermal)" },
  { section: "final_check",  order_no: 4, label: "Comms" },
  { section: "final_check",  order_no: 5, label: "Support Gear" },
  { section: "final_check",  order_no: 6, label: "Batteries" },
  // FINAL READY
  { section: "final_ready",  order_no: 1, label: "No Missing Gear" },
  { section: "final_ready",  order_no: 2, label: "No Loose Items" },
  { section: "final_ready",  order_no: 3, label: "Weight Balanced" },
  { section: "final_ready",  order_no: 4, label: "Systems Working" },
];

// ---------- Mission status --------------------------------------------

export const MISSION_STATUSES = [
  { key: "scheduled", label: "Scheduled", tone: "default" },
  { key: "active",    label: "Active",    tone: "ok"      },
  { key: "complete",  label: "Complete",  tone: "bright"  },
  { key: "cancelled", label: "Cancelled", tone: "error"   },
  { key: "draft",     label: "Draft",     tone: "warn"    },
];

export const MISSION_STATUS_LABELS = Object.fromEntries(
  MISSION_STATUSES.map((s) => [s.key, s.label])
);

export const MISSION_STATUS_TONES = Object.fromEntries(
  MISSION_STATUSES.map((s) => [s.key, s.tone])
);
