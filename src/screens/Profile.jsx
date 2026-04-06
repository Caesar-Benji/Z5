import { useState } from "react";
import { useAuth, roleLabel } from "../auth";
import { supabase } from "../supabase";
import { Panel, PageHeader, Field, Btn, Input, ErrLine, OkLine } from "../ui";
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
        subtitle="Your identity and password."
      />

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))",
        gap: 20,
      }}>
        <Panel title="Identity">
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
            <Btn primary type="submit" disabled={busy}>
              {busy ? "Saving…" : "Save profile"}
            </Btn>
            <ErrLine>{err}</ErrLine>
            <OkLine>{ok}</OkLine>
          </form>
        </Panel>

        <Panel title="Password">
          <form onSubmit={changePassword}>
            <Field label="New password">
              <Input type="password" value={pw} onChange={(e) => setPw(e.target.value)} />
            </Field>
            <Field label="Confirm new password">
              <Input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
            </Field>
            <Btn primary type="submit" disabled={busy}>Change password</Btn>
          </form>
          <div style={{ color: C.dim, fontSize: 12, marginTop: 14 }}>
            Password changes take effect immediately on the next request.
          </div>
        </Panel>
      </div>
    </>
  );
}
