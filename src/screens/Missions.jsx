import { useCallback, useEffect, useState } from "react";
import { useAuth, canCreateInvites, canManageSquads } from "../auth";
import { listMissions } from "../data/missions";
import {
  listRecentAnnouncements, subscribeAnnouncements,
  deleteAnnouncement, updateAnnouncement,
} from "../data/announcements";
import { supabase } from "../supabase";
import { Panel, PageHeader, Btn, Badge, Mono, Input, Textarea, ErrLine } from "../ui";
import { useIsMobile } from "../useIsMobile";
import { C, FONT_MONO } from "../theme";
import {
  MISSION_STATUS_LABELS, MISSION_STATUS_TONES,
  MISSION_KINDS, MISSION_KIND_ICONS,
} from "../missionTemplate";
import AnnouncementComposer from "./AnnouncementComposer";

function canCreateMissions(role) {
  return canCreateInvites(role);
}

export default function Missions({ onOpenMission, onCreateMission, isBootcamp, squadId }) {
  const { profile } = useAuth();
  const isMobile = useIsMobile();
  const [missions, setMissions] = useState([]);
  const [squads, setSquads] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [kindFilter, setKindFilter] = useState("all");

  const load = useCallback(async () => {
    setLoading(true); setErr("");
    // Boot camp squads only see their own squad's missions
    const missionOpts = isBootcamp && squadId
      ? { squadId, limit: 100 }
      : { limit: 100 };
    const [{ data, error }, { data: sq }, { data: ann }] = await Promise.all([
      listMissions(missionOpts),
      supabase.from("squads").select("*").order("name"),
      listRecentAnnouncements({ limit: 20 }),
    ]);
    if (error) setErr(String(error.message || error));
    setMissions(data);
    setSquads(sq || []);
    // Boot camp squads only see announcements scoped to their squad
    const filteredAnn = isBootcamp && squadId
      ? (ann || []).filter((a) => a.scope === "squad" && a.squad_id === squadId)
      : (ann || []);
    setAnnouncements(filteredAnn);
    setLoading(false);
  }, [isBootcamp, squadId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const ch = supabase.channel("z5-missions-list")
      .on("postgres_changes",
          { event: "*", schema: "public", table: "missions" },
          () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  useEffect(() => {
    const unsub = subscribeAnnouncements(() => {
      listRecentAnnouncements({ limit: 20 }).then(({ data }) => {
        const filtered = isBootcamp && squadId
          ? (data || []).filter((a) => a.scope === "squad" && a.squad_id === squadId)
          : (data || []);
        setAnnouncements(filtered);
      });
    });
    return unsub;
  }, [isBootcamp, squadId]);

  const squadName = (id) => squads.find((s) => s.id === id)?.name || "—";
  const showCreate = canCreateMissions(profile?.role);
  const canManage = canManageSquads(profile?.role);
  const isLead = profile?.role === "squad_leader";

  return (
    <>
      {/* ── MISSIONS SECTION ── */}
      <PageHeader
        title={<><span style={{ marginRight: 8 }}>⌖</span>Missions</>}
        subtitle="Operations and tasks."
        action={showCreate && (
          <Btn primary onClick={onCreateMission} fullWidth={isMobile}>
            + New mission
          </Btn>
        )}
      />

      <Panel>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
          <Btn small active={kindFilter === "all"} onClick={() => setKindFilter("all")}>
            All
          </Btn>
          {MISSION_KINDS.map((k) => (
            <Btn
              key={k.key}
              small
              active={kindFilter === k.key}
              onClick={() => setKindFilter(k.key)}
            >
              {k.icon} {k.label}
            </Btn>
          ))}
        </div>

        {loading && <div style={{ color: C.dim, fontSize: 13 }}>Loading…</div>}
        {err && <div style={{ color: C.error, fontSize: 13 }}>{err}</div>}
        {!loading && missions.length === 0 && (
          <div style={{ color: C.dim, fontSize: 13, padding: "4px 0" }}>
            No missions scheduled.
          </div>
        )}
        {missions
          .filter((m) => kindFilter === "all" || (m.kind || "operational") === kindFilter)
          .map((m) => (
            <MissionRow
              key={m.id}
              mission={m}
              squadName={squadName(m.squad_id)}
              onOpen={() => onOpenMission(m.id)}
            />
          ))}
      </Panel>

      {/* ── ANNOUNCEMENTS SECTION ── */}
      <div style={{ marginTop: 24 }}>
        <PageHeader
          title={<><span style={{ marginRight: 8 }}>◈</span>Announcements</>}
          subtitle="Broadcasts and notices."
        />

        {showCreate && <AnnouncementComposer />}

        <Panel>
          {announcements.length === 0 && !loading && (
            <div style={{ color: C.dim, fontSize: 13, padding: "4px 0" }}>
              No announcements.
            </div>
          )}
          {announcements.map((a) => (
            <AnnouncementRow
              key={a.id}
              a={a}
              canEdit={canManage || (isLead && a.scope === "squad" && a.squad_id === profile?.squad_id)}
              profileId={profile?.id}
              onDeleted={load}
              onUpdated={load}
            />
          ))}
        </Panel>
      </div>
    </>
  );
}

/* ── Mission row ── */
function MissionRow({ mission, squadName, onOpen }) {
  const tone = MISSION_STATUS_TONES[mission.status] || "default";
  const label = MISSION_STATUS_LABELS[mission.status] || mission.status;
  const kind = mission.kind || "operational";
  const icon = MISSION_KIND_ICONS[kind] || "⌖";
  const when = kind === "admin"
    ? `DUE ${formatWhen(mission.due_at)}`
    : formatWhen(mission.scheduled_at);
  const squadText = mission.squad_id ? squadName : "WHOLE TEAM";

  return (
    <button
      type="button"
      onClick={onOpen}
      style={{
        all: "unset",
        display: "flex",
        alignItems: "center",
        gap: 12,
        width: "100%",
        boxSizing: "border-box",
        padding: "12px 4px",
        borderBottom: `1px solid ${C.border}`,
        cursor: "pointer",
      }}
    >
      <span aria-hidden style={{
        color: kind === "admin" ? C.warn : C.bright,
        fontSize: 18,
        width: 20,
        textAlign: "center",
        flexShrink: 0,
      }}>{icon}</span>
      <div style={{
        flex: 1,
        minWidth: 0,
        display: "flex",
        flexDirection: "column",
        gap: 3,
      }}>
        <div style={{
          color: C.bright,
          fontWeight: 600,
          fontSize: 15,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}>
          {mission.name}
        </div>
        <div style={{
          color: C.dim,
          fontSize: 12,
          display: "flex",
          gap: 10,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}>
          <Mono style={{ color: C.text }}>{squadText}</Mono>
          <span style={{ color: C.dimmer }}>·</span>
          <span style={{ fontFamily: FONT_MONO }}>{when}</span>
          {mission.location && (
            <>
              <span style={{ color: C.dimmer }}>·</span>
              <span style={{
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}>{mission.location}</span>
            </>
          )}
        </div>
      </div>
      <Badge tone={tone}>{label}</Badge>
      <span style={{ color: C.dimmer, fontSize: 14 }}>›</span>
    </button>
  );
}

/* ── Announcement row with edit / delete ── */
function AnnouncementRow({ a, canEdit, profileId, onDeleted, onUpdated }) {
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(a.title || "");
  const [editBody, setEditBody] = useState(a.body || "");
  const [busy, setBusy] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [err, setErr] = useState("");

  // Allow edit/delete if canEdit (admin/officer/squad_leader for own squad) or if user is the author
  const canModify = canEdit || a.posted_by === profileId;

  async function handleSave() {
    setBusy(true); setErr("");
    const { error } = await updateAnnouncement(a.id, {
      title: editTitle.trim(),
      body: editBody.trim(),
    });
    setBusy(false);
    if (error) { setErr(String(error.message || error)); return; }
    setEditing(false);
    onUpdated?.();
  }

  async function handleDelete() {
    if (!confirmDel) { setConfirmDel(true); return; }
    setBusy(true); setErr("");
    const { error } = await deleteAnnouncement(a.id);
    setBusy(false);
    if (error) { setErr(String(error.message || error)); return; }
    onDeleted?.();
  }

  if (editing) {
    return (
      <div style={{ padding: "10px 0", borderBottom: `1px solid ${C.border}` }}>
        <div style={{ marginBottom: 8 }}>
          <div style={{ color: C.dim, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 4 }}>Title</div>
          <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} placeholder="Headline (optional)" maxLength={80} />
        </div>
        <div style={{ marginBottom: 8 }}>
          <div style={{ color: C.dim, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 4 }}>Body</div>
          <Textarea value={editBody} onChange={(e) => setEditBody(e.target.value)} rows={4} />
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Btn small primary disabled={busy || !editBody.trim()} onClick={handleSave}>
            {busy ? "Saving…" : "Save"}
          </Btn>
          <Btn small onClick={() => { setEditing(false); setEditTitle(a.title || ""); setEditBody(a.body || ""); }}>
            Cancel
          </Btn>
        </div>
        <ErrLine>{err}</ErrLine>
      </div>
    );
  }

  return (
    <div style={{ padding: "10px 0", borderBottom: `1px solid ${C.border}` }}>
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 8,
        marginBottom: 4,
      }}>
        <div style={{ color: C.bright, fontSize: 13, fontWeight: 600 }}>
          {a.title || "ANNOUNCEMENT"}
        </div>
        <Badge tone={a.scope === "global" ? "bright" : "default"}>
          {(a.scope || "global").toUpperCase()}
        </Badge>
      </div>
      <div style={{
        color: C.text,
        fontSize: 13,
        lineHeight: 1.5,
        whiteSpace: "pre-wrap",
      }}>
        {a.body}
      </div>
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginTop: 6,
      }}>
        <div style={{
          color: C.dimmer,
          fontSize: 11,
          fontFamily: FONT_MONO,
        }}>
          {formatWhen(a.posted_at)}
        </div>
        {canModify && (
          <div style={{ display: "flex", gap: 6 }}>
            <Btn small onClick={() => setEditing(true)}>Edit</Btn>
            <Btn
              small
              onClick={handleDelete}
              style={confirmDel ? { color: C.error, borderColor: C.error } : {}}
              disabled={busy}
            >
              {busy ? "…" : confirmDel ? "Confirm delete" : "Delete"}
            </Btn>
            {confirmDel && !busy && (
              <Btn small onClick={() => setConfirmDel(false)}>Cancel</Btn>
            )}
          </div>
        )}
      </div>
      <ErrLine>{err}</ErrLine>
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
