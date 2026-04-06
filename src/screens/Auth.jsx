import { useState } from "react";
import { supabase, ADMIN_BOOTSTRAP_EMAIL } from "../supabase";
import { ScanlineWrap, Cursor, Field, Btn, Input, ErrLine, OkLine, Footer } from "../ui";
import { C } from "../theme";

export default function Auth() {
  const [mode, setMode] = useState("login"); // 'login' | 'signup'
  return (
    <ScanlineWrap>
      <div style={{
        minHeight: "calc(100vh - 60px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "40px 24px",
      }}>
        <div style={{
          width: "100%", maxWidth: 540,
          border: `1px solid ${C.border}`, padding: "32px 36px",
          background: "rgba(255,255,255,0.02)",
        }}>
          <h1 style={{ color: C.bright, margin: 0, fontSize: 22, letterSpacing: "2px" }}>
            // Z5 TERMINAL
          </h1>
          <div style={{ color: C.dim, marginTop: 4, marginBottom: 24, fontSize: 13 }}>
            SNIPER OPERATIONS ENVIRONMENT v2.0 <Cursor />
          </div>

          <div style={{ marginBottom: 20 }}>
            <Btn active={mode === "login"} onClick={() => setMode("login")}>[ LOGIN ]</Btn>{" "}
            <Btn active={mode === "signup"} onClick={() => setMode("signup")}>[ NEW OPERATOR ]</Btn>
          </div>

          {mode === "login" ? <LoginForm /> : <SignupForm />}
        </div>
      </div>
      <Footer />
    </ScanlineWrap>
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
      // AuthProvider picks up the session automatically.
    } catch (e) {
      setErr(String(e.message || e).toUpperCase());
    } finally { setBusy(false); }
  }

  return (
    <form onSubmit={go}>
      <Field label="EMAIL">
        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </Field>
      <Field label="PASSWORD">
        <Input type="password" value={pw} onChange={(e) => setPw(e.target.value)} required />
      </Field>
      <Btn primary type="submit" disabled={busy}>
        {busy ? "AUTHENTICATING..." : "[ AUTHENTICATE ]"}
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
      if (!csUp) throw new Error("CALLSIGN REQUIRED");
      if (!isBootstrapAdmin && !code.trim()) throw new Error("INVITE CODE REQUIRED");

      // 1. Create the auth user. Trigger creates the profiles row server-side.
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password: pw,
      });
      if (error) throw error;

      // Some Supabase projects require email confirmation. If so, the user
      // is created but the session is null until they confirm.
      const userId = data.user?.id;
      if (!userId) throw new Error("SIGNUP FAILED");

      // 2. Set callsign + name
      const { error: e2 } = await supabase.rpc("update_my_profile", {
        p_callsign: csUp, p_full_name: name,
      });
      if (e2) throw e2;

      // 3. Redeem invite (skip for bootstrap admin)
      if (!isBootstrapAdmin) {
        const { error: e3 } = await supabase.rpc("redeem_invite", {
          invite_code: code.trim().toUpperCase(),
        });
        if (e3) throw e3;
      }

      setOk("OPERATOR REGISTERED. PROCEED TO LOGIN.");
    } catch (e) {
      setErr(String(e.message || e).toUpperCase());
    } finally { setBusy(false); }
  }

  return (
    <form onSubmit={go}>
      <Field label="EMAIL">
        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </Field>
      <Field label="PASSWORD (MIN 6 CHARS)">
        <Input type="password" value={pw} onChange={(e) => setPw(e.target.value)} minLength={6} required />
      </Field>
      <Field label="CALLSIGN">
        <Input value={callsign} onChange={(e) => setCallsign(e.target.value)}
               placeholder="E.G. GHOST-1" required />
      </Field>
      <Field label="FULL NAME (OPTIONAL)">
        <Input value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      {!isBootstrapAdmin && (
        <Field label="INVITE CODE">
          <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())}
                 placeholder="E.G. Z5-AB12-CDE3" required />
        </Field>
      )}
      {isBootstrapAdmin && (
        <div style={{ color: C.bright, fontSize: 12, marginBottom: 12 }}>
          &gt; ADMIN BOOTSTRAP DETECTED — INVITE CODE NOT REQUIRED
        </div>
      )}
      <Btn primary type="submit" disabled={busy}>
        {busy ? "REGISTERING..." : "[ REGISTER ]"}
      </Btn>
      <ErrLine>{err}</ErrLine>
      <OkLine>{ok}</OkLine>
    </form>
  );
}
