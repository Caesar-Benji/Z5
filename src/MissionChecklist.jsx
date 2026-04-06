import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";

// =====================================================================
// MISSION CHECKLIST :: terminal-styled, supabase-synced
// Single-component .jsx. Imports supabase-js and reads env vars.
// =====================================================================

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  realtime: { params: { eventsPerSecond: 10 } },
});

// ---------- CONSTANTS ------------------------------------------------

const CHECKLIST_STEPS = [
  { key: "weapon_clean",     label: "WEAPON CLEANED AND INSPECTED" },
  { key: "scope_zero",       label: "SCOPE ZEROED AND CONFIRMED" },
  { key: "ammo_count",       label: "AMMUNITION COUNT VERIFIED" },
  { key: "suppressor",       label: "SUPPRESSOR THREAD CHECK" },
  { key: "comms",            label: "RADIO COMMS CHECK" },
  { key: "batteries",        label: "BATTERIES (OPTIC, RADIO, NVG) CHARGED" },
  { key: "ghillie",          label: "GHILLIE / CAMOUFLAGE PREPARED" },
  { key: "dope",             label: "RANGE CARD / DOPE SHEET UPDATED" },
  { key: "weather",          label: "WEATHER & WIND DATA REVIEWED" },
  { key: "rally",            label: "RALLY POINT AND EXTRACTION PLAN CONFIRMED" },
  { key: "medkit",           label: "MEDICAL KIT INSPECTED" },
  { key: "backup_optic",     label: "BACKUP OPTIC AVAILABLE" },
  { key: "briefing",         label: "TEAM BRIEFING COMPLETED" },
];

const DEFAULT_EQUIPMENT_SLOTS = [
  "PRIMARY WEAPON",
  "SCOPE / OPTIC",
  "SUPPRESSOR",
  "SECONDARY WEAPON",
  "RADIO",
  "NVG / THERMAL",
];

// ---------- HELPERS --------------------------------------------------

async function sha256Hex(text) {
  const buf = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function nowIso() {
  return new Date().toISOString();
}

function fmtTime(iso) {
  if (!iso) return "--";
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

// Persist operator identity locally so refresh doesn't kick them out.
const STORAGE_KEY = "mission_checklist_session_v1";
function loadSession() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "null"); }
  catch { return null; }
}
function saveSession(s) {
  if (s) localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  else localStorage.removeItem(STORAGE_KEY);
}

// Offline mutation queue
const QUEUE_KEY = "mission_checklist_queue_v1";
function loadQueue() {
  try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]"); }
  catch { return []; }
}
function saveQueue(q) { localStorage.setItem(QUEUE_KEY, JSON.stringify(q)); }

// =====================================================================
// ROOT COMPONENT
// =====================================================================

export default function MissionChecklist() {
  const [session, setSession] = useState(loadSession);
  const [view, setView] = useState("checklist"); // 'checklist' | 'rollup'

  // Boot screen if no session
  if (!session) {
    return <BootScreen onJoin={(s) => { saveSession(s); setSession(s); }} />;
  }

  return (
    <ScanlineWrap>
      <TopBar
        session={session}
        view={view}
        onView={setView}
        onLogout={() => { saveSession(null); setSession(null); }}
      />
      {view === "checklist"
        ? <ChecklistScreen session={session} />
        : <RollupScreen session={session} />}
      <Footer />
    </ScanlineWrap>
  );
}

// =====================================================================
// BOOT / LOGIN
// =====================================================================

function BootScreen({ onJoin }) {
  const [mode, setMode] = useState("join"); // 'join' | 'create'
  const [code, setCode] = useState("");
  const [pw, setPw] = useState("");
  const [callsign, setCallsign] = useState("");
  const [name, setName] = useState("");
  const [missionName, setMissionName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function handleJoin() {
    setBusy(true); setErr("");
    try {
      const codeUp = code.trim().toUpperCase();
      const { data: missions, error } = await supabase
        .from("missions").select("*").eq("code", codeUp).limit(1);
      if (error) throw error;
      if (!missions || missions.length === 0) throw new Error("MISSION CODE NOT FOUND");
      const mission = missions[0];
      const hash = await sha256Hex(pw);
      if (hash !== mission.password_hash) throw new Error("SQUAD PASSWORD REJECTED");

      // upsert operator
      const csUp = callsign.trim().toUpperCase();
      if (!csUp) throw new Error("CALLSIGN REQUIRED");
      let { data: existing } = await supabase
        .from("operators").select("*")
        .eq("mission_id", mission.id).eq("callsign", csUp).limit(1);
      let op = existing && existing[0];
      if (!op) {
        const { data: created, error: e2 } = await supabase
          .from("operators").insert({ mission_id: mission.id, callsign: csUp, name })
          .select().single();
        if (e2) throw e2;
        op = created;
      } else {
        await supabase.from("operators")
          .update({ name, last_seen: nowIso() }).eq("id", op.id);
      }
      onJoin({ missionId: mission.id, missionCode: mission.code, operatorId: op.id, callsign: csUp });
    } catch (e) {
      setErr(String(e.message || e).toUpperCase());
    } finally { setBusy(false); }
  }

  async function handleCreate() {
    setBusy(true); setErr("");
    try {
      const codeUp = code.trim().toUpperCase();
      if (!codeUp) throw new Error("MISSION CODE REQUIRED");
      if (!pw)     throw new Error("SQUAD PASSWORD REQUIRED");
      const hash = await sha256Hex(pw);
      const { data: m, error } = await supabase.from("missions").insert({
        code: codeUp, password_hash: hash, name: missionName,
      }).select().single();
      if (error) throw error;

      const csUp = callsign.trim().toUpperCase();
      if (!csUp) throw new Error("CALLSIGN REQUIRED");
      const { data: op, error: e2 } = await supabase.from("operators")
        .insert({ mission_id: m.id, callsign: csUp, name }).select().single();
      if (e2) throw e2;
      onJoin({ missionId: m.id, missionCode: m.code, operatorId: op.id, callsign: csUp });
    } catch (e) {
      setErr(String(e.message || e).toUpperCase());
    } finally { setBusy(false); }
  }

  return (
    <ScanlineWrap>
      <div style={{ padding: "40px 24px", maxWidth: 720, margin: "0 auto" }}>
        <h1 style={{ ...H1 }}>// MISSION CHECKLIST TERMINAL v1.0</h1>
        <div style={{ color: DIM, marginBottom: 24 }}>
          AUTHENTICATE TO PROCEED <Cursor />
        </div>

        <div style={{ marginBottom: 16 }}>
          <button style={mode === "join" ? BTN_ACTIVE : BTN}
                  onClick={() => setMode("join")}>[ JOIN MISSION ]</button>{" "}
          <button style={mode === "create" ? BTN_ACTIVE : BTN}
                  onClick={() => setMode("create")}>[ CREATE MISSION ]</button>
        </div>

        {mode === "create" && (
          <Field label="MISSION NAME">
            <input style={INPUT} value={missionName}
                   onChange={(e) => setMissionName(e.target.value)} />
          </Field>
        )}
        <Field label="MISSION CODE">
          <input style={INPUT} value={code}
                 onChange={(e) => setCode(e.target.value)}
                 placeholder="E.G. NIGHTHAWK-07" />
        </Field>
        <Field label="SQUAD PASSWORD">
          <input style={INPUT} type="password" value={pw}
                 onChange={(e) => setPw(e.target.value)} />
        </Field>
        <Field label="OPERATOR CALLSIGN">
          <input style={INPUT} value={callsign}
                 onChange={(e) => setCallsign(e.target.value)}
                 placeholder="E.G. GHOST-1" />
        </Field>
        <Field label="OPERATOR NAME (OPTIONAL)">
          <input style={INPUT} value={name}
                 onChange={(e) => setName(e.target.value)} />
        </Field>

        <div style={{ marginTop: 16 }}>
          <button style={BTN_PRIMARY} disabled={busy}
                  onClick={mode === "join" ? handleJoin : handleCreate}>
            {busy ? "PROCESSING..." : mode === "join" ? "[ AUTHENTICATE ]" : "[ INITIALIZE ]"}
          </button>
        </div>

        {err && <div style={{ color: "#ff5555", marginTop: 16 }}>! {err}</div>}
      </div>
      <Footer />
    </ScanlineWrap>
  );
}

// =====================================================================
// CHECKLIST SCREEN (the operator's own state)
// =====================================================================

function ChecklistScreen({ session }) {
  const [mission, setMission] = useState(null);
  const [checks, setChecks] = useState({});      // step_key -> bool
  const [equipment, setEquipment] = useState([]); // rows
  const [notes, setNotes] = useState("");
  const [online, setOnline] = useState(navigator.onLine);
  const [queueLen, setQueueLen] = useState(loadQueue().length);

  // Online/offline tracking + queue flush
  useEffect(() => {
    function on() { setOnline(true); flushQueue().then(() => setQueueLen(loadQueue().length)); }
    function off() { setOnline(false); }
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  // Initial load
  useEffect(() => {
    (async () => {
      const { data: m } = await supabase.from("missions")
        .select("*").eq("id", session.missionId).single();
      if (m) { setMission(m); setNotes(m.notes || ""); }

      const { data: cs } = await supabase.from("checklist_state")
        .select("*").eq("operator_id", session.operatorId);
      const map = {};
      (cs || []).forEach((r) => { map[r.step_key] = r.checked; });
      setChecks(map);

      const { data: eq } = await supabase.from("equipment")
        .select("*").eq("operator_id", session.operatorId)
        .order("sort_order", { ascending: true });
      if (!eq || eq.length === 0) {
        // seed default slots
        const seed = DEFAULT_EQUIPMENT_SLOTS.map((slot, i) => ({
          operator_id: session.operatorId, slot, model: "", serial: "", sort_order: i,
        }));
        const { data: inserted } = await supabase.from("equipment")
          .insert(seed).select();
        setEquipment(inserted || []);
      } else {
        setEquipment(eq);
      }
    })();
  }, [session.operatorId, session.missionId]);

  // Heartbeat last_seen
  useEffect(() => {
    const t = setInterval(() => {
      supabase.from("operators")
        .update({ last_seen: nowIso() }).eq("id", session.operatorId);
    }, 15000);
    return () => clearInterval(t);
  }, [session.operatorId]);

  // ---- mutations ----

  function queueOrRun(fn, queueItem) {
    if (online) {
      fn().catch(() => {
        const q = loadQueue(); q.push(queueItem); saveQueue(q); setQueueLen(q.length);
      });
    } else {
      const q = loadQueue(); q.push(queueItem); saveQueue(q); setQueueLen(q.length);
    }
  }

  function toggleStep(key) {
    const next = !checks[key];
    setChecks((prev) => ({ ...prev, [key]: next }));
    queueOrRun(
      () => supabase.from("checklist_state").upsert({
        operator_id: session.operatorId, step_key: key,
        checked: next, checked_at: nowIso(),
      }),
      { kind: "checklist", operator_id: session.operatorId, step_key: key, checked: next, checked_at: nowIso() }
    );
  }

  function updateMissionField(field, value) {
    setMission((m) => ({ ...m, [field]: value }));
    queueOrRun(
      () => supabase.from("missions").update({ [field]: value }).eq("id", session.missionId),
      { kind: "mission", mission_id: session.missionId, patch: { [field]: value } }
    );
  }

  function updateNotes(value) {
    setNotes(value);
    updateMissionField("notes", value);
  }

  function updateEquipment(id, field, value) {
    setEquipment((arr) => arr.map((r) => r.id === id ? { ...r, [field]: value } : r));
    queueOrRun(
      () => supabase.from("equipment").update({ [field]: value }).eq("id", id),
      { kind: "equipment_update", id, patch: { [field]: value } }
    );
  }

  async function addEquipmentRow() {
    const sort = equipment.length;
    const row = { operator_id: session.operatorId, slot: "CUSTOM", model: "", serial: "", sort_order: sort };
    const { data } = await supabase.from("equipment").insert(row).select().single();
    if (data) setEquipment((arr) => [...arr, data]);
  }

  async function removeEquipmentRow(id) {
    setEquipment((arr) => arr.filter((r) => r.id !== id));
    await supabase.from("equipment").delete().eq("id", id);
  }

  // ---- progress ----

  const total = CHECKLIST_STEPS.length;
  const done = CHECKLIST_STEPS.filter((s) => checks[s.key]).length;
  const pct = Math.round((done / total) * 100);
  const ready = done === total;

  // ---- render ----

  if (!mission) return <div style={{ padding: 24, color: GREEN }}>LOADING MISSION DATA...</div>;

  return (
    <div style={{ padding: "16px 24px 64px", maxWidth: 1100, margin: "0 auto" }}>
      <Section title="// MISSION HEADER">
        <Field inline label="MISSION NAME">
          <input style={INPUT} value={mission.name || ""}
                 onChange={(e) => updateMissionField("name", e.target.value)} />
        </Field>
        <Field inline label="DATE / TIME">
          <input style={INPUT} value={mission.date_time || ""}
                 onChange={(e) => updateMissionField("date_time", e.target.value)} />
        </Field>
        <Field inline label="TEAM CALLSIGN">
          <input style={INPUT} value={mission.callsign || ""}
                 onChange={(e) => updateMissionField("callsign", e.target.value)} />
        </Field>
        <Field inline label="OPERATOR">
          <input style={INPUT} readOnly value={session.callsign} />
        </Field>
      </Section>

      <Section title="// EQUIPMENT REGISTRY">
        <table style={TABLE}>
          <thead>
            <tr>
              <th style={TH}>SLOT</th>
              <th style={TH}>MODEL</th>
              <th style={TH}>SERIAL #</th>
              <th style={TH}> </th>
            </tr>
          </thead>
          <tbody>
            {equipment.map((row) => (
              <tr key={row.id}>
                <td style={TD}>
                  <input style={INPUT} value={row.slot}
                         onChange={(e) => updateEquipment(row.id, "slot", e.target.value.toUpperCase())} />
                </td>
                <td style={TD}>
                  <input style={INPUT} value={row.model}
                         onChange={(e) => updateEquipment(row.id, "model", e.target.value)} />
                </td>
                <td style={TD}>
                  <input style={INPUT} value={row.serial}
                         onChange={(e) => updateEquipment(row.id, "serial", e.target.value)} />
                </td>
                <td style={TD}>
                  <button style={BTN_SMALL} onClick={() => removeEquipmentRow(row.id)}>[ X ]</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <button style={BTN} onClick={addEquipmentRow}>[ + ADD ROW ]</button>
      </Section>

      <Section title="// PRE-MISSION CHECKLIST">
        <ol style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {CHECKLIST_STEPS.map((step, idx) => {
            const c = !!checks[step.key];
            return (
              <li key={step.key}
                  onClick={() => toggleStep(step.key)}
                  style={{ cursor: "pointer", padding: "4px 0", color: c ? GREEN : DIM }}>
                <span style={{ display: "inline-block", width: 36 }}>
                  {String(idx + 1).padStart(2, "0")}.
                </span>
                <span style={{ display: "inline-block", width: 28 }}>
                  [{c ? "X" : " "}]
                </span>
                {step.label}
              </li>
            );
          })}
        </ol>
      </Section>

      <Section title="// STATUS">
        <div style={{ marginBottom: 8 }}>
          {done} / {total} COMPLETE [{pct}%]
        </div>
        <div style={{
          border: `1px solid ${GREEN}`, height: 14, width: "100%",
          background: "#000", padding: 1,
        }}>
          <div style={{
            background: GREEN, height: "100%", width: `${pct}%`, transition: "width 120ms",
          }} />
        </div>
        <div style={{
          marginTop: 12, color: ready ? "#7fff7f" : DIM,
          textShadow: ready ? "0 0 6px #7fff7f" : "none",
          fontWeight: "bold",
        }}>
          {ready ? "STATUS: MISSION READY" : "STATUS: PREP IN PROGRESS"}
        </div>
      </Section>

      <Section title="// NOTES">
        <textarea style={{ ...INPUT, height: 140, resize: "vertical" }}
                  value={notes}
                  onChange={(e) => updateNotes(e.target.value)} />
      </Section>

      <div style={{ color: DIM, fontSize: 12 }}>
        LINK: {online ? "ONLINE" : "OFFLINE"} :: QUEUE: {queueLen} :: MISSION CODE: {session.missionCode}
      </div>
    </div>
  );
}

// =====================================================================
// ROLL-UP SCREEN (squad-wide)
// =====================================================================

function RollupScreen({ session }) {
  const [operators, setOperators] = useState([]);
  const [stateByOp, setStateByOp] = useState({}); // op_id -> {step_key:bool}

  const refresh = useCallback(async () => {
    const { data: ops } = await supabase.from("operators")
      .select("*").eq("mission_id", session.missionId)
      .order("callsign", { ascending: true });
    setOperators(ops || []);
    if (ops && ops.length > 0) {
      const ids = ops.map((o) => o.id);
      const { data: cs } = await supabase.from("checklist_state")
        .select("*").in("operator_id", ids);
      const map = {};
      (cs || []).forEach((r) => {
        if (!map[r.operator_id]) map[r.operator_id] = {};
        map[r.operator_id][r.step_key] = r.checked;
      });
      setStateByOp(map);
    }
  }, [session.missionId]);

  useEffect(() => { refresh(); }, [refresh]);

  // Realtime subscription
  useEffect(() => {
    const ch = supabase
      .channel(`mission-${session.missionId}`)
      .on("postgres_changes",
          { event: "*", schema: "public", table: "operators",
            filter: `mission_id=eq.${session.missionId}` },
          () => refresh())
      .on("postgres_changes",
          { event: "*", schema: "public", table: "checklist_state" },
          () => refresh())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [session.missionId, refresh]);

  const total = CHECKLIST_STEPS.length;
  const now = Date.now();

  return (
    <div style={{ padding: "16px 24px 64px", maxWidth: 1100, margin: "0 auto" }}>
      <Section title="// SQUAD ROLL-UP">
        <table style={TABLE}>
          <thead>
            <tr>
              <th style={TH}>CALLSIGN</th>
              <th style={TH}>NAME</th>
              <th style={TH}>COMPLETE</th>
              <th style={TH}>%</th>
              <th style={TH}>STATUS</th>
              <th style={TH}>LAST SEEN</th>
            </tr>
          </thead>
          <tbody>
            {operators.map((op) => {
              const s = stateByOp[op.id] || {};
              const done = CHECKLIST_STEPS.filter((st) => s[st.key]).length;
              const pct = Math.round((done / total) * 100);
              const ageSec = (now - new Date(op.last_seen).getTime()) / 1000;
              const offline = ageSec > 60;
              const ready = done === total;
              const status = offline ? "OFFLINE" : ready ? "READY" : "PREP";
              const color = offline ? "#ff5555" : ready ? "#7fff7f" : DIM;
              return (
                <tr key={op.id}>
                  <td style={TD}>{op.callsign}</td>
                  <td style={TD}>{op.name || "--"}</td>
                  <td style={TD}>{done} / {total}</td>
                  <td style={TD}>{pct}%</td>
                  <td style={{ ...TD, color }}>{status}</td>
                  <td style={TD}>{fmtTime(op.last_seen)}</td>
                </tr>
              );
            })}
            {operators.length === 0 && (
              <tr><td style={TD} colSpan={6}>NO OPERATORS REGISTERED</td></tr>
            )}
          </tbody>
        </table>
      </Section>
      <div style={{ color: DIM, fontSize: 12 }}>
        AUTO-REFRESH VIA REALTIME :: MISSION CODE: {session.missionCode}
      </div>
    </div>
  );
}

// =====================================================================
// SHARED OFFLINE QUEUE FLUSH
// =====================================================================

async function flushQueue() {
  const q = loadQueue();
  if (q.length === 0) return;
  const remaining = [];
  for (const item of q) {
    try {
      if (item.kind === "checklist") {
        await supabase.from("checklist_state").upsert({
          operator_id: item.operator_id, step_key: item.step_key,
          checked: item.checked, checked_at: item.checked_at,
        });
      } else if (item.kind === "mission") {
        await supabase.from("missions").update(item.patch).eq("id", item.mission_id);
      } else if (item.kind === "equipment_update") {
        await supabase.from("equipment").update(item.patch).eq("id", item.id);
      }
    } catch {
      remaining.push(item);
    }
  }
  saveQueue(remaining);
}

// =====================================================================
// CHROME / SHARED UI
// =====================================================================

const GREEN = "#33ff33";
const DIM   = "#1a8c1a";
const BG    = "#000";

const FONT = `"Courier New", "Consolas", "Monaco", "Lucida Console", monospace`;

function ScanlineWrap({ children }) {
  return (
    <div style={{
      minHeight: "100vh", background: BG, color: GREEN, fontFamily: FONT,
      fontSize: 14, position: "relative", overflowX: "hidden",
    }}>
      <div style={{
        pointerEvents: "none", position: "fixed", inset: 0, zIndex: 9999,
        background: `repeating-linear-gradient(
          to bottom,
          rgba(0,0,0,0) 0px,
          rgba(0,0,0,0) 2px,
          rgba(0,0,0,0.18) 3px,
          rgba(0,0,0,0.18) 3px
        )`,
      }} />
      <div style={{
        pointerEvents: "none", position: "fixed", inset: 0, zIndex: 9998,
        boxShadow: "inset 0 0 120px rgba(0,0,0,0.9)",
      }} />
      {children}
    </div>
  );
}

function TopBar({ session, view, onView, onLogout }) {
  return (
    <div style={{
      borderBottom: `1px solid ${DIM}`, padding: "10px 24px",
      display: "flex", justifyContent: "space-between", alignItems: "center",
    }}>
      <div>
        <strong>// MISSION CHECKLIST TERMINAL</strong>
        <span style={{ color: DIM, marginLeft: 16 }}>
          MISSION {session.missionCode} :: OPERATOR {session.callsign}
        </span>
      </div>
      <div>
        <button style={view === "checklist" ? BTN_ACTIVE : BTN}
                onClick={() => onView("checklist")}>[ CHECKLIST ]</button>{" "}
        <button style={view === "rollup" ? BTN_ACTIVE : BTN}
                onClick={() => onView("rollup")}>[ ROLL-UP ]</button>{" "}
        <button style={BTN} onClick={onLogout}>[ LOGOUT ]</button>
      </div>
    </div>
  );
}

function Footer() {
  return (
    <div style={{
      borderTop: `1px solid ${DIM}`, color: DIM,
      padding: "8px 24px", fontSize: 12,
      position: "relative",
    }}>
      INTERNAL USE ONLY :: NO TRANSMISSION OUTSIDE OPERATIONAL NET <Cursor />
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 24, border: `1px solid ${DIM}`, padding: 16 }}>
      <div style={{ color: GREEN, marginBottom: 12 }}>{title}</div>
      {children}
    </div>
  );
}

function Field({ label, children, inline }) {
  return (
    <div style={{
      display: inline ? "inline-block" : "block",
      marginRight: inline ? 16 : 0, marginBottom: 12,
      minWidth: inline ? 220 : "auto",
    }}>
      <div style={{ color: DIM, fontSize: 12, marginBottom: 4 }}>{label}</div>
      {children}
    </div>
  );
}

function Cursor() {
  const [on, setOn] = useState(true);
  useEffect(() => {
    const t = setInterval(() => setOn((v) => !v), 500);
    return () => clearInterval(t);
  }, []);
  return <span style={{ color: GREEN }}>{on ? "█" : " "}</span>;
}

// ---------- STYLES ---------------------------------------------------

const H1 = { color: GREEN, marginBottom: 4, fontWeight: "bold", fontSize: 18 };

const INPUT = {
  background: "#000", color: GREEN, border: `1px solid ${DIM}`,
  padding: "6px 8px", fontFamily: FONT, fontSize: 14, width: 260, outline: "none",
};

const BTN = {
  background: "#000", color: GREEN, border: `1px solid ${DIM}`,
  padding: "6px 10px", fontFamily: FONT, cursor: "pointer", fontSize: 13,
};
const BTN_ACTIVE = { ...BTN, borderColor: GREEN, color: GREEN };
const BTN_PRIMARY = { ...BTN, borderColor: GREEN, padding: "8px 14px" };
const BTN_SMALL = { ...BTN, padding: "2px 6px", fontSize: 12 };

const TABLE = {
  width: "100%", borderCollapse: "collapse", marginBottom: 12,
};
const TH = {
  textAlign: "left", color: DIM, borderBottom: `1px solid ${DIM}`,
  padding: "6px 4px", fontWeight: "normal",
};
const TD = { padding: "4px", borderBottom: `1px dashed ${DIM}` };
