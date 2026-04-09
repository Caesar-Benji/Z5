import { useEffect, useState } from "react";
import { useAuth, roleLabel, canCreateWholeTeamTask } from "../auth";
import { supabase } from "../supabase";
import { createMission } from "../data/missions";
import {
  Panel, PageHeader, Btn, Input, Textarea, Field, ErrLine, OkLine, Badge,
} from "../ui";
import { useIsMobile } from "../useIsMobile";
import { C, S, FONT_MONO } from "../theme";
import {
  DEFAULT_ITEMS, SECTIONS, SECTION_LABELS, OPERATOR_ROLES,
  MISSION_KINDS,
} from "../missionTemplate";

export default function MissionCreate({ onCreated, onCancel, prefillDate }) {
  const { profile } = useAuth();
  const isMobile = useIsMobile();

  const [kind, setKind] = useState("operational");

  const [name, setName] = useState("");
  const [squadId, setSquadId] = useState(profile?.squad_id || "");
  const [scheduledAt, setScheduledAt] = useState(
    prefillDate ? dateToLocalInput(prefillDate, 9) : defaultDateTime(2)
  );
  const [dueAt, setDueAt] = useState(
    prefillDate ? dateToLocalInput(prefillDate, 17) : defaultDateTime(24)
  );
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");

  const [squads, setSquads] = useState([]);
  const [members, setMembers] = useState([]);          // for operational: members of selected squad
  const [allTeamMembers, setAllTeamMembers] = useState([]); // for admin: entire team
  const [assigned, setAssigned] = useState({});        // user_id -> role key (operational) OR "yes" (admin)
  const [items, setItems] = useState(DEFAULT_ITEMS);

  // Admin task scope: "team" | "squad" | "people"
  const [scope, setScope] = useState("team");

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  const isAdminOfficer = profile?.role === "admin" || profile?.role === "officer";
  const canWholeTeam   = canCreateWholeTeamTask(profile?.role);

  // Load squads. Squad leaders are locked to their own squad.
  useEffect(() => {
    (async () => {
      const { data: sq } = await supabase.from("squads").select("*").order("name");
      const allowed = isAdminOfficer
        ? (sq || [])
        : (sq || []).filter((s) => s.id === profile?.squad_id);
      setSquads(allowed);
      if (!squadId && allowed[0]) setSquadId(allowed[0].id);
    })();
  }, [isAdminOfficer, profile?.squad_id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load members of currently selected squad (used by operational + "pick squad" scope).
  useEffect(() => {
    if (!squadId) { setMembers([]); return; }
    (async () => {
      const { data } = await supabase.from("profiles")
        .select("id, callsign, full_name, role, squad_id")
        .eq("squad_id", squadId)
        .order("callsign");
      setMembers(data || []);
    })();
  }, [squadId]);

  // Load entire team (admin/officer only, used by "whole team" and "pick individuals").
  useEffect(() => {
    if (kind !== "admin" || !canWholeTeam) return;
    (async () => {
      const { data } = await supabase.from("profiles")
        .select("id, callsign, full_name, role, squad_id")
        .order("callsign");
      setAllTeamMembers(data || []);
    })();
  }, [kind, canWholeTeam]);

  // When switching kind, reset assignments so we don't send stale roles.
  useEffect(() => {
    setAssigned({});
    setErr(""); setOk("");
    if (kind === "admin") {
      // Default scope for leads (no whole-team permission) is "squad".
      setScope(canWholeTeam ? "team" : "squad");
    }
  }, [kind]); // eslint-disable-line react-hooks/exhaustive-deps

  // When changing scope within admin, reset assignments + adjust squadId.
  function changeScope(next) {
    setScope(next);
    setAssigned({});
    if (next === "team") {
      // nothing to prefill
    } else if (next === "squad") {
      if (!squadId && squads[0]) setSquadId(squads[0].id);
    }
  }

  async function submit(e) {
    e.preventDefault();
    setErr(""); setOk("");

    if (!name.trim()) { setErr("Name required"); return; }

    let operatorsArr = [];
    let effectiveSquadId = null;

    if (kind === "operational") {
      operatorsArr = Object.entries(assigned)
        .filter(([, role]) => !!role)
        .map(([user_id, role]) => ({ user_id, role }));
      if (!squadId) { setErr("Select a squad"); return; }
      if (operatorsArr.length === 0) { setErr("Assign at least one operator"); return; }
      if (items.length === 0) { setErr("Checklist cannot be empty"); return; }
      effectiveSquadId = squadId;
    } else {
      // admin
      if (scope === "team") {
        if (!canWholeTeam) { setErr("Only admin/officer can post whole-team tasks"); return; }
        operatorsArr = allTeamMembers.map((m) => ({ user_id: m.id, role: "" }));
        effectiveSquadId = null;
      } else if (scope === "squad") {
        if (!squadId) { setErr("Select a squad"); return; }
        operatorsArr = members.map((m) => ({ user_id: m.id, role: "" }));
        effectiveSquadId = squadId;
      } else if (scope === "people") {
        operatorsArr = Object.keys(assigned)
          .filter((uid) => assigned[uid])
          .map((uid) => ({ user_id: uid, role: "" }));
        effectiveSquadId = null; // visible only to picked individuals
      }
      if (operatorsArr.length === 0) { setErr("No assignees selected"); return; }
    }

    setBusy(true);
    const { data, error } = await createMission({
      name:        name.trim(),
      squadId:     effectiveSquadId,
      scheduledAt: kind === "operational" && scheduledAt
                     ? new Date(scheduledAt).toISOString() : null,
      dueAt:       kind === "admin" && dueAt
                     ? new Date(dueAt).toISOString() : null,
      location:    location.trim(),
      notes:       notes.trim(),
      operators:   operatorsArr,
      items:       kind === "operational" ? items : null,
      kind,
    });
    setBusy(false);
    if (error) { setErr(String(error.message || error)); return; }
    setOk(kind === "admin" ? "Task posted." : "Mission created.");
    onCreated?.(data);
  }

  function toggleOperator(userId, role) {
    setAssigned((a) => {
      const next = { ...a };
      if (next[userId] === role) delete next[userId];
      else next[userId] = role;
      return next;
    });
  }

  function togglePerson(userId) {
    setAssigned((a) => {
      const next = { ...a };
      if (next[userId]) delete next[userId];
      else next[userId] = "yes";
      return next;
    });
  }

  // Dedup candidate list for "pick individuals" scope.
  const individualsPool = kind === "admin" && canWholeTeam
    ? allTeamMembers
    : members;

  return (
    <>
      <PageHeader
        title={kind === "admin" ? "New admin task" : "New mission"}
        subtitle={kind === "admin"
          ? "Push an order to individuals, a squad, or the whole team."
          : "Name, schedule, squad, operator roles and loadout."}
        action={
          <div style={{ display: "flex", gap: 10 }}>
            <Btn onClick={onCancel} fullWidth={isMobile}>Cancel</Btn>
          </div>
        }
      />

      <form onSubmit={submit}>
        {/* Type toggle */}
        <Panel title="Type">
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {MISSION_KINDS.map((k) => (
              <Btn
                key={k.key}
                type="button"
                active={kind === k.key}
                onClick={() => setKind(k.key)}
              >
                {k.icon} {k.label}
              </Btn>
            ))}
          </div>
          <div style={{ color: C.dim, fontSize: 12, marginTop: 8 }}>
            {kind === "operational"
              ? "Operational mission: scheduled field work with a loadout checklist."
              : "Admin task: lightweight order with a due date and done/not-done per person."}
          </div>
        </Panel>

        <Panel title={kind === "admin" ? "Task details" : "Mission details"}>
          <Field label={kind === "admin" ? "Title" : "Mission name"}>
            <Input value={name} onChange={(e) => setName(e.target.value)}
                   placeholder={kind === "admin"
                     ? "e.g. UPDATE DOPE CARDS"
                     : "e.g. OP BLACKPINE"} />
          </Field>

          {kind === "operational" && (
            <div style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
              gap: 14,
            }}>
              <Field label="Date & time">
                <Input type="datetime-local" value={scheduledAt}
                       onChange={(e) => setScheduledAt(e.target.value)} />
              </Field>
              <Field label="Squad">
                <select value={squadId}
                        onChange={(e) => setSquadId(e.target.value)}
                        style={selectStyle(isMobile)}>
                  {squads.length === 0 && <option value="">— No squads —</option>}
                  {squads.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </Field>
            </div>
          )}

          {kind === "admin" && (
            <Field label="Due date & time">
              <Input type="datetime-local" value={dueAt}
                     onChange={(e) => setDueAt(e.target.value)} />
            </Field>
          )}

          <Field label={kind === "admin" ? "Location (optional)" : "Location"}>
            <Input value={location} onChange={(e) => setLocation(e.target.value)}
                   placeholder="Grid, area or rally point" />
          </Field>
          <Field label={kind === "admin" ? "Body" : "Notes"}>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)}
                      placeholder={kind === "admin"
                        ? "Order details, what needs to be done, by when…"
                        : "Briefing notes, threat, rules of engagement…"} />
          </Field>
        </Panel>

        {/* Assignees */}
        {kind === "operational" && (
          <Panel title={`Operators (${Object.values(assigned).filter(Boolean).length} assigned)`}>
            {members.length === 0 && (
              <div style={{ color: C.dim, fontSize: 13 }}>
                No members in this squad yet. Invite snipers from the Roster screen.
              </div>
            )}
            {members.map((m) => (
              <OperatorRow
                key={m.id}
                member={m}
                selectedRole={assigned[m.id] || ""}
                onChange={(role) => toggleOperator(m.id, role)}
                isMobile={isMobile}
              />
            ))}
          </Panel>
        )}

        {kind === "admin" && (
          <Panel title="Assignees">
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
              {canWholeTeam && (
                <Btn type="button" active={scope === "team"} onClick={() => changeScope("team")}>
                  Whole team
                </Btn>
              )}
              <Btn type="button" active={scope === "squad"} onClick={() => changeScope("squad")}>
                Pick squad
              </Btn>
              <Btn type="button" active={scope === "people"} onClick={() => changeScope("people")}>
                Pick individuals
              </Btn>
            </div>

            {scope === "team" && (
              <div style={{ color: C.dim, fontSize: 13 }}>
                Task will be posted to every operator ({allTeamMembers.length} people).
              </div>
            )}

            {scope === "squad" && (
              <>
                <Field label="Squad">
                  <select value={squadId}
                          onChange={(e) => setSquadId(e.target.value)}
                          style={selectStyle(isMobile)}>
                    {squads.length === 0 && <option value="">— No squads —</option>}
                    {squads.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </Field>
                <div style={{ color: C.dim, fontSize: 12 }}>
                  {members.length} member{members.length === 1 ? "" : "s"} in this squad.
                </div>
              </>
            )}

            {scope === "people" && (
              <>
                <div style={{ color: C.dim, fontSize: 12, marginBottom: 8 }}>
                  Tap operators to toggle them on/off.
                </div>
                {individualsPool.length === 0 && (
                  <div style={{ color: C.dim, fontSize: 13 }}>No operators to select.</div>
                )}
                {individualsPool.map((m) => (
                  <PersonPickRow
                    key={m.id}
                    member={m}
                    selected={!!assigned[m.id]}
                    onToggle={() => togglePerson(m.id)}
                    isMobile={isMobile}
                  />
                ))}
              </>
            )}
          </Panel>
        )}

        {/* Checklist — operational only */}
        {kind === "operational" && (
          <Panel
            title="Checklist"
            action={
              <Btn small onClick={(e) => { e.preventDefault(); setItems(DEFAULT_ITEMS); }}>
                Reset to default
              </Btn>
            }
          >
            <div style={{ color: C.dim, fontSize: 12, marginBottom: 14 }}>
              Edit labels, add or remove items. Role sections (REC10 / Bolt / Spotter-TL)
              only apply to operators assigned that role. The common sections apply to
              every operator on the mission.
            </div>
            {SECTIONS.map((sec) => (
              <SectionEditor
                key={sec.key}
                section={sec}
                items={items.filter((it) => it.section === sec.key)}
                onItemsChange={(sectionItems) => {
                  setItems((all) => [
                    ...all.filter((it) => it.section !== sec.key),
                    ...sectionItems.map((it, idx) => ({
                      ...it,
                      section: sec.key,
                      order_no: idx + 1,
                    })),
                  ]);
                }}
              />
            ))}
          </Panel>
        )}

        <ErrLine>{err}</ErrLine>
        <OkLine>{ok}</OkLine>

        <div style={{
          display: "flex",
          gap: 10,
          marginTop: 10,
          flexDirection: isMobile ? "column" : "row",
        }}>
          <Btn primary type="submit" disabled={busy} fullWidth={isMobile}>
            {busy ? (kind === "admin" ? "Posting…" : "Creating…")
                  : (kind === "admin" ? "Post task" : "Create mission")}
          </Btn>
          <Btn type="button" onClick={onCancel} fullWidth={isMobile}>
            Cancel
          </Btn>
        </div>
      </form>
    </>
  );
}

function selectStyle(isMobile) {
  return {
    ...S.input,
    fontSize: isMobile ? 16 : S.input.fontSize,
    minHeight: isMobile ? 46 : undefined,
  };
}

function OperatorRow({ member, selectedRole, onChange, isMobile }) {
  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: 12,
      padding: "10px 0",
      borderBottom: `1px solid ${C.border}`,
      flexWrap: "wrap",
    }}>
      <div style={{ flex: 1, minWidth: 140 }}>
        <div style={{
          fontFamily: FONT_MONO,
          color: C.bright,
          fontWeight: 600,
          fontSize: 14,
          letterSpacing: "0.3px",
        }}>
          {member.callsign || "—"}
        </div>
        <div style={{ color: C.dim, fontSize: 12 }}>
          {member.full_name || <span style={{ color: C.dimmer }}>—</span>}
          {" · "}
          <span>{roleLabel(member.role)}</span>
        </div>
      </div>
      <select
        value={selectedRole}
        onChange={(e) => onChange(e.target.value)}
        style={{
          ...S.input,
          width: isMobile ? "100%" : 200,
          fontSize: isMobile ? 16 : S.input.fontSize,
          minHeight: isMobile ? 46 : undefined,
        }}
      >
        <option value="">— Not assigned —</option>
        {OPERATOR_ROLES.map((r) => (
          <option key={r.key} value={r.key}>{r.label}</option>
        ))}
      </select>
    </div>
  );
}

function PersonPickRow({ member, selected, onToggle, isMobile }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      style={{
        all: "unset",
        display: "flex",
        alignItems: "center",
        gap: 12,
        width: "100%",
        boxSizing: "border-box",
        padding: isMobile ? "12px 4px" : "10px 4px",
        minHeight: isMobile ? 48 : 40,
        borderBottom: `1px solid ${C.border}`,
        cursor: "pointer",
      }}
    >
      <span style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 22,
        height: 22,
        flexShrink: 0,
        border: `1px solid ${selected ? C.ok : C.borderBright}`,
        background: selected ? "rgba(85,255,153,0.15)" : "transparent",
        color: selected ? C.ok : "transparent",
        fontSize: 16,
        fontWeight: 700,
        borderRadius: 2,
      }}>
        ✓
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: FONT_MONO,
          color: C.bright,
          fontWeight: 600,
          fontSize: 14,
        }}>
          {member.callsign || "—"}
        </div>
        <div style={{
          color: C.dim,
          fontSize: 12,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}>
          {member.full_name || "—"} · {roleLabel(member.role)}
        </div>
      </div>
    </button>
  );
}

function SectionEditor({ section, items, onItemsChange }) {
  const [collapsed, setCollapsed] = useState(false);

  function updateItem(idx, label) {
    const next = items.map((it, i) => (i === idx ? { ...it, label } : it));
    onItemsChange(next);
  }
  function removeItem(idx) {
    onItemsChange(items.filter((_, i) => i !== idx));
  }
  function addItem() {
    onItemsChange([...items, { label: "New item", order_no: items.length + 1 }]);
  }

  return (
    <div style={{
      border: `1px solid ${C.border}`,
      borderRadius: 4,
      padding: "10px 12px",
      marginBottom: 10,
      background: "rgba(255,255,255,0.015)",
    }}>
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        cursor: "pointer",
      }} onClick={() => setCollapsed((c) => !c)}>
        <span style={{
          color: C.dimmer,
          fontSize: 12,
          transform: collapsed ? "none" : "rotate(90deg)",
          transition: "transform 120ms",
          display: "inline-block",
          width: 10,
        }}>▶</span>
        <div style={{
          color: C.bright,
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: "1px",
          textTransform: "uppercase",
          flex: 1,
        }}>
          {SECTION_LABELS[section.key]}
        </div>
        <Badge>{items.length}</Badge>
      </div>

      {!collapsed && (
        <div style={{ marginTop: 10 }}>
          {items.map((it, idx) => (
            <div key={idx} style={{
              display: "flex",
              gap: 8,
              marginBottom: 6,
              alignItems: "center",
            }}>
              <Input value={it.label}
                     onChange={(e) => updateItem(idx, e.target.value)} />
              <Btn small onClick={(e) => { e.preventDefault(); removeItem(idx); }}>
                ×
              </Btn>
            </div>
          ))}
          <div style={{ marginTop: 6 }}>
            <Btn small onClick={(e) => { e.preventDefault(); addItem(); }}>
              + Add item
            </Btn>
          </div>
        </div>
      )}
    </div>
  );
}

function defaultDateTime(offsetHours = 2) {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + offsetHours);
  return fmtLocal(d);
}

// Pre-fill from a calendar Date at a given hour (e.g. 09:00 for scheduled, 17:00 for due).
function dateToLocalInput(date, hour = 9) {
  const d = new Date(date);
  d.setHours(hour, 0, 0, 0);
  return fmtLocal(d);
}

function fmtLocal(d) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
