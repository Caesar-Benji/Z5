import { useState } from "react";
import { useAuth, roleLabel } from "../auth";
import { Page, AppShell, NavItem, NavLabel, Footer, Badge } from "../ui";
import { C, FONT_MONO } from "../theme";
import Home from "./Home";
import Profile from "./Profile";
import Gear from "./Gear";
import Roster from "./Roster";

const NAV_MAIN = [
  { key: "home",   label: "Home" },
  { key: "gear",   label: "Gear" },
  { key: "roster", label: "Roster" },
];

const NAV_ACCOUNT = [
  { key: "profile", label: "Profile" },
];

export default function Shell() {
  const { profile, signOut } = useAuth();
  const [view, setView] = useState("home");

  const sidebar = (
    <>
      <div style={{
        color: C.bright,
        fontSize: 18,
        fontWeight: 700,
        letterSpacing: "1.5px",
        padding: "0 14px 24px",
        borderBottom: `1px solid ${C.border}`,
        marginBottom: 12,
      }}>
        Z5 TERMINAL
      </div>

      <NavLabel>Navigation</NavLabel>
      {NAV_MAIN.map(n => (
        <NavItem key={n.key} active={view === n.key} onClick={() => setView(n.key)}>
          {n.label}
        </NavItem>
      ))}

      <NavLabel>Account</NavLabel>
      {NAV_ACCOUNT.map(n => (
        <NavItem key={n.key} active={view === n.key} onClick={() => setView(n.key)}>
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

  return (
    <Page>
      <AppShell sidebar={sidebar}>
        {view === "home"    && <Home />}
        {view === "gear"    && <Gear />}
        {view === "roster"  && <Roster />}
        {view === "profile" && <Profile />}
      </AppShell>
    </Page>
  );
}
