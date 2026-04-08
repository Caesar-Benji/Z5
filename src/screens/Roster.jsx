import { useEffect, useState, useCallback, useMemo } from "react";
import { useAuth, roleLabel, canManageSquads, canCreateInvites } from "../auth";
import { supabase } from "../supabase";
import { Panel, PageHeader, Btn, Input, Field, ErrLine, OkLine, Badge, Mono } from "../ui";
import { useIsMobile } from "../useIsMobile";
import { C, S } from "../theme";
import AnnouncementComposer from "./AnnouncementComposer";

// Squad lifecycle status
const SQUAD_STATUS_LABELS = {
  active:   "ACTIVE",
  training: "IN TRAINING",
  archived: "ARCHIVED",
};
const SQUAD_STATUS_TONES = {
  active:   "ok",
  training: "warn",
  archived: "default",
};
const SQUAD_STATUS_ORDER = { active: 0, training: 1, archived: 2 };

function shortCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "Z5-";
  for (let i = 0; i < 4; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
  s += "-";
  for (let i = 0; i < 4; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
  return s;
}

export default function Roster() {
  const { profile } = useAuth();
  const [squads, setSquads] = useState([]);
  const [members, setMembers] = useState([]);
  const [invites, setInvites] = useState([]);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  const load = useCallback(async () => {
    setErr("");
    const [{ data: sq }, { data: ms }, { data: inv }] = await Promise.all([
      supabase.from("squads").select("*").order("name"),
      supabase.from("profiles").select("*").order("callsign"),
      supabase.from("invites").select("*").order("created_at", { ascending: false }),
    ]);
    setSquads(sq || []);
    setMembers(ms || []);
    setInvites(inv || []);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const ch = supabase.channel("z5-roster")
      .on("postgres_changes", { event: "*", schema: "public", table: "squads"   }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "invites"  }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  const showCreateSquad  = canManageSquads(profile?.role);
  const showCreateInvite = canCreateInvites(profile?.role);

  const sortedSquads = useMemo(() => {
    return [...squads].sort((a, b) => {
      const sa = SQUAD_STATUS_ORDER[a.status ?? "active"] ?? 0;
      const sb = SQUAD_STATUS_ORDER[b.status ?? "active"] ?? 0;
      if (sa !== sb) return sa - sb;
      return (a.name || "").localeCompare(b.name || "");
    });
  }, [squads]);

  async function changeSquadStatus(squad, nextStatus) {
    setErr(""); setOk("");
    const { error } = await supabase
      .from("squads")
      .update({ status: nextStatus })
      .eq("id", squad.id);
    if (error) { setErr(error.message); return; }
    setOk(`Squad "${squad.name}" → ${SQUAD_STATUS_LABELS[nextStatus]}.`);
    load();
  }

  return (
    <>
      <PageHeader
        title="Roster"
        subtitle="Squads, members and invite codes."
      />

      <AnnouncementComposer />

      {showCreateSquad && (
        <CreateSquadPanel onCreated={(msg) => { setOk(msg); load(); }} setErr={setErr} />
      )}

      <Panel title="Squads">
        {squads.length === 0 && <div style={{ color: C.dim }}>No squads registered.</div>}
        {sortedSquads.map((sq) => (
          <SquadBlock
            key={sq.id}
            squad={sq}
            members={members.filter((m) => m.squad_id === sq.id)}
            canManage={showCreateSquad}
            onChangeStatus={changeSquadStatus}
          />
        ))}
        {showCreateSquad && (
          <SquadBlock squad={{ id: null, name: "Unassigned" }}
                      members={members.filter((m) => !m.squad_id)} />
        )}
      </Panel>

      {showCreateInvite && (
        <InvitesPanel
          squads={squads}
          invites={invites}
          profile={profile}
          onChanged={(msg) => { setOk(msg); load(); }}
          setErr={setErr}
        />
      )}

      <ErrLine>{err}</ErrLine>
      <OkLine>{ok}</OkLine>
    </>
  );
}

function SquadBlock({ squad, members, canManage, onChangeStatus }) {
  const isMobile = useIsMobile();
  const status = squad.status ?? null; // null for the synthetic "Unassigned" block
  const statusLabel = status ? SQUAD_STATUS_LABELS[status] : null;
  const statusTone  = status ? SQUAD_STATUS_TONES[status]  : "default";

  // Available transitions, simple state machine
  function nextActions() {
    if (!status || !canManage || !onChangeStatus) return [];
    if (status === "training") {
      return [
        { label: "Graduate → Active", to: "active", primary: true },
        { label: "Archive",           to: "archived" },
      ];
    }
    if (status === "active") {
      return [
        { label: "Mark training", to: "training" },
        { label: "Archive",       to: "archived" },
      ];
    }
    if (status === "archived") {
      return [
        { label: "Reactivate", to: "active", primary: true },
      ];
    }
    return [];
  }
  const actions = nextActions();

  return (
    <div style={{
      marginBottom: 28,
      opacity: status === "archived" ? 0.55 : 1,
    }}>
      <div style={{
        color: C.bright,
        fontSize: 15,
        fontWeight: 600,
        marginBottom: 10,
        display: "flex",
        alignItems: "center",
        gap: 10,
        flexWrap: "wrap",
      }}>
        {squad.name}
        {statusLabel && <Badge tone={statusTone}>{statusLabel}</Badge>}
        <Badge>{members.length} {members.length === 1 ? "member" : "members"}</Badge>
        {actions.length > 0 && (
          <div style={{
            marginLeft: "auto",
            display: "flex",
            gap: 6,
            flexWrap: "wrap",
          }}>
            {actions.map((a) => (
              <Btn
                key={a.to}
                small
                primary={a.primary}
                onClick={() => onChangeStatus(squad, a.to)}
              >
                {a.label}
              </Btn>
            ))}
          </div>
        )}
      </div>
      {isMobile ? (
        <div>
          {members.map((m) => (
            <div key={m.id} style={{
              border: `1px solid ${C.border}`,
              borderRadius: 6,
              padding: "12px 14px",
              marginBottom: 10,
              background: "rgba(255,255,255,0.02)",
            }}>
              <div style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 6,
                gap: 10,
              }}>
                <Mono style={{ color: C.bright, fontWeight: 600, fontSize: 15 }}>
                  {m.callsign || "—"}
                </Mono>
                <Badge tone="bright">{roleLabel(m.role)}</Badge>
              </div>
              <div style={{ fontSize: 14, color: C.text, marginBottom: 2 }}>
                {m.full_name || <span style={{ color: C.dim }}>—</span>}
              </div>
              <div style={{
                fontSize: 12,
                color: C.dim,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}>
                {m.email}
              </div>
            </div>
          ))}
          {members.length === 0 && (
            <div style={{ color: C.dim, fontSize: 14, padding: "6px 0" }}>No members.</div>
          )}
        </div>
      ) : (
        <table style={S.table}>
          <thead>
            <tr>
              <th style={{ ...S.th, width: "20%" }}>Callsign</th>
              <th style={{ ...S.th, width: "25%" }}>Name</th>
              <th style={{ ...S.th, width: "18%" }}>Role</th>
              <th style={S.th}>Email</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id}>
                <td style={S.td}><Mono>{m.callsign || "—"}</Mono></td>
                <td style={S.td}>{m.full_name || <span style={{ color: C.dim }}>—</span>}</td>
                <td style={S.td}><Badge tone="bright">{roleLabel(m.role)}</Badge></td>
                <td style={{ ...S.td, color: C.dim }}>{m.email}</td>
              </tr>
            ))}
            {members.length === 0 && (
              <tr><td style={{ ...S.td, color: C.dim }} colSpan={4}>No members.</td></tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}

function CreateSquadPanel({ onCreated, setErr }) {
  const [name, setName] = useState("");
  const [status, setStatus] = useState("active");
  const [busy, setBusy] = useState(false);
  const isMobile = useIsMobile();

  async function create(e) {
    e.preventDefault();
    setBusy(true); setErr("");
    try {
      const nm = name.trim().toUpperCase();
      if (!nm) throw new Error("Squad name required");
      const { error } = await supabase.from("squads").insert({ name: nm, status });
      if (error) throw error;
      setName("");
      setStatus("active");
      onCreated(`Squad "${nm}" registered (${SQUAD_STATUS_LABELS[status]}).`);
    } catch (e) {
      setErr(String(e.message || e));
    } finally { setBusy(false); }
  }

  return (
    <Panel title="Register new squad">
      <form onSubmit={create} style={{
        display: "flex",
        gap: 12,
        alignItems: isMobile ? "stretch" : "flex-end",
        flexWrap: "wrap",
        flexDirection: isMobile ? "column" : "row",
      }}>
        <Field label="Squad name">
          <Input value={name} onChange={(e) => setName(e.target.value)}
                 placeholder="e.g. WRAITH"
                 style={{ width: isMobile ? "100%" : 240 }} />
        </Field>
        <Field label="Initial status">
          <select value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  style={{
                    ...S.input,
                    width: isMobile ? "100%" : 200,
                    fontSize: isMobile ? 16 : S.input.fontSize,
                    minHeight: isMobile ? 46 : undefined,
                  }}>
            <option value="active">Active</option>
            <option value="training">In training</option>
            <option value="archived">Archived</option>
          </select>
        </Field>
        <Btn primary type="submit" disabled={busy} fullWidth={isMobile}>
          {busy ? "Registering…" : "Register squad"}
        </Btn>
      </form>
    </Panel>
  );
}

function InvitesPanel({ squads, invites, profile, onChanged, setErr }) {
  const isAdmin = profile?.role === "admin" || profile?.role === "officer";
  const isMobile = useIsMobile();

  const allowedSquads = isAdmin ? squads : squads.filter((s) => s.id === profile?.squad_id);
  const allowedRoles  = isAdmin
    ? ["sniper", "squad_leader", "instructor"]
    : ["sniper"];

  const [squadId, setSquadId] = useState(allowedSquads[0]?.id || "");
  const [role, setRole] = useState("sniper");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!allowedSquads.find((s) => s.id === squadId)) {
      setSquadId(allowedSquads[0]?.id || "");
    }
  }, [allowedSquads, squadId]);

  async function create(e) {
    e.preventDefault();
    setBusy(true); setErr("");
    try {
      if (!squadId) throw new Error("Select a squad");
      const code = shortCode();
      const { error } = await supabase.from("invites").insert({
        code, squad_id: squadId, role,
      });
      if (error) throw error;
      onChanged(`Invite generated: ${code}`);
    } catch (e) {
      setErr(String(e.message || e));
    } finally { setBusy(false); }
  }

  return (
    <Panel title="Invite codes"
           action={<span style={{ color: C.dim, fontSize: 12 }}>Share the code with the new operator</span>}>
      <form onSubmit={create} style={{
        marginBottom: 24,
        display: "flex",
        gap: 14,
        alignItems: isMobile ? "stretch" : "flex-end",
        flexWrap: "wrap",
        flexDirection: isMobile ? "column" : "row",
      }}>
        <Field inline label="Squad">
          <select value={squadId}
                  onChange={(e) => setSquadId(e.target.value)}
                  style={{
                    ...S.input,
                    width: isMobile ? "100%" : 260,
                    fontSize: isMobile ? 16 : S.input.fontSize,
                    minHeight: isMobile ? 46 : undefined,
                  }}>
            {allowedSquads.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
            {allowedSquads.length === 0 && <option value="">— No squads —</option>}
          </select>
        </Field>
        <Field inline label="Role">
          <select value={role}
                  onChange={(e) => setRole(e.target.value)}
                  style={{
                    ...S.input,
                    width: isMobile ? "100%" : 220,
                    fontSize: isMobile ? 16 : S.input.fontSize,
                    minHeight: isMobile ? 46 : undefined,
                  }}>
            {allowedRoles.map((r) => (
              <option key={r} value={r}>{roleLabel(r)}</option>
            ))}
          </select>
        </Field>
        <Btn primary type="submit" disabled={busy || !squadId} fullWidth={isMobile}>
          {busy ? "Generating…" : "Generate code"}
        </Btn>
      </form>

      {isMobile ? (
        <div>
          {invites.map((inv) => {
            const sq = squads.find((s) => s.id === inv.squad_id);
            const used = !!inv.used_by;
            return (
              <div key={inv.id} style={{
                border: `1px solid ${C.border}`,
                borderRadius: 6,
                padding: "12px 14px",
                marginBottom: 10,
                background: "rgba(255,255,255,0.02)",
              }}>
                <div style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 10,
                  marginBottom: 8,
                }}>
                  <Mono style={{
                    color: used ? C.dim : C.bright,
                    fontWeight: 700,
                    fontSize: 15,
                  }}>
                    {inv.code}
                  </Mono>
                  {used ? <Badge>Used</Badge> : <Badge tone="ok">Available</Badge>}
                </div>
                <div style={{ fontSize: 13, color: C.text, marginBottom: 2 }}>
                  {sq?.name || "—"} · {roleLabel(inv.role)}
                </div>
                <div style={{ fontSize: 11, color: C.dim }}>
                  {new Date(inv.created_at).toLocaleString([], {
                    month: "short", day: "2-digit",
                    hour: "2-digit", minute: "2-digit",
                  })}
                </div>
              </div>
            );
          })}
          {invites.length === 0 && (
            <div style={{ color: C.dim, fontSize: 14, padding: "6px 0" }}>
              No invites generated.
            </div>
          )}
        </div>
      ) : (
      <table style={S.table}>
        <thead>
          <tr>
            <th style={S.th}>Code</th>
            <th style={S.th}>Squad</th>
            <th style={S.th}>Role</th>
            <th style={S.th}>Status</th>
            <th style={S.th}>Created</th>
          </tr>
        </thead>
        <tbody>
          {invites.map((inv) => {
            const sq = squads.find((s) => s.id === inv.squad_id);
            const used = !!inv.used_by;
            return (
              <tr key={inv.id}>
                <td style={S.td}>
                  <Mono style={{ color: used ? C.dim : C.bright, fontWeight: 600 }}>
                    {inv.code}
                  </Mono>
                </td>
                <td style={S.td}>{sq?.name || "—"}</td>
                <td style={S.td}>{roleLabel(inv.role)}</td>
                <td style={S.td}>
                  {used
                    ? <Badge>Used</Badge>
                    : <Badge tone="ok">Available</Badge>}
                </td>
                <td style={{ ...S.td, color: C.dim }}>
                  {new Date(inv.created_at).toLocaleString([], {
                    month: "short", day: "2-digit",
                    hour: "2-digit", minute: "2-digit",
                  })}
                </td>
              </tr>
            );
          })}
          {invites.length === 0 && (
            <tr><td style={{ ...S.td, color: C.dim }} colSpan={5}>No invites generated.</td></tr>
          )}
        </tbody>
      </table>
      )}
    </Panel>
  );
}
