import { useCallback, useEffect, useState } from "react";
import { useAuth, canCreateInvites } from "../auth";
import { listMissions } from "../data/missions";
import { supabase } from "../supabase";
import { Panel, PageHeader, Btn, Badge, Mono } from "../ui";
import { useIsMobile } from "../useIsMobile";
import { C, FONT_MONO } from "../theme";
import {
  MISSION_STATUS_LABELS, MISSION_STATUS_TONES,
  MISSION_KINDS, MISSION_KIND_ICONS,
} from "../missionTemplate";
import AnnouncementComposer from "./AnnouncementComposer";

// Squad leader, officer and admin can author missions.
function canCreateMissions(role) {
  return canCreateInvites(role);
}

export default function Missions({ onOpenMission, onCreateMission }) {
  const { profile } = useAuth();
  const isMobile = useIsMobile();
  const [missions, setMissions] = useState([]);
  const [squads, setSquads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [kindFilter, setKindFilter] = useState("all"); // 'all' | 'operational' | 'admin'

  const load = useCallback(async () => {
    setLoading(true); setErr("");
    const [{ data, error }, { data: sq }] = await Promise.all([
      listMissions({ limit: 100 }),
      supabase.from("squads").select("*").order("name"),
    ]);
    if (error) setErr(String(error.message || error));
    setMissions(data);
    setSquads(sq || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const ch = supabase.channel("z5-missions-list")
      .on("postgres_changes",
          { event: "*", schema: "public", table: "missions" },
          () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  const squadName = (id) => squads.find((s) => s.id === id)?.name || "—";
  const showCreate = canCreateMissions(profile?.role);

  return (
    <>
      <PageHeader
        title="Missions"
        subtitle="Operations, tasks and announcements."
        action={showCreate && (
          <Btn primary onClick={onCreateMission} fullWidth={isMobile}>
            + New mission
          </Btn>
        )}
      />

      <AnnouncementComposer />

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
    </>
  );
}

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

function formatWhen(ts) {
  if (!ts) return "TBD";
  const d = new Date(ts);
  return d.toLocaleString([], {
    month: "short", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  }).toUpperCase();
}
