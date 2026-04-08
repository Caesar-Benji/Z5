import { useCallback, useEffect, useMemo, useState } from "react";
import { listMissionsInRange } from "../data/missions";
import { Panel, PageHeader, Btn, Badge, Mono } from "../ui";
import { useIsMobile } from "../useIsMobile";
import { C, FONT_MONO, S } from "../theme";
import {
  MISSION_STATUS_LABELS, MISSION_STATUS_TONES,
  MISSION_KIND_LABELS, MISSION_KIND_ICONS,
} from "../missionTemplate";
import { supabase } from "../supabase";

// Calendar tab: month grid, tap a day for the day view.
// Events are sourced from missions.scheduled_at (operational) and
// missions.due_at (admin). Later, training sessions will plug in here
// without a UI rewrite.

export default function Calendar({ onOpenMission }) {
  const isMobile = useIsMobile();
  const today = useMemo(() => startOfDay(new Date()), []);
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));
  const [selectedDay, setSelectedDay] = useState(null); // Date | null
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  const monthStart = useMemo(() => startOfMonth(cursor), [cursor]);
  const monthEnd   = useMemo(() => endOfMonth(cursor),   [cursor]);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await listMissionsInRange({
      fromISO: monthStart.toISOString(),
      toISO:   new Date(monthEnd.getTime() + 24 * 3600 * 1000).toISOString(),
    });
    // Normalize every mission into one or more calendar events.
    const evs = [];
    for (const m of data || []) {
      if (m.kind === "admin") {
        if (m.due_at) evs.push(buildEvent(m, m.due_at, "due"));
      } else {
        if (m.scheduled_at) evs.push(buildEvent(m, m.scheduled_at, "scheduled"));
      }
    }
    setEvents(evs);
    setLoading(false);
  }, [monthStart, monthEnd]);

  useEffect(() => { load(); }, [load]);

  // Subscribe to mission changes so the calendar stays fresh.
  useEffect(() => {
    const ch = supabase.channel("z5-calendar")
      .on("postgres_changes",
          { event: "*", schema: "public", table: "missions" },
          () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  const eventsByDay = useMemo(() => {
    const map = new Map();
    for (const e of events) {
      const key = dayKey(e.when);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(e);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.when.getTime() - b.when.getTime());
    }
    return map;
  }, [events]);

  function prevMonth() { setCursor(addMonths(cursor, -1)); setSelectedDay(null); }
  function nextMonth() { setCursor(addMonths(cursor,  1)); setSelectedDay(null); }
  function goToday()   { const t = startOfMonth(new Date()); setCursor(t); setSelectedDay(startOfDay(new Date())); }

  const monthLabel = cursor.toLocaleString([], { month: "long", year: "numeric" }).toUpperCase();

  // Fills whatever vertical space the AppShell main area gives us.
  // Desktop main padding is 32px top + 32px bottom; mobile is 18px + tab bar.
  const rootStyle = isMobile
    ? { display: "flex", flexDirection: "column", minHeight: 0 }
    : {
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        height: "calc(100vh - 64px)",
      };

  return (
    <div style={rootStyle}>
      <PageHeader
        title="Calendar"
        subtitle="Missions, admin tasks and upcoming activities."
        action={<Btn onClick={goToday} fullWidth={isMobile}>Today</Btn>}
      />

      <div style={{
        ...S.panel,
        flex: 1,
        minHeight: 0,
        marginBottom: selectedDay ? 16 : 0,
        display: "flex",
        flexDirection: "column",
        padding: isMobile ? "14px 12px" : "18px 22px",
      }}>
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          marginBottom: 10,
          flexShrink: 0,
        }}>
          <Btn small onClick={prevMonth}>‹ Prev</Btn>
          <div style={{
            fontFamily: FONT_MONO,
            color: C.bright,
            fontSize: 14,
            fontWeight: 700,
            letterSpacing: "1.5px",
          }}>
            {monthLabel}
          </div>
          <Btn small onClick={nextMonth}>Next ›</Btn>
        </div>

        <MonthGrid
          cursor={cursor}
          today={today}
          selectedDay={selectedDay}
          eventsByDay={eventsByDay}
          onSelect={(d) => setSelectedDay(d)}
        />

        {loading && (
          <div style={{ color: C.dim, fontSize: 11, marginTop: 6, flexShrink: 0 }}>Loading…</div>
        )}
      </div>

      {selectedDay && (
        <Panel title={dayHeader(selectedDay)}>
          {(() => {
            const list = eventsByDay.get(dayKey(selectedDay)) || [];
            if (list.length === 0) {
              return <div style={{ color: C.dim, fontSize: 13 }}>No activities scheduled.</div>;
            }
            return list.map((e) => (
              <DayEventRow
                key={e.key}
                event={e}
                onOpen={() => onOpenMission && onOpenMission(e.mission.id)}
              />
            ));
          })()}
        </Panel>
      )}
    </div>
  );
}

// ---------- Month grid ------------------------------------------------

function MonthGrid({ cursor, today, selectedDay, eventsByDay, onSelect }) {
  const isMobile = useIsMobile();
  const first = startOfMonth(cursor);
  // Grid starts on Sunday of the week containing the 1st.
  const gridStart = new Date(first);
  gridStart.setDate(first.getDate() - first.getDay());
  const cells = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    cells.push(d);
  }

  const dayNames = ["SUN","MON","TUE","WED","THU","FRI","SAT"];

  return (
    <div style={{
      flex: 1,
      minHeight: 0,
      display: "flex",
      flexDirection: "column",
    }}>
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(7, 1fr)",
        gap: 2,
        marginBottom: 4,
        flexShrink: 0,
      }}>
        {dayNames.map((d) => (
          <div key={d} style={{
            color: C.dimmer,
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.8px",
            textAlign: "center",
            padding: "4px 0",
          }}>
            {d}
          </div>
        ))}
      </div>
      <div style={{
        flex: 1,
        minHeight: 0,
        display: "grid",
        gridTemplateColumns: "repeat(7, 1fr)",
        gridTemplateRows: "repeat(6, minmax(0, 1fr))",
        gap: 2,
      }}>
        {cells.map((d) => {
          const inMonth = d.getMonth() === first.getMonth();
          const isToday = sameDay(d, today);
          const isSelected = selectedDay && sameDay(d, selectedDay);
          const dayEvents = eventsByDay.get(dayKey(d)) || [];
          return (
            <DayCell
              key={d.toISOString()}
              date={d}
              inMonth={inMonth}
              isToday={isToday}
              isSelected={isSelected}
              events={dayEvents}
              onClick={() => onSelect(startOfDay(d))}
              isMobile={isMobile}
            />
          );
        })}
      </div>
    </div>
  );
}

function DayCell({ date, inMonth, isToday, isSelected, events, onClick, isMobile }) {
  const hasEvents = events.length > 0;
  const bg = isSelected
    ? "rgba(255,255,255,0.12)"
    : isToday
      ? "rgba(255,255,255,0.06)"
      : "transparent";
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        all: "unset",
        cursor: "pointer",
        padding: isMobile ? 4 : 6,
        background: bg,
        border: `1px solid ${isSelected ? C.bright : isToday ? C.borderBright : C.border}`,
        borderRadius: 3,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        minHeight: 0,
        minWidth: 0,
        overflow: "hidden",
        opacity: inMonth ? 1 : 0.35,
      }}
    >
      <div style={{
        color: isToday ? C.bright : C.text,
        fontSize: isMobile ? 12 : 13,
        fontWeight: isToday ? 700 : 500,
        lineHeight: 1,
        textAlign: "right",
      }}>
        {date.getDate()}
      </div>
      {hasEvents && (
        <div style={{
          display: "flex",
          gap: 2,
          justifyContent: "center",
          flexWrap: "wrap",
        }}>
          {events.slice(0, 3).map((e, i) => (
            <span
              key={i}
              aria-hidden
              style={{
                width: 5,
                height: 5,
                borderRadius: "50%",
                background: e.kind === "admin" ? C.warn : C.ok,
              }}
            />
          ))}
          {events.length > 3 && (
            <span style={{
              color: C.dim,
              fontSize: 9,
              lineHeight: 1,
            }}>
              +{events.length - 3}
            </span>
          )}
        </div>
      )}
    </button>
  );
}

// ---------- Day view row ----------------------------------------------

function DayEventRow({ event, onOpen }) {
  const m = event.mission;
  const icon = MISSION_KIND_ICONS[m.kind || "operational"] || "✦";
  const statusTone  = MISSION_STATUS_TONES[m.status]  || "default";
  const statusLabel = MISSION_STATUS_LABELS[m.status] || m.status;
  const kindLabel   = MISSION_KIND_LABELS[m.kind || "operational"];
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
      <div style={{
        fontFamily: FONT_MONO,
        color: C.bright,
        fontSize: 13,
        fontWeight: 600,
        width: 58,
        flexShrink: 0,
        textAlign: "center",
      }}>
        {formatTime(event.when)}
      </div>
      <span aria-hidden style={{
        color: (m.kind || "operational") === "admin" ? C.warn : C.ok,
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
        gap: 2,
      }}>
        <div style={{
          color: C.bright,
          fontWeight: 600,
          fontSize: 14,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}>
          {m.name}
        </div>
        <div style={{
          color: C.dim,
          fontSize: 11,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}>
          <Mono style={{ color: C.dim }}>{kindLabel.toUpperCase()}</Mono>
          {m.location && <> · {m.location}</>}
        </div>
      </div>
      <Badge tone={statusTone}>{statusLabel}</Badge>
    </button>
  );
}

// ---------- Date helpers ----------------------------------------------

function buildEvent(mission, ts, role) {
  const when = new Date(ts);
  return {
    key:     `${mission.id}:${role}`,
    mission, when, kind: mission.kind || "operational",
  };
}
function startOfDay(d) { const x = new Date(d); x.setHours(0,0,0,0); return x; }
function startOfMonth(d) { const x = new Date(d); x.setDate(1); x.setHours(0,0,0,0); return x; }
function endOfMonth(d) {
  const x = startOfMonth(d);
  x.setMonth(x.getMonth() + 1);
  x.setDate(0);
  x.setHours(23,59,59,999);
  return x;
}
function addMonths(d, n) { const x = new Date(d); x.setMonth(x.getMonth() + n); return x; }
function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear()
      && a.getMonth()    === b.getMonth()
      && a.getDate()     === b.getDate();
}
function dayKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function formatTime(d) {
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
function dayHeader(d) {
  return d.toLocaleDateString([], {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  }).toUpperCase();
}
