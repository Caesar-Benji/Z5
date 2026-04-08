import { useState } from "react";
import { useAuth, canCreateInvites, canManageSquads } from "../auth";
import { Panel, Field, Input, Textarea, Btn, ErrLine, OkLine } from "../ui";
import { useIsMobile } from "../useIsMobile";
import { C } from "../theme";
import { postAnnouncement } from "../data/announcements";

/**
 * Compact announcement composer.
 *  - admin / officer  → can post global or squad (any squad)
 *  - squad_leader     → can post squad-scoped to own squad only
 *  - sniper           → component renders nothing
 */
export default function AnnouncementComposer() {
  const { profile } = useAuth();
  const isMobile = useIsMobile();

  const isLead   = profile?.role === "squad_leader";
  const isAdmin  = canManageSquads(profile?.role); // admin or officer
  const canPost  = canCreateInvites(profile?.role); // lead, officer, admin

  const [scope, setScope] = useState(isAdmin ? "global" : "squad");
  const [title, setTitle] = useState("");
  const [body, setBody]   = useState("");
  const [busy, setBusy]   = useState(false);
  const [err, setErr]     = useState("");
  const [ok, setOk]       = useState("");

  if (!canPost) return null;
  if (isLead && !profile?.squad_id) return null;

  async function submit(e) {
    e.preventDefault();
    setErr(""); setOk("");
    if (!body.trim()) { setErr("Body cannot be empty."); return; }
    setBusy(true);
    const squadId = scope === "squad"
      ? (isLead ? profile.squad_id : profile.squad_id || null)
      : null;
    if (scope === "squad" && !squadId) {
      setBusy(false);
      setErr("Cannot post squad announcement without an assigned squad.");
      return;
    }
    const { error } = await postAnnouncement({
      scope,
      squadId,
      title: title.trim(),
      body: body.trim(),
    });
    setBusy(false);
    if (error) { setErr(String(error.message || error)); return; }
    setOk("Announcement posted.");
    setTitle("");
    setBody("");
  }

  return (
    <Panel title="Post announcement">
      <form onSubmit={submit}>
        {isAdmin && (
          <Field label="Scope">
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Btn
                type="button"
                small
                active={scope === "global"}
                onClick={() => setScope("global")}
              >
                Global
              </Btn>
              <Btn
                type="button"
                small
                active={scope === "squad"}
                onClick={() => setScope("squad")}
                disabled={!profile?.squad_id}
              >
                My squad
              </Btn>
            </div>
            <div style={{ color: C.dim, fontSize: 12, marginTop: 6 }}>
              {scope === "global"
                ? "Visible to every operator."
                : "Visible only to your current squad."}
            </div>
          </Field>
        )}
        {!isAdmin && (
          <div style={{ color: C.dim, fontSize: 12, marginBottom: 12 }}>
            Squad leaders post to their own squad.
          </div>
        )}

        <Field label="Title (optional)">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Short headline"
            maxLength={80}
          />
        </Field>

        <Field label="Body">
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Details, orders, reminders…"
            rows={4}
          />
        </Field>

        <div style={{ marginTop: 8 }}>
          <Btn primary disabled={busy} fullWidth={isMobile}>
            {busy ? "Posting…" : "Post"}
          </Btn>
        </div>

        <ErrLine>{err}</ErrLine>
        <OkLine>{ok}</OkLine>
      </form>
    </Panel>
  );
}
