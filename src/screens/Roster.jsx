import { useEffect, useState, useCallback } from "react";
import { useAuth, roleLabel, canManageSquads, canCreateInvites } from "../auth";
import { supabase } from "../supabase";
import { Panel, PageHeader, Btn, Input, Field, ErrLine, OkLine, Badge, Mono } from "../ui";
import { C, S } from "../theme";

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

  return (
    <>
      <PageHeader
        title="Roster"
        subtitle="Squads, members and invite codes."
      />

      {showCreateSquad && (
        <CreateSquadPanel onCreated={(msg) => { setOk(msg); load(); }} setErr={setErr} />
      )}

      <Panel title="Squads">
        {squads.length === 0 && <div style={{ color: C.dim }}>No squads registered.</div>}
        {squads.map((sq) => (
          <SquadBlock key={sq.id} squad={sq} members={members.filter((m) => m.squad_id === sq.id)} />
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

function SquadBlock({ squad, members }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{
        color: C.bright,
        fontSize: 15,
        fontWeight: 600,
        marginBottom: 10,
        display: "flex",
        alignItems: "center",
        gap: 10,
      }}>
        {squad.name}
        <Badge>{members.length} {members.length === 1 ? "member" : "members"}</Badge>
      </div>
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
    </div>
  );
}

function CreateSquadPanel({ onCreated, setErr }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  async function create(e) {
    e.preventDefault();
    setBusy(true); setErr("");
    try {
      const nm = name.trim().toUpperCase();
      if (!nm) throw new Error("Squad name required");
      const { error } = await supabase.from("squads").insert({ name: nm });
      if (error) throw error;
      setName("");
      onCreated(`Squad "${nm}" registered.`);
    } catch (e) {
      setErr(String(e.message || e));
    } finally { setBusy(false); }
  }

  return (
    <Panel title="Register new squad">
      <form onSubmit={create} style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
        <Field label="Squad name">
          <Input value={name} onChange={(e) => setName(e.target.value)}
                 placeholder="e.g. WRAITH" style={{ width: 280 }} />
        </Field>
        <Btn primary type="submit" disabled={busy}>
          {busy ? "Registering…" : "Register squad"}
        </Btn>
      </form>
    </Panel>
  );
}

function InvitesPanel({ squads, invites, profile, onChanged, setErr }) {
  const isAdmin = profile?.role === "admin" || profile?.role === "officer";

  const allowedSquads = isAdmin ? squads : squads.filter((s) => s.id === profile?.squad_id);
  const allowedRoles  = isAdmin ? ["sniper", "squad_leader"] : ["sniper"];

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
        marginBottom: 24, display: "flex", gap: 14, alignItems: "flex-end", flexWrap: "wrap",
      }}>
        <Field inline label="Squad">
          <select value={squadId}
                  onChange={(e) => setSquadId(e.target.value)}
                  style={{ ...S.input, width: 260 }}>
            {allowedSquads.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
            {allowedSquads.length === 0 && <option value="">— No squads —</option>}
          </select>
        </Field>
        <Field inline label="Role">
          <select value={role}
                  onChange={(e) => setRole(e.target.value)}
                  style={{ ...S.input, width: 220 }}>
            {allowedRoles.map((r) => (
              <option key={r} value={r}>{roleLabel(r)}</option>
            ))}
          </select>
        </Field>
        <Btn primary type="submit" disabled={busy || !squadId}>
          {busy ? "Generating…" : "Generate code"}
        </Btn>
      </form>

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
    </Panel>
  );
}
