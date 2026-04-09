import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth, roleLabel, canCreateInvites } from "../auth";
import {
  getMission, getMyChecklistState, toggleChecklistItem,
  getMissionReadiness, subscribeMissionRealtime, updateMissionStatus,
  setAdminTaskDone, deleteMission,
} from "../data/missions";
import {
  Panel, PageHeader, Btn, Badge, Mono, ErrLine, OkLine,
} from "../ui";
import { useIsMobile } from "../useIsMobile";
import { C, FONT_MONO } from "../theme";
import {
  SECTIONS, SECTION_LABELS, COMMON_SECTIONS, sectionsForRole,
  OPERATOR_ROLE_LABELS, MISSION_STATUS_LABELS, MISSION_STATUS_TONES,
} from "../missionTemplate";

export default function Checklist({ missionId, onBack }) {
  const { profile } = useAuth();
  const isMobile = useIsMobile();
  const canSeeRollup = canCreateInvites(profile?.role);

  const [mission, setMission] = useState(null);
  const [items, setItems] = useState([]);
  const [operators, setOperators] = useState([]);
  const [myState, setMyState] = useState([]);
  const [readiness, setReadiness] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [busyStatus, setBusyStatus] = useState(false);

  const myOp = useMemo(
    () => operators.find((o) => o.user_id === profile?.id) || null,
    [operators, profile?.id],
  );
  const myRole = myOp?.role || null;

  const load = useCallback(async () => {
    if (!missionId || !profile?.id) return;
    setErr("");
    const resp = await getMission(missionId);
    if (resp.error) { setErr(String(resp.error.message || resp.error)); setLoading(false); return; }
    setMission(resp.mission);
    setItems(resp.items || []);
    setOperators(resp.operators || []);
    const { data: st } = await getMyChecklistState(missionId, profile.id);
    setMyState(st || []);
    if (canCreateInvites(profile?.role)) {
      const { data: rd } = await getMissionReadiness(missionId);
      setReadiness(rd || []);
    }
    setLoading(false);
  }, [missionId, profile?.id, profile?.role]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!missionId) return;
    const unsub = subscribeMissionRealtime(missionId, () => load());
    return () => { unsub && unsub(); };
  }, [missionId, load]);

  // Items that apply to this operator (based on their mission role).
  const myApplicableSections = useMemo(
    () => sectionsForRole(myRole),
    [myRole],
  );
  const myItems = useMemo(
    () => items.filter((it) => myApplicableSections.has(it.section)),
    [items, myApplicableSections],
  );

  const stateMap = useMemo(() => {
    const m = new Map();
    for (const s of myState) m.set(s.item_id, !!s.checked);
    return m;
  }, [myState]);

  const checkedCount = useMemo(
    () => myItems.reduce((n, it) => n + (stateMap.get(it.id) ? 1 : 0), 0),
    [myItems, stateMap],
  );
  const total = myItems.length;
  const pct = total ? Math.round((checkedCount / total) * 100) : 0;

  const finalReadyItems = myItems.filter((it) => it.section === "final_ready");
  const allFinalReadyChecked =
    finalReadyItems.length > 0 &&
    finalReadyItems.every((it) => stateMap.get(it.id));

  async function onToggle(itemId, next) {
    // optimistic
    setMyState((prev) => {
      const other = prev.filter((s) => s.item_id !== itemId);
      return [...other, { item_id: itemId, checked: next, checked_at: new Date().toISOString() }];
    });
    const { error } = await toggleChecklistItem({ missionId, itemId, checked: next });
    if (error) {
      setErr(String(error.message || error));
      // revert
      setMyState((prev) => {
        const other = prev.filter((s) => s.item_id !== itemId);
        return [...other, { item_id: itemId, checked: !next, checked_at: null }];
      });
    }
  }

  async function setStatus(next) {
    setBusyStatus(true);
    setErr(""); setOk("");
    const { error } = await updateMissionStatus(missionId, next);
    setBusyStatus(false);
    if (error) { setErr(String(error.message || error)); return; }
    setOk(`Mission set to ${next}.`);
    load();
  }

  // Delete permission: creator, admin, officer, squad_leader.
  function canDeleteMission(m) {
    if (!m || !profile) return false;
    if (m.created_by === profile.id) return true;
    return ["admin", "officer", "squad_leader"].includes(profile.role);
  }

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busyDelete, setBusyDelete] = useState(false);

  async function handleDelete() {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    setBusyDelete(true);
    setErr("");
    const { error } = await deleteMission(missionId);
    setBusyDelete(false);
    if (error) { setErr(String(error.message || error)); setConfirmDelete(false); return; }
    onBack();
  }

  if (loading) {
    return (
      <>
        <PageHeader title="Mission" action={<Btn onClick={onBack} fullWidth={isMobile}>Back</Btn>} />
        <Panel><div style={{ color: C.dim, fontSize: 13 }}>Loading mission…</div></Panel>
      </>
    );
  }

  if (!mission) {
    return (
      <>
        <PageHeader title="Mission" action={<Btn onClick={onBack} fullWidth={isMobile}>Back</Btn>} />
        <Panel>
          <ErrLine>{err || "Mission not found."}</ErrLine>
        </Panel>
      </>
    );
  }

  // Admin tasks use a totally separate lightweight view.
  if (mission.kind === "admin") {
    return (
      <AdminTaskView
        mission={mission}
        operators={operators}
        profile={profile}
        isMobile={isMobile}
        canSeeRollup={canSeeRollup}
        onBack={onBack}
        reload={load}
        canDelete={canDeleteMission(mission)}
        onDelete={handleDelete}
        confirmDelete={confirmDelete}
        setConfirmDelete={setConfirmDelete}
        busyDelete={busyDelete}
        deleteErr={err}
      />
    );
  }

  const statusLabel = MISSION_STATUS_LABELS[mission.status] || mission.status;
  const statusTone = MISSION_STATUS_TONES[mission.status] || "default";

  return (
    <>
      <PageHeader
        title={mission.name}
        subtitle={formatWhen(mission.scheduled_at) + (mission.location ? ` · ${mission.location}` : "")}
        action={<Btn onClick={onBack} fullWidth={isMobile}>Back</Btn>}
      />

      {/* Mission meta / role / progress */}
      <Panel>
        <div style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 10,
          alignItems: "center",
          marginBottom: 14,
        }}>
          <Badge tone={statusTone}>{statusLabel}</Badge>
          {myRole
            ? <Badge tone="bright">Your role: {OPERATOR_ROLE_LABELS[myRole] || myRole}</Badge>
            : <Badge tone="warn">Not assigned</Badge>}
        </div>

        <ProgressBar checked={checkedCount} total={total} />

        {allFinalReadyChecked && (
          <div style={{
            marginTop: 14,
            padding: "12px 14px",
            border: `1px solid ${C.ok}`,
            background: "rgba(85,255,153,0.1)",
            color: C.ok,
            borderRadius: 3,
            fontSize: 14,
            fontWeight: 700,
            letterSpacing: "1px",
            textTransform: "uppercase",
            textAlign: "center",
          }}>
            ✔ Ready to move
          </div>
        )}

        {canSeeRollup && (
          <div style={{
            marginTop: 14,
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
          }}>
            {mission.status !== "active" && (
              <Btn small disabled={busyStatus} onClick={() => setStatus("active")}>
                Mark active
              </Btn>
            )}
            {mission.status !== "complete" && (
              <Btn small disabled={busyStatus} onClick={() => setStatus("complete")}>
                Mark complete
              </Btn>
            )}
            {mission.status !== "cancelled" && (
              <Btn small disabled={busyStatus} onClick={() => setStatus("cancelled")}>
                Cancel
              </Btn>
            )}
          </div>
        )}

        {canDeleteMission(mission) && (
          <div style={{ marginTop: 14 }}>
            <Btn
              small
              disabled={busyDelete}
              onClick={handleDelete}
              style={{
                color: confirmDelete ? "#ff4444" : C.dim,
                borderColor: confirmDelete ? "#ff4444" : undefined,
              }}
            >
              {busyDelete ? "Deleting…" : confirmDelete ? "Confirm delete" : "Delete mission"}
            </Btn>
            {confirmDelete && !busyDelete && (
              <Btn small onClick={() => setConfirmDelete(false)} style={{ marginLeft: 8 }}>
                Cancel
              </Btn>
            )}
          </div>
        )}

        <ErrLine>{err}</ErrLine>
        <OkLine>{ok}</OkLine>
      </Panel>

      {/* Operator checklist */}
      {!myOp && !canSeeRollup && (
        <Panel>
          <div style={{ color: C.dim, fontSize: 13 }}>
            You are not assigned to this mission. Contact your squad leader.
          </div>
        </Panel>
      )}

      {myOp && SECTIONS.filter((sec) => myApplicableSections.has(sec.key)).map((sec) => {
        const sectionItems = myItems.filter((it) => it.section === sec.key);
        if (sectionItems.length === 0) return null;
        const done = sectionItems.filter((it) => stateMap.get(it.id)).length;
        return (
          <Panel
            key={sec.key}
            title={SECTION_LABELS[sec.key]}
            action={<Badge tone={done === sectionItems.length ? "ok" : "default"}>
              {done}/{sectionItems.length}
            </Badge>}
          >
            {sectionItems.map((it) => (
              <ChecklistRow
                key={it.id}
                label={it.label}
                checked={!!stateMap.get(it.id)}
                onToggle={(next) => onToggle(it.id, next)}
                isMobile={isMobile}
              />
            ))}
          </Panel>
        );
      })}

      {/* Squad leader / officer rollup */}
      {canSeeRollup && (
        <Panel title="Team readiness">
          {readiness.length === 0 && (
            <div style={{ color: C.dim, fontSize: 13 }}>No operators assigned.</div>
          )}
          {readiness.map((r) => (
            <ReadinessRow key={r.user_id} row={r} isMobile={isMobile} />
          ))}
        </Panel>
      )}
    </>
  );
}

function ProgressBar({ checked, total }) {
  const pct = total ? Math.round((checked / total) * 100) : 0;
  return (
    <div>
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        fontSize: 12,
        color: C.dim,
        marginBottom: 6,
        fontFamily: FONT_MONO,
        letterSpacing: "0.5px",
      }}>
        <span>{checked}/{total} COMPLETE</span>
        <span>{pct}%</span>
      </div>
      <div style={{
        width: "100%",
        height: 8,
        background: "rgba(255,255,255,0.06)",
        border: `1px solid ${C.border}`,
        borderRadius: 2,
        overflow: "hidden",
      }}>
        <div style={{
          width: `${pct}%`,
          height: "100%",
          background: pct === 100 ? C.ok : C.bright,
          transition: "width 200ms",
        }} />
      </div>
    </div>
  );
}

function ChecklistRow({ label, checked, onToggle, isMobile }) {
  return (
    <button
      type="button"
      onClick={() => onToggle(!checked)}
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
        border: `1px solid ${checked ? C.ok : C.borderBright}`,
        background: checked ? "rgba(85,255,153,0.15)" : "transparent",
        color: checked ? C.ok : "transparent",
        fontSize: 16,
        fontWeight: 700,
        borderRadius: 2,
      }}>
        ✓
      </span>
      <span style={{
        flex: 1,
        color: checked ? C.dim : C.text,
        textDecoration: checked ? "line-through" : "none",
        fontSize: isMobile ? 15 : 14,
      }}>
        {label}
      </span>
    </button>
  );
}

function ReadinessRow({ row, isMobile }) {
  const pct = Number(row.pct || 0);
  const ready = !!row.ready_to_move;
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
          {row.callsign || "—"}
        </div>
        <div style={{ color: C.dim, fontSize: 12 }}>
          {row.full_name || <span style={{ color: C.dimmer }}>—</span>}
          {row.op_role && (
            <>
              {" · "}
              <span>{OPERATOR_ROLE_LABELS[row.op_role] || row.op_role}</span>
            </>
          )}
        </div>
      </div>
      <div style={{
        minWidth: isMobile ? 90 : 140,
        fontFamily: FONT_MONO,
        fontSize: 12,
        color: C.dim,
        textAlign: "right",
      }}>
        {row.checked_items}/{row.total_items} · {pct}%
      </div>
      <Badge tone={ready ? "ok" : pct > 0 ? "warn" : "default"}>
        {ready ? "READY" : "NOT READY"}
      </Badge>
    </div>
  );
}

function formatWhen(ts) {
  if (!ts) return "TBD";
  const d = new Date(ts);
  return d.toLocaleString([], {
    month: "short", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  }).toUpperCase();
}

// ---------- Admin task view -------------------------------------------

function AdminTaskView({
  mission, operators, profile, isMobile, canSeeRollup, onBack, reload,
  canDelete, onDelete, confirmDelete, setConfirmDelete, busyDelete, deleteErr,
}) {
  const myOp = operators.find((o) => o.user_id === profile?.id) || null;
  const isAssignee = !!myOp;
  const iAmDone = !!myOp?.done;

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const doneCount  = operators.filter((o) => o.done).length;
  const totalCount = operators.length;

  async function toggleMine() {
    setBusy(true);
    setErr("");
    const { error } = await setAdminTaskDone({ missionId: mission.id, done: !iAmDone });
    setBusy(false);
    if (error) { setErr(String(error.message || error)); return; }
    reload && reload();
  }

  const statusLabel = MISSION_STATUS_LABELS[mission.status] || mission.status;
  const statusTone  = MISSION_STATUS_TONES[mission.status] || "default";

  return (
    <>
      <PageHeader
        title={mission.name}
        subtitle={`Admin task · due ${formatWhen(mission.due_at)}${mission.location ? ` · ${mission.location}` : ""}`}
        action={<Btn onClick={onBack} fullWidth={isMobile}>Back</Btn>}
      />

      <Panel>
        <div style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 10,
          alignItems: "center",
          marginBottom: 14,
        }}>
          <Badge tone={statusTone}>{statusLabel}</Badge>
          <Badge tone="bright">ADMIN TASK</Badge>
          <Badge tone={doneCount === totalCount ? "ok" : "default"}>
            {doneCount}/{totalCount} DONE
          </Badge>
        </div>

        {mission.notes && (
          <div style={{
            color: C.text,
            fontSize: 14,
            lineHeight: 1.5,
            whiteSpace: "pre-wrap",
            padding: "10px 12px",
            background: "rgba(255,255,255,0.03)",
            border: `1px solid ${C.border}`,
            borderRadius: 3,
            marginBottom: 14,
          }}>
            {mission.notes}
          </div>
        )}

        {isAssignee ? (
          <Btn
            primary={!iAmDone}
            disabled={busy}
            fullWidth={isMobile}
            onClick={toggleMine}
          >
            {iAmDone ? "Mark not done" : "Mark done"}
          </Btn>
        ) : (
          <div style={{ color: C.dim, fontSize: 13 }}>
            You are not assigned to this task.
          </div>
        )}

        {canDelete && (
          <div style={{ marginTop: 14 }}>
            <Btn
              small
              disabled={busyDelete}
              onClick={onDelete}
              style={{
                color: confirmDelete ? "#ff4444" : C.dim,
                borderColor: confirmDelete ? "#ff4444" : undefined,
              }}
            >
              {busyDelete ? "Deleting…" : confirmDelete ? "Confirm delete" : "Delete task"}
            </Btn>
            {confirmDelete && !busyDelete && (
              <Btn small onClick={() => setConfirmDelete(false)} style={{ marginLeft: 8 }}>
                Cancel
              </Btn>
            )}
          </div>
        )}

        <ErrLine>{err || deleteErr}</ErrLine>
      </Panel>

      {canSeeRollup && (
        <Panel title="Assignees">
          {operators.length === 0 && (
            <div style={{ color: C.dim, fontSize: 13 }}>No assignees.</div>
          )}
          {operators.map((o) => (
            <div key={o.user_id} style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
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
                }}>
                  {o.callsign || "—"}
                </div>
                <div style={{ color: C.dim, fontSize: 12 }}>
                  {o.full_name || "—"}
                  {o.profile_role && <> · {roleLabel(o.profile_role)}</>}
                </div>
              </div>
              <Badge tone={o.done ? "ok" : "default"}>
                {o.done ? "DONE" : "PENDING"}
              </Badge>
            </div>
          ))}
        </Panel>
      )}
    </>
  );
}
