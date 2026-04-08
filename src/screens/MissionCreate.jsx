import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth, roleLabel } from "../auth";
import { supabase } from "../supabase";
import { createMission } from "../data/missions";
import {
  Panel, PageHeader, Btn, Input, Textarea, Field, ErrLine, OkLine, Badge, Mono,
} from "../ui";
import { useIsMobile } from "../useIsMobile";
import { C, S, FONT_MONO } from "../theme";
import {
  DEFAULT_ITEMS, SECTIONS, SECTION_LABELS, OPERATOR_ROLES, OPERATOR_ROLE_LABELS,
} from "../missionTemplate";

export default function MissionCreate({ onCreated, onCancel }) {
  const { profile } = useAuth();
  const isMobile = useIsMobile();

  const [name, setName] = useState("");
  const [squadId, setSquadId] = useState(profile?.squad_id || "");
  const [scheduledAt, setScheduledAt] = useState(defaultDateTime());
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");

  const [squads, setSquads] = useState([]);
  const [members, setMembers] = useState([]); // profiles in selected squad
  const [assigned, setAssigned] = useState({}); // user_id -> role key
  const [items, setItems] = useState(DEFAULT_ITEMS);

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  const isAdminOfficer = profile?.role === "admin" || profile?.role === "officer";

  // Load squads + members. Squad leaders are locked to their own squad.
  useEffect(() => {
    (async () => {
      const [{ data: sq }] = await Promise.all([
        supabase.from("squads").select("*").order("name"),
      ]);
      const allowed = isAdminOfficer
        ? (sq || [])
        : (sq || []).filter((s) => s.id === profile?.squad_id);
      setSquads(allowed);
      if (!squadId && allowed[0]) setSquadId(allowed[0].id);
    })();
  }, [isAdminOfficer, profile?.squad_id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load members whenever squad changes.
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

  async function submit(e) {
    e.preventDefault();
    setErr(""); setOk("");
    const operatorsArr = Object.entries(assigned)
      .filter(([, role]) => !!role)
      .map(([user_id, role]) => ({ user_id, role }));
    if (!name.trim())       { setErr("Mission name required");        return; }
    if (!squadId)           { setErr("Select a squad");               return; }
    if (operatorsArr.length === 0) { setErr("Assign at least one operator"); return; }
    if (items.length === 0) { setErr("Checklist cannot be empty");    return; }
    setBusy(true);
    const { data, error } = await createMission({
      name: name.trim(),
      squadId,
      scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : null,
      location: location.trim(),
      notes: notes.trim(),
      operators: operatorsArr,
      items,
    });
    setBusy(false);
    if (error) { setErr(String(error.message || error)); return; }
    setOk("Mission created.");
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

  return (
    <>
      <PageHeader
        title="New mission"
        subtitle="Name, schedule, squad, operator roles and loadout."
        action={
          <div style={{ display: "flex", gap: 10 }}>
            <Btn onClick={onCancel} fullWidth={isMobile}>Cancel</Btn>
          </div>
        }
      />

      <form onSubmit={submit}>
        <Panel title="Mission details">
          <Field label="Mission name">
            <Input value={name} onChange={(e) => setName(e.target.value)}
                   placeholder="e.g. OP BLACKPINE" />
          </Field>
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
                      style={{
                        ...S.input,
                        fontSize: isMobile ? 16 : S.input.fontSize,
                        minHeight: isMobile ? 46 : undefined,
                      }}>
                {squads.length === 0 && <option value="">— No squads —</option>}
                {squads.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Location">
            <Input value={location} onChange={(e) => setLocation(e.target.value)}
                   placeholder="Grid, area or rally point" />
          </Field>
          <Field label="Notes">
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)}
                      placeholder="Briefing notes, threat, rules of engagement…" />
          </Field>
        </Panel>

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

        <ErrLine>{err}</ErrLine>
        <OkLine>{ok}</OkLine>

        <div style={{
          display: "flex",
          gap: 10,
          marginTop: 10,
          flexDirection: isMobile ? "column" : "row",
        }}>
          <Btn primary type="submit" disabled={busy} fullWidth={isMobile}>
            {busy ? "Creating…" : "Create mission"}
          </Btn>
          <Btn type="button" onClick={onCancel} fullWidth={isMobile}>
            Cancel
          </Btn>
        </div>
      </form>
    </>
  );
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

function defaultDateTime() {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 2);
  // yyyy-mm-ddThh:mm for datetime-local input
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
