import { useState } from "react";
import { useAuth, roleLabel } from "../auth";
import { supabase } from "../supabase";
import { Panel, Field, Btn, Input, ErrLine, OkLine } from "../ui";
import { C } from "../theme";

export default function Profile() {
  const { profile, refreshProfile } = useAuth();
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
      setOk("PROFILE UPDATED");
    } catch (e) {
      setErr(String(e.message || e).toUpperCase());
    } finally { setBusy(false); }
  }

  async function changePassword(e) {
    e.preventDefault();
    setBusy(true); setErr(""); setOk("");
    try {
      if (pw.length < 6) throw new Error("PASSWORD TOO SHORT (MIN 6)");
      if (pw !== pw2) throw new Error("PASSWORDS DO NOT MATCH");
      const { error } = await supabase.auth.updateUser({ password: pw });
      if (error) throw error;
      setPw(""); setPw2("");
      setOk("PASSWORD UPDATED");
    } catch (e) {
      setErr(String(e.message || e).toUpperCase());
    } finally { setBusy(false); }
  }

  return (
    <div>
      <Panel title="// IDENTITY">
        <form onSubmit={saveProfile}>
          <Field label="EMAIL">
            <Input value={profile?.email || ""} readOnly />
          </Field>
          <Field label="ROLE">
            <Input value={roleLabel(profile?.role)} readOnly />
          </Field>
          <Field label="CALLSIGN">
            <Input value={callsign} onChange={(e) => setCallsign(e.target.value)} />
          </Field>
          <Field label="FULL NAME">
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Btn primary type="submit" disabled={busy}>
            {busy ? "SAVING..." : "[ SAVE PROFILE ]"}
          </Btn>
          <ErrLine>{err}</ErrLine>
          <OkLine>{ok}</OkLine>
        </form>
      </Panel>

      <Panel title="// PASSWORD">
        <form onSubmit={changePassword}>
          <Field label="NEW PASSWORD">
            <Input type="password" value={pw} onChange={(e) => setPw(e.target.value)} />
          </Field>
          <Field label="CONFIRM NEW PASSWORD">
            <Input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
          </Field>
          <Btn primary type="submit" disabled={busy}>[ CHANGE PASSWORD ]</Btn>
        </form>
        <div style={{ color: C.dim, fontSize: 12, marginTop: 12 }}>
          NOTE: PASSWORD RESETS REQUIRE A NEW SESSION
        </div>
      </Panel>
    </div>
  );
}
