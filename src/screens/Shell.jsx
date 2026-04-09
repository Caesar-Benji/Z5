import { useState, useMemo } from "react";
import { useAuth, roleLabel, canManageSquads } from "../auth";
import { Page, AppShell, NavItem, NavLabel, TabItem, Badge } from "../ui";
import { useIsMobile } from "../useIsMobile";
import { C, FONT_MONO } from "../theme";
import Home from "./Home";
import Calendar from "./Calendar";
import Profile from "./Profile";
import Gear from "./Gear";
import Roster from "./Roster";
import Missions from "./Missions";
import MissionCreate from "./MissionCreate";
import Checklist from "./Checklist";

// Mobile bottom bar — 4 items, clean and minimal.
const MOBILE_TABS = [
  { key: "home",     label: "Home",     icon: "◉" },
  { key: "calendar", label: "Calendar", icon: "▤" },
  { key: "missions", label: "Missions", icon: "⌖" },
  { key: "profile",  label: "Profile",  icon: "◍" },
];

export default function Shell() {
  const { profile, signOut } = useAuth();
  const [view, setView] = useState("home");
  // Sub-view state within the Missions tab: "list" | "create" | "detail".
  const [missionView, setMissionView] = useState("list");
  const [activeMissionId, setActiveMissionId] = useState(null);
  const [prefillDate, setPrefillDate] = useState(null); // Date passed from Calendar → MissionCreate
  const isMobile = useIsMobile();

  const isAdminOrOfficer = canManageSquads(profile?.role);

  function goTab(key) {
    setView(key);
    if (key === "missions") {
      setMissionView("list");
      setActiveMissionId(null);
    }
  }

  // ------- Desktop sidebar -------
  const sidebar = (
    <>
      <div style={{
        padding: "0 14px 24px",
        borderBottom: `1px solid ${C.border}`,
        marginBottom: 12,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 10,
      }}>
        <img
          src={`${import.meta.env.BASE_URL}z5-logo.png`}
          alt="Z5"
          style={{
            width: "100%",
            maxWidth: 150,
            maxHeight: 90,
            objectFit: "contain",
            display: "block",
          }}
        />
        <div style={{
          color: C.bright,
          fontSize: 16,
          fontWeight: 700,
          letterSpacing: "2px",
        }}>
          Z5 TERMINAL
        </div>
      </div>

      <NavLabel>Navigation</NavLabel>
      <NavItem active={view === "home"} onClick={() => goTab("home")}>
        Home
      </NavItem>
      <NavItem active={view === "calendar"} onClick={() => goTab("calendar")}>
        Calendar
      </NavItem>
      <NavItem active={view === "missions"} onClick={() => goTab("missions")}>
        Missions
      </NavItem>

      {isAdminOrOfficer && (
        <>
          <NavLabel>Admin</NavLabel>
          <NavItem active={view === "roster"} onClick={() => goTab("roster")}>
            Roster
          </NavItem>
        </>
      )}

      <NavLabel>Account</NavLabel>
      <NavItem active={view === "profile"} onClick={() => goTab("profile")}>
        Profile
      </NavItem>
      <NavItem onClick={signOut}>Log out</NavItem>

      <div style={{ flex: 1 }} />

      <div style={{
        borderTop: `1px solid ${C.border}`,
        padding: "16px 14px 4px",
        marginTop: 16,
      }}>
        <div style={{
          fontFamily: FONT_MONO,
          fontSize: 13,
          color: C.bright,
          fontWeight: 600,
          letterSpacing: "0.5px",
          marginBottom: 4,
        }}>
          {profile?.callsign || "—"}
        </div>
        <div style={{ fontSize: 12, color: C.dim, marginBottom: 8 }}>
          {profile?.full_name || profile?.email}
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <Badge tone="bright">{roleLabel(profile?.role)}</Badge>
          {!profile?.squad_id && <Badge tone="warn">No Squad</Badge>}
        </div>
      </div>
    </>
  );

  // ------- Mobile top bar -------
  const mobileTopBar = (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: 14,
      minHeight: 52,
    }}>
      <img
        src={`${import.meta.env.BASE_URL}z5-logo.png`}
        alt="Z5"
        style={{
          height: 52,
          width: "auto",
          maxWidth: 92,
          objectFit: "contain",
          flexShrink: 0,
        }}
      />
      <div style={{
        display: "flex",
        flexDirection: "column",
        minWidth: 0,
        flex: 1,
      }}>
        <div style={{
          color: C.bright,
          fontSize: 18,
          fontWeight: 800,
          letterSpacing: "2px",
          lineHeight: 1.1,
        }}>
          Z5 TERMINAL
        </div>
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          marginTop: 3,
          fontSize: 12,
          color: C.dim,
          overflow: "hidden",
          whiteSpace: "nowrap",
          textOverflow: "ellipsis",
        }}>
          <span style={{
            fontFamily: FONT_MONO,
            color: C.bright,
            fontWeight: 600,
            letterSpacing: "0.5px",
          }}>
            {profile?.callsign || "—"}
          </span>
          <span style={{ color: C.dimmer }}>·</span>
          <span>{roleLabel(profile?.role)}</span>
        </div>
      </div>
      <button
        onClick={signOut}
        aria-label="Log out"
        style={{
          background: "transparent",
          border: `1px solid ${C.border}`,
          color: C.dim,
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: "0.8px",
          textTransform: "uppercase",
          borderRadius: 2,
          padding: "8px 12px",
          minHeight: 36,
          cursor: "pointer",
          flexShrink: 0,
        }}
      >
        Exit
      </button>
    </div>
  );

  // ------- Mobile bottom tab bar -------
  const mobileTabBar = (
    <>
      {MOBILE_TABS.map(t => (
        <TabItem
          key={t.key}
          active={view === t.key}
          onClick={() => goTab(t.key)}
          icon={t.icon}
          label={t.label}
        />
      ))}
    </>
  );

  // ------- Missions sub-router -------
  function renderMissions() {
    if (missionView === "create") {
      return (
        <MissionCreate
          prefillDate={prefillDate}
          onCreated={(id) => {
            setPrefillDate(null);
            if (id) {
              setActiveMissionId(id);
              setMissionView("detail");
            } else {
              setMissionView("list");
            }
          }}
          onCancel={() => { setPrefillDate(null); setMissionView("list"); }}
        />
      );
    }
    if (missionView === "detail" && activeMissionId) {
      return (
        <Checklist
          missionId={activeMissionId}
          onBack={() => { setMissionView("list"); setActiveMissionId(null); }}
        />
      );
    }
    return (
      <Missions
        onOpenMission={(id) => { setActiveMissionId(id); setMissionView("detail"); }}
        onCreateMission={() => setMissionView("create")}
      />
    );
  }

  function openMission(id) {
    setActiveMissionId(id);
    setMissionView("detail");
    setView("missions");
  }

  return (
    <Page>
      <AppShell
        sidebar={sidebar}
        mobileTopBar={isMobile ? mobileTopBar : null}
        mobileTabBar={isMobile ? mobileTabBar : null}
      >
        {view === "home" && (
          <Home
            onOpenMission={openMission}
            onGoMissions={() => { setMissionView("list"); setView("missions"); }}
          />
        )}
        {view === "calendar" && (
          <Calendar
            onOpenMission={openMission}
            onCreateForDate={(date) => {
              setPrefillDate(date);
              setMissionView("create");
              setView("missions");
            }}
          />
        )}
        {view === "missions" && renderMissions()}
        {view === "profile" && <Profile />}
        {view === "roster" && isAdminOrOfficer && <Roster />}
      </AppShell>
    </Page>
  );
}
