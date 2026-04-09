import { useState } from "react";
import { useAuth, roleLabel, canManageSquads } from "../auth";
import { supabase } from "../supabase";
import { Panel, PageHeader, Field, Btn, Input, ErrLine, OkLine } from "../ui";
import { useIsMobile } from "../useIsMobile";
import { C } from "../theme";
import Gear from "./Gear";

export default function Profile() {
  const { profile, refreshProfile, signOut } = useAuth();
  const isMobile = useIsMobile();
  const [callsign, setCallsign] = useState(profile?.callsign || "");
  const [name, setName] = useState(profile?.full_name || "");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  async function saveProfile(e) {
    e.preventDefault();
    setBusy(true); setErr(""); setOk("");
    try {
      const { error } = await supabase.rpc("update_my_profile", {
        p_callsign: callsign.trim().toUpperCase(),
        p_full_name: name,
      });
      if (error) throw error;
      await refreshProfile();
      setOk("Profile updated.");
    } catch (e) {
      setErr(String(e.message || e));
    } finally { setBusy(false); }
  }

  async function changePassword(e) {
    e.preventDefault();
    setBusy(true); setErr(""); setOk("");
    try {
      if (pw.length < 6) throw new Error("Password too short (min 6)");
      if (pw !== pw2) throw new Error("Passwords do not match");
      const { error } = await supabase.auth.updateUser({ password: pw });
      if (error) throw error;
      setPw(""); setPw2("");
      setOk("Password updated.");
    } catch (e) {
      setErr(String(e.message || e));
    } finally { setBusy(false); }
  }

  return (
    <>
      <PageHeader
        title="Profile"
        subtitle="Gear, identity and settings."
      />

      {/* Personal gear inventory — top priority */}
      <Gear />

      <div style={{
        display: "grid",
        gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fit, minmax(360px, 1fr))",
        gap: isMobile ? 14 : 20,
      }}>
        <Panel title={<><SoldierIcon /> Identity</>}>
          <form onSubmit={saveProfile}>
            <Field label="Email">
              <Input value={profile?.email || ""} readOnly />
            </Field>
            <Field label="Role">
              <Input value={roleLabel(profile?.role)} readOnly />
            </Field>
            <Field label="Callsign">
              <Input mono value={callsign} onChange={(e) => setCallsign(e.target.value)} />
            </Field>
            <Field label="Full name">
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Btn primary type="submit" disabled={busy} fullWidth={isMobile}>
              {busy ? "Saving…" : "Save profile"}
            </Btn>
            <ErrLine>{err}</ErrLine>
            <OkLine>{ok}</OkLine>
          </form>
        </Panel>

        <Panel title={<><LockIcon /> Password</>}>
          <form onSubmit={changePassword}>
            <Field label="New password">
              <Input type="password" value={pw} onChange={(e) => setPw(e.target.value)} />
            </Field>
            <Field label="Confirm new password">
              <Input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
            </Field>
            <Btn primary type="submit" disabled={busy} fullWidth={isMobile}>Change password</Btn>
          </form>
          <div style={{ color: C.dim, fontSize: 12, marginTop: 14 }}>
            Password changes take effect immediately on the next request.
          </div>
        </Panel>
      </div>

      {/* Mobile sign out */}
      {isMobile && (
        <div style={{ marginTop: 24 }}>
          <Btn fullWidth onClick={signOut}>Log out</Btn>
        </div>
      )}
    </>
  );
}

// ---------- Inline SVG icons for section titles ----------------------

function SoldierIcon() {
  return (
    <svg
      width="16" height="16" viewBox="0 0 16 16" fill="none"
      style={{ verticalAlign: "middle", marginRight: 8, opacity: 0.8 }}
    >
      {/* Head */}
      <circle cx="8" cy="4" r="2.5" stroke="currentColor" strokeWidth="1.2" />
      {/* Helmet brim */}
      <path d="M5 3.5 Q8 1.5 11 3.5" stroke="currentColor" strokeWidth="1" fill="none" />
      {/* Body / torso */}
      <path d="M4 15 L4 10 Q4 8 8 8 Q12 8 12 10 L12 15" stroke="currentColor" strokeWidth="1.2" fill="none" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg
      width="16" height="16" viewBox="0 0 16 16" fill="none"
      style={{ verticalAlign: "middle", marginRight: 8, opacity: 0.8 }}
    >
      {/* Lock body */}
      <rect x="3" y="7" width="10" height="7" rx="1" stroke="currentColor" strokeWidth="1.2" />
      {/* Shackle */}
      <path d="M5.5 7 V5 Q5.5 2 8 2 Q10.5 2 10.5 5 V7" stroke="currentColor" strokeWidth="1.2" fill="none" />
      {/* Keyhole */}
      <circle cx="8" cy="11" r="1" fill="currentColor" />
    </svg>
  );
}
