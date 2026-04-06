import { useState } from "react";
import { useAuth, roleLabel, canManageSquads } from "../auth";
import { ScanlineWrap, Btn, Footer } from "../ui";
import { C } from "../theme";
import Profile from "./Profile";
import Gear from "./Gear";
import Roster from "./Roster";

const NAV = [
  { key: "gear",    label: "[ GEAR ]" },
  { key: "roster",  label: "[ ROSTER ]" },
  { key: "profile", label: "[ PROFILE ]" },
];

export default function Shell() {
  const { profile, signOut } = useAuth();
  const [view, setView] = useState("gear");

  return (
    <ScanlineWrap>
      <TopBar profile={profile} view={view} onView={setView} onLogout={signOut} />
      <div style={{ padding: "20px 24px 32px", maxWidth: 1100, margin: "0 auto" }}>
        {view === "gear"    && <Gear />}
        {view === "roster"  && <Roster />}
        {view === "profile" && <Profile />}
      </div>
      <Footer />
    </ScanlineWrap>
  );
}

function TopBar({ profile, view, onView, onLogout }) {
  return (
    <div style={{
      borderBottom: `1px solid ${C.border}`, padding: "14px 24px",
      display: "flex", justifyContent: "space-between", alignItems: "center",
      flexWrap: "wrap", gap: 12,
    }}>
      <div>
        <div style={{ color: C.bright, fontSize: 18, letterSpacing: "2px" }}>// Z5 TERMINAL</div>
        <div style={{ color: C.dim, fontSize: 12, marginTop: 2 }}>
          {profile?.callsign || "—"} :: {roleLabel(profile?.role)}
          {profile?.squad_id ? "" : " :: NO SQUAD"}
        </div>
      </div>
      <div>
        {NAV.map((n) => (
          <span key={n.key}>
            <Btn active={view === n.key} onClick={() => onView(n.key)}>{n.label}</Btn>{" "}
          </span>
        ))}
        <Btn onClick={onLogout}>[ LOGOUT ]</Btn>
      </div>
    </div>
  );
}
