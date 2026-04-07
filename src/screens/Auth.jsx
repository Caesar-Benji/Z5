import { useState } from "react";
import { supabase, ADMIN_BOOTSTRAP_EMAIL } from "../supabase";
import { Page, CenteredColumn, Field, Btn, Input, ErrLine, OkLine } from "../ui";
import { C } from "../theme";

export default function Auth() {
  const [mode, setMode] = useState("login"); // 'login' | 'signup'
  return (
    <Page>
      <CenteredColumn maxWidth={480}>
        <div style={{
          border: `1px solid ${C.border}`,
          padding: "40px 44px",
          background: "rgba(255,255,255,0.02)",
          borderRadius: 6,
        }}>
          <div style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            marginBottom: 24,
          }}>
            <img
              src={`${import.meta.env.BASE_URL}z5-logo.png`}
              alt="Z5"
              style={{
                width: "100%",
                maxWidth: 240,
                maxHeight: 140,
                objectFit: "contain",
                marginBottom: 16,
              }}
            />
            <h1 style={{
              color: C.bright,
              margin: 0,
              fontSize: 28,
              fontWeight: 700,
              letterSpacing: "-0.3px",
              textAlign: "center",
            }}>
              Z5 Terminal
            </h1>
            <div style={{
              color: C.dim,
              marginTop: 6,
              fontSize: 14,
              textAlign: "center",
            }}>
              Sniper Operations Environment · v2.0
            </div>
          </div>

          <div style={{ marginBottom: 24, display: "flex", gap: 10 }}>
            <Btn active={mode === "login"}  onClick={() => setMode("login")}>Sign in</Btn>
            <Btn active={mode === "signup"} onClick={() => setMode("signup")}>New operator</Btn>
          </div>

          {mode === "login" ? <LoginForm /> : <SignupForm />}
        </div>
        <div style={{
          textAlign: "center",
          marginTop: 24,
          color: C.dimmer,
          fontSize: 12,
          letterSpacing: "0.3px",
        }}>
          Internal Use Only · No Transmission Outside Operational Net
        </div>
      </CenteredColumn>
    </Page>
  );
}

function LoginForm() {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function go(e) {
    e.preventDefault();
    setBusy(true); setErr("");
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: pw });
      if (error) throw error;
    } catch (e) {
      setErr(String(e.message || e));
    } finally { setBusy(false); }
  }

  return (
    <form onSubmit={go}>
      <Field label="Email">
        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </Field>
      <Field label="Password">
        <Input type="password" value={pw} onChange={(e) => setPw(e.target.value)} required />
      </Field>
      <Btn primary type="submit" disabled={busy}>
        {busy ? "Authenticating…" : "Authenticate"}
      </Btn>
      <ErrLine>{err}</ErrLine>
    </form>
  );
}

function SignupForm() {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [code, setCode] = useState("");
  const [callsign, setCallsign] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  const isBootstrapAdmin = email.trim().toLowerCase() === ADMIN_BOOTSTRAP_EMAIL;

  async function go(e) {
    e.preventDefault();
    setBusy(true); setErr(""); setOk("");
    try {
      const csUp = callsign.trim().toUpperCase();
      if (!csUp) throw new Error("Callsign required");
      if (!isBootstrapAdmin && !code.trim()) throw new Error("Invite code required");

      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password: pw,
      });
      if (error) throw error;

      const userId = data.user?.id;
      if (!userId) throw new Error("Signup failed");

      const { error: e2 } = await supabase.rpc("update_my_profile", {
        p_callsign: csUp, p_full_name: name,
      });
      if (e2) throw e2;

      if (!isBootstrapAdmin) {
        const { error: e3 } = await supabase.rpc("redeem_invite", {
          invite_code: code.trim().toUpperCase(),
        });
        if (e3) throw e3;
      }

      setOk("Operator registered. Proceed to sign in.");
    } catch (e) {
      setErr(String(e.message || e));
    } finally { setBusy(false); }
  }

  return (
    <form onSubmit={go}>
      <Field label="Email">
        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </Field>
      <Field label="Password (min 6 chars)">
        <Input type="password" value={pw} onChange={(e) => setPw(e.target.value)} minLength={6} required />
      </Field>
      <Field label="Callsign">
        <Input mono value={callsign} onChange={(e) => setCallsign(e.target.value)}
               placeholder="e.g. GHOST-1" required />
      </Field>
      <Field label="Full name (optional)">
        <Input value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      {!isBootstrapAdmin && (
        <Field label="Invite code">
          <Input mono value={code} onChange={(e) => setCode(e.target.value.toUpperCase())}
                 placeholder="e.g. Z5-AB12-CDE3" required />
        </Field>
      )}
      {isBootstrapAdmin && (
        <div style={{
          color: C.bright, fontSize: 13, marginBottom: 16,
          padding: "8px 12px",
          background: "rgba(255,255,255,0.06)",
          border: `1px solid ${C.border}`,
          borderRadius: 2,
        }}>
          Admin bootstrap detected — invite code not required.
        </div>
      )}
      <Btn primary type="submit" disabled={busy}>
        {busy ? "Registering…" : "Register"}
      </Btn>
      <ErrLine>{err}</ErrLine>
      <OkLine>{ok}</OkLine>
    </form>
  );
}
