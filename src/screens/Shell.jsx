import { useState } from "react";
import { useAuth, roleLabel } from "../auth";
import { Page, AppShell, NavItem, NavLabel, TabItem, Badge } from "../ui";
import { useIsMobile } from "../useIsMobile";
import { C, FONT_MONO } from "../theme";
import Home from "./Home";
import Profile from "./Profile";
import Gear from "./Gear";
import Roster from "./Roster";
import Missions from "./Missions";
import MissionCreate from "./MissionCreate";
import Checklist from "./Checklist";

const NAV_MAIN = [
  { key: "home",     label: "Home",     icon: "◉" },
  { key: "missions", label: "Missions", icon: "✦" },
  { key: "gear",     label: "Gear",     icon: "▣" },
  { key: "roster",   label: "Roster",   icon: "▦" },
];

const NAV_ACCOUNT = [
  { key: "profile", label: "Profile", icon: "◍" },
];

// Flat list used by the mobile bottom tab bar (max 5 items recommended).
const MOBILE_TABS = [...NAV_MAIN, ...NAV_ACCOUNT];

export default function Shell() {
  const { profile, signOut } = useAuth();
  const [view, setView] = useState("home");
  // Sub-view state within the Missions tab: "list" | "create" | "detail".
  const [missionView, setMissionView] = useState("list");
  const [activeMissionId, setActiveMissionId] = useState(null);
  const isMobile = useIsMobile();

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
      {NAV_MAIN.map(n => (
        <NavItem key={n.key} active={view === n.key} onClick={() => goTab(n.key)}>
          {n.label}
        </NavItem>
      ))}

      <NavLabel>Account</NavLabel>
      {NAV_ACCOUNT.map(n => (
        <NavItem key={n.key} active={view === n.key} onClick={() => goTab(n.key)}>
          {n.label}
        </NavItem>
      ))}
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
          onCreated={(id) => {
            if (id) {
              setActiveMissionId(id);
              setMissionView("detail");
            } else {
              setMissionView("list");
            }
          }}
          onCancel={() => setMissionView("list")}
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

  return (
    <Page>
      <AppShell
        sidebar={sidebar}
        mobileTopBar={isMobile ? mobileTopBar : null}
        mobileTabBar={isMobile ? mobileTabBar : null}
      >
        {view === "home"     && (
          <Home
            onOpenMission={(id) => {
              setActiveMissionId(id);
              setMissionView("detail");
              setView("missions");
            }}
            onGoMissions={() => { setMissionView("list"); setView("missions"); }}
          />
        )}
        {view === "missions" && renderMissions()}
        {view === "gear"     && <Gear />}
        {view === "roster"   && <Roster />}
        {view === "profile"  && <Profile />}
      </AppShell>
    </Page>
  );
}
