import { useState, useEffect, useMemo } from "react";
import { useAuth, roleLabelT, canManageSquads } from "../auth";
import { useI18n } from "../i18n";
import { supabase } from "../supabase";
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
import Knowledge from "./Knowledge";

export default function Shell() {
  const { profile, signOut } = useAuth();
  const { t, lang, setLang, isRTL } = useI18n();
  const [view, setView] = useState("home");
  const [missionView, setMissionView] = useState("list");
  const [activeMissionId, setActiveMissionId] = useState(null);
  const [prefillDate, setPrefillDate] = useState(null);
  const [mySquad, setMySquad] = useState(null);
  const isMobile = useIsMobile();

  const isAdminOrOfficer = canManageSquads(profile?.role);
  const isBootcamp = mySquad?.is_bootcamp === true;

  useEffect(() => {
    if (!profile?.squad_id) { setMySquad(null); return; }
    supabase.from("squads").select("*").eq("id", profile.squad_id).maybeSingle()
      .then(({ data }) => setMySquad(data));
  }, [profile?.squad_id]);

  const mobileTabs = useMemo(() => [
    { key: "home",      label: t("nav.home"),      icon: "◉" },
    { key: "calendar",  label: t("nav.calendar"),  icon: "▤" },
    { key: "missions",  label: t("nav.missions"),  icon: "⌖" },
    { key: "knowledge", label: t("nav.knowledge"), icon: "📖" },
    { key: "profile",   label: t("nav.profile"),   icon: "◍" },
  ], [t]);

  function goTab(key) {
    setView(key);
    if (key === "missions") {
      setMissionView("list");
      setActiveMissionId(null);
    }
  }

  const langToggle = (
    <div style={{ display: "flex", gap: 4 }}>
      <button
        onClick={() => setLang("he")}
        style={{
          all: "unset",
          cursor: "pointer",
          padding: "4px 8px",
          fontSize: 12,
          fontWeight: lang === "he" ? 700 : 400,
          color: lang === "he" ? C.bright : C.dim,
          borderBottom: lang === "he" ? `2px solid ${C.bright}` : "2px solid transparent",
        }}
      >עב</button>
      <button
        onClick={() => setLang("en")}
        style={{
          all: "unset",
          cursor: "pointer",
          padding: "4px 8px",
          fontSize: 12,
          fontWeight: lang === "en" ? 700 : 400,
          color: lang === "en" ? C.bright : C.dim,
          borderBottom: lang === "en" ? `2px solid ${C.bright}` : "2px solid transparent",
        }}
      >EN</button>
    </div>
  );

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
          style={{ width: "100%", maxWidth: 150, maxHeight: 90, objectFit: "contain", display: "block" }}
        />
        <div style={{ color: C.bright, fontSize: 16, fontWeight: 700, letterSpacing: "2px" }}>
          {t("nav.terminal")}
        </div>
        {langToggle}
      </div>

      <NavLabel>{t("nav.navigation")}</NavLabel>
      <NavItem active={view === "home"} onClick={() => goTab("home")}>{t("nav.home")}</NavItem>
      <NavItem active={view === "calendar"} onClick={() => goTab("calendar")}>{t("nav.calendar")}</NavItem>
      <NavItem active={view === "missions"} onClick={() => goTab("missions")}>{t("nav.missions")}</NavItem>
      <NavItem active={view === "knowledge"} onClick={() => goTab("knowledge")}>{t("nav.knowledge")}</NavItem>

      {isAdminOrOfficer && (
        <>
          <NavLabel>{t("nav.admin")}</NavLabel>
          <NavItem active={view === "roster"} onClick={() => goTab("roster")}>{t("nav.roster")}</NavItem>
        </>
      )}

      <NavLabel>{t("nav.account")}</NavLabel>
      <NavItem active={view === "profile"} onClick={() => goTab("profile")}>{t("nav.profile")}</NavItem>
      <NavItem onClick={signOut}>{t("nav.logout")}</NavItem>

      <div style={{ flex: 1 }} />

      <div style={{ borderTop: `1px solid ${C.border}`, padding: "16px 14px 4px", marginTop: 16 }}>
        <div style={{ fontFamily: FONT_MONO, fontSize: 13, color: C.bright, fontWeight: 600, letterSpacing: "0.5px", marginBottom: 4 }}>
          {profile?.callsign || "—"}
        </div>
        <div style={{ fontSize: 12, color: C.dim, marginBottom: 8 }}>
          {profile?.full_name || profile?.email}
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <Badge tone="bright">{roleLabelT(profile?.role, t)}</Badge>
          {isBootcamp && <Badge tone="warn">{t("nav.bootcamp")}</Badge>}
          {!profile?.squad_id && <Badge tone="warn">{t("nav.nosquad")}</Badge>}
        </div>
      </div>
    </>
  );

  // ------- Mobile top bar -------
  const mobileTopBar = (
    <div style={{ display: "flex", alignItems: "center", gap: 14, minHeight: 52 }}>
      <img
        src={`${import.meta.env.BASE_URL}z5-logo.png`}
        alt="Z5"
        style={{ height: 52, width: "auto", maxWidth: 92, objectFit: "contain", flexShrink: 0 }}
      />
      <div style={{ display: "flex", flexDirection: "column", minWidth: 0, flex: 1 }}>
        <div style={{ color: C.bright, fontSize: 18, fontWeight: 800, letterSpacing: "2px", lineHeight: 1.1 }}>
          {t("nav.terminal")}
        </div>
        <div style={{
          display: "flex", alignItems: "center", gap: 6, marginTop: 3,
          fontSize: 12, color: C.dim, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis",
        }}>
          <span style={{ fontFamily: FONT_MONO, color: C.bright, fontWeight: 600, letterSpacing: "0.5px" }}>
            {profile?.callsign || "—"}
          </span>
          <span style={{ color: C.dimmer }}>·</span>
          <span>{roleLabelT(profile?.role, t)}</span>
          {isBootcamp && (
            <>
              <span style={{ color: C.dimmer }}>·</span>
              <span style={{ color: C.warn }}>{t("nav.bootcamp")}</span>
            </>
          )}
        </div>
      </div>
      {langToggle}
      <button
        onClick={signOut}
        aria-label={t("nav.logout")}
        style={{
          background: "transparent", border: `1px solid ${C.border}`, color: C.dim,
          fontSize: 11, fontWeight: 600, letterSpacing: "0.8px", textTransform: "uppercase",
          borderRadius: 2, padding: "8px 12px", minHeight: 36, cursor: "pointer", flexShrink: 0,
        }}
      >
        {t("nav.exit")}
      </button>
    </div>
  );

  // ------- Mobile bottom tab bar -------
  const mobileTabBar = (
    <>
      {mobileTabs.map(t => (
        <TabItem key={t.key} active={view === t.key} onClick={() => goTab(t.key)} icon={t.icon} label={t.label} />
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
            if (id) { setActiveMissionId(id); setMissionView("detail"); }
            else { setMissionView("list"); }
          }}
          onCancel={() => { setPrefillDate(null); setMissionView("list"); }}
        />
      );
    }
    if (missionView === "detail" && activeMissionId) {
      return <Checklist missionId={activeMissionId} onBack={() => { setMissionView("list"); setActiveMissionId(null); }} />;
    }
    return (
      <Missions
        isBootcamp={isBootcamp}
        squadId={profile?.squad_id}
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
          <Home isBootcamp={isBootcamp} squadId={profile?.squad_id}
                onOpenMission={openMission}
                onGoMissions={() => { setMissionView("list"); setView("missions"); }} />
        )}
        {view === "calendar" && (
          <Calendar
            onOpenMission={openMission}
            onCreateForDate={(date) => { setPrefillDate(date); setMissionView("create"); setView("missions"); }}
          />
        )}
        {view === "missions" && renderMissions()}
        {view === "knowledge" && <Knowledge isBootcamp={isBootcamp} />}
        {view === "profile" && <Profile />}
        {view === "roster" && isAdminOrOfficer && <Roster />}
      </AppShell>
    </Page>
  );
}
