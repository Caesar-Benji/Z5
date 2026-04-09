import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth, roleLabel } from "../auth";
import { Panel, PageHeader, Badge, Btn } from "../ui";
import { useIsMobile } from "../useIsMobile";
import { C, FONT_MONO } from "../theme";
import { supabase } from "../supabase";
import {
  listMyUpcomingMissions, getMyChecklistState, getMission,
} from "../data/missions";
import { listRecentAnnouncements, subscribeAnnouncements } from "../data/announcements";
import {
  MISSION_STATUS_LABELS, MISSION_STATUS_TONES,
  OPERATOR_ROLE_LABELS, sectionsForRole,
  MISSION_KIND_ICONS,
} from "../missionTemplate";

export default function Home({ onOpenMission, onGoMissions, isBootcamp, squadId }) {
  const { profile } = useAuth();
  const greeting = greet();
  const isMobile = useIsMobile();

  const [missions, setMissions] = useState([]);
  const [missionProgress, setMissionProgress] = useState({});
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!profile?.id) return;
    setLoading(true);

    const { data: upcoming } = await listMyUpcomingMissions(profile.id, { limit: 5 });
    setMissions(upcoming || []);

    const progress = {};
    for (const m of upcoming || []) {
      if ((m.kind || "operational") === "admin") {
        progress[m.id] = { checked: m.my_done ? 1 : 0, total: 1 };
        continue;
      }
      const [{ items }, { data: st }] = await Promise.all([
        getMission(m.id).then((r) => ({ items: r.items || [] })),
        getMyChecklistState(m.id, profile.id),
      ]);
      const applicable = sectionsForRole(m.my_role);
      const mine = items.filter((it) => applicable.has(it.section));
      const stateMap = new Map((st || []).map((s) => [s.item_id, !!s.checked]));
      const checked = mine.reduce((n, it) => n + (stateMap.get(it.id) ? 1 : 0), 0);
      progress[m.id] = { checked, total: mine.length };
    }
    setMissionProgress(progress);

    const { data: ann } = await listRecentAnnouncements({ limit: 5 });
    const filteredAnn = isBootcamp && squadId
      ? (ann || []).filter((a) => a.scope === "squad" && a.squad_id === squadId)
      : (ann || []);
    setAnnouncements(filteredAnn);

    setLoading(false);
  }, [profile?.id, isBootcamp, squadId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const unsub = subscribeAnnouncements(() => {
      listRecentAnnouncements({ limit: 5 }).then(({ data }) => {
        const filtered = isBootcamp && squadId
          ? (data || []).filter((a) => a.scope === "squad" && a.squad_id === squadId)
          : (data || []);
        setAnnouncements(filtered);
      });
    });
    return () => { unsub && unsub(); };
  }, [isBootcamp, squadId]);

  const hasMissions      = missions.length > 0;
  const hasAnnouncements = announcements.length > 0;
  const isEmpty          = !loading && !hasMissions && !hasAnnouncements;

  return (
    <>
      <PageHeader
        title={`${greeting}, ${profile?.callsign || "Operator"}`}
        subtitle={`Role: ${roleLabel(profile?.role)}${profile?.squad_id ? "" : " · no squad assigned"}`}
      />

      {isEmpty && (
        <Panel>
          <div style={{ color: C.dim, fontSize: 14, lineHeight: 1.6, padding: "12px 0" }}>
            No missions or announcements at this time. Stand by.
          </div>
        </Panel>
      )}

      {hasMissions && (
        <Panel
          title="⌖  Upcoming missions"
          action={<Btn small onClick={onGoMissions}>View all</Btn>}
        >
          {missions.map((m) => {
            const p = missionProgress[m.id] || { checked: 0, total: 0 };
            const pct = p.total ? Math.round((p.checked / p.total) * 100) : 0;
            return (
              <MissionCardRow
                key={m.id}
                mission={m}
                pct={pct}
                checked={p.checked}
                total={p.total}
                onClick={() => onOpenMission && onOpenMission(m.id)}
              />
            );
          })}
        </Panel>
      )}

      {hasAnnouncements && (
        <Panel title="◈  Announcements">
          {announcements.map((a) => (
            <AnnouncementRow key={a.id} a={a} />
          ))}
        </Panel>
      )}

      {loading && !hasMissions && !hasAnnouncements && (
        <Panel>
          <div style={{ color: C.dim, fontSize: 13 }}>Loading…</div>
        </Panel>
      )}
    </>
  );
}

function MissionCardRow({ mission, pct, checked, total, onClick }) {
  const statusTone = MISSION_STATUS_TONES[mission.status] || "default";
  const statusLabel = MISSION_STATUS_LABELS[mission.status] || mission.status;
  const kind = mission.kind || "operational";
  const icon = MISSION_KIND_ICONS[kind] || "⌖";
  const whenTs = kind === "admin" ? mission.due_at : mission.scheduled_at;
  const whenPrefix = kind === "admin" ? "DUE " : "";
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        all: "unset",
        display: "block",
        width: "100%",
        boxSizing: "border-box",
        padding: "12px 0",
        borderBottom: `1px solid ${C.border}`,
        cursor: "pointer",
      }}
    >
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        gap: 10,
        marginBottom: 6,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
          <span aria-hidden style={{
            color: kind === "admin" ? C.warn : C.bright,
            fontSize: 16,
          }}>{icon}</span>
          <div style={{
            color: C.bright,
            fontSize: 14,
            fontWeight: 600,
            minWidth: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}>
            {mission.name}
          </div>
        </div>
        <Badge tone={statusTone}>{statusLabel}</Badge>
      </div>
      <div style={{
        color: C.dim,
        fontSize: 12,
        display: "flex",
        gap: 8,
        flexWrap: "wrap",
        marginBottom: 8,
      }}>
        <span style={{ fontFamily: FONT_MONO }}>{whenPrefix}{formatWhen(whenTs)}</span>
        {mission.location && (
          <>
            <span style={{ color: C.dimmer }}>·</span>
            <span>{mission.location}</span>
          </>
        )}
        {mission.my_role && (
          <>
            <span style={{ color: C.dimmer }}>·</span>
            <span>{OPERATOR_ROLE_LABELS[mission.my_role] || mission.my_role}</span>
          </>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{
          flex: 1,
          height: 6,
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
        <div style={{
          fontFamily: FONT_MONO,
          fontSize: 11,
          color: C.dim,
          minWidth: 60,
          textAlign: "right",
        }}>
          {checked}/{total} · {pct}%
        </div>
      </div>
    </button>
  );
}

function AnnouncementRow({ a }) {
  return (
    <div style={{
      padding: "10px 0",
      borderBottom: `1px solid ${C.border}`,
    }}>
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
        color: C.dimmer,
        fontSize: 11,
        fontFamily: FONT_MONO,
        marginTop: 4,
      }}>
        {formatWhen(a.posted_at)}
      </div>
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

function greet() {
  const h = new Date().getHours();
  if (h < 5)  return "Late watch";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}
