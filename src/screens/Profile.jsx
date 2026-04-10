import { useState } from "react";
import { useAuth, roleLabelT, canManageSquads } from "../auth";
import { useI18n } from "../i18n";
import { supabase } from "../supabase";
import { Panel, PageHeader, Field, Btn, Input, ErrLine, OkLine } from "../ui";
import { useIsMobile } from "../useIsMobile";
import { C } from "../theme";
import Gear from "./Gear";

export default function Profile() {
  const { profile, refreshProfile, signOut } = useAuth();
  const { t, lang, setLang } = useI18n();
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
        title={t("prof.title")}
        subtitle={t("prof.subtitle")}
      />

      {/* Personal gear inventory — top priority */}
      <Gear />

      <div style={{
        display: "grid",
        gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fit, minmax(360px, 1fr))",
        gap: isMobile ? 14 : 20,
      }}>
        <Panel title={<><SoldierIcon /> {t("prof.title")}</>}>
          <form onSubmit={saveProfile}>
            <Field label={t("prof.email")}>
              <Input value={profile?.email || ""} readOnly />
            </Field>
            <Field label={t("prof.role")}>
              <Input value={roleLabelT(profile?.role, t)} readOnly />
            </Field>
            <Field label={t("prof.callsign")}>
              <Input mono value={callsign} onChange={(e) => setCallsign(e.target.value)} />
            </Field>
            <Field label={t("prof.fullname")}>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Btn primary type="submit" disabled={busy} fullWidth={isMobile}>
              {busy ? t("prof.saving") : t("prof.save")}
            </Btn>
            <ErrLine>{err}</ErrLine>
            <OkLine>{ok}</OkLine>
          </form>
        </Panel>

        <Panel title={<><LockIcon /> {t("prof.password")}</>}>
          <form onSubmit={changePassword}>
            <Field label={t("prof.newpw")}>
              <Input type="password" value={pw} onChange={(e) => setPw(e.target.value)} />
            </Field>
            <Field label={t("prof.confirmpw")}>
              <Input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
            </Field>
            <Btn primary type="submit" disabled={busy} fullWidth={isMobile}>{t("prof.changepw")}</Btn>
          </form>
          <div style={{ color: C.dim, fontSize: 12, marginTop: 14 }}>
            {t("prof.pw_note")}
          </div>
        </Panel>
      </div>

      {/* Language setting */}
      <Panel title={<>{t("prof.language")}</>}>
        <div style={{ display: "flex", gap: 10 }}>
          <Btn small active={lang === "he"} onClick={() => setLang("he")}>עברית</Btn>
          <Btn small active={lang === "en"} onClick={() => setLang("en")}>English</Btn>
        </div>
      </Panel>

      {/* Mobile sign out */}
      {isMobile && (
        <div style={{ marginTop: 24 }}>
          <Btn fullWidth onClick={signOut}>{t("prof.logout")}</Btn>
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
      <circle cx="8" cy="4" r="2.5" stroke="currentColor" strokeWidth="1.2" />
      <path d="M5 3.5 Q8 1.5 11 3.5" stroke="currentColor" strokeWidth="1" fill="none" />
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
      <rect x="3" y="7" width="10" height="7" rx="1" stroke="currentColor" strokeWidth="1.2" />
      <path d="M5.5 7 V5 Q5.5 2 8 2 Q10.5 2 10.5 5 V7" stroke="currentColor" strokeWidth="1.2" fill="none" />
      <circle cx="8" cy="11" r="1" fill="currentColor" />
    </svg>
  );
}
