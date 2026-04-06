import { useEffect, useState, useCallback } from "react";
import { useAuth, roleLabel, canManageSquads, canCreateInvites } from "../auth";
import { supabase } from "../supabase";
import { Panel, Btn, Input, Field, ErrLine, OkLine } from "../ui";
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

  // realtime
  useEffect(() => {
    const ch = supabase.channel("z5-roster")
      .on("postgres_changes", { event: "*", schema: "public", table: "squads"   }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "invites"  }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  const showCreateSquad = canManageSquads(profile?.role);
  const showCreateInvite = canCreateInvites(profile?.role);

  return (
    <div>
      {showCreateSquad && (
        <CreateSquadPanel onCreated={(msg) => { setOk(msg); load(); }} setErr={setErr} />
      )}

      <Panel title="// SQUADS">
        {squads.length === 0 && <div style={{ color: C.dim }}>NO SQUADS REGISTERED</div>}
        {squads.map((sq) => (
          <SquadBlock key={sq.id} squad={sq} members={members.filter((m) => m.squad_id === sq.id)} />
        ))}
        {/* Unassigned section, only visible to admin/officer */}
        {showCreateSquad && (
          <SquadBlock squad={{ id: null, name: "UNASSIGNED" }}
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
    </div>
  );
}

function SquadBlock({ squad, members }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ color: C.bright, marginBottom: 6, letterSpacing: "0.5px" }}>
        &gt; {squad.name} <span style={{ color: C.dim }}>[{members.length}]</span>
      </div>
      <table style={S.table}>
        <thead>
          <tr>
            <th style={S.th}>CALLSIGN</th>
            <th style={S.th}>NAME</th>
            <th style={S.th}>ROLE</th>
            <th style={S.th}>EMAIL</th>
          </tr>
        </thead>
        <tbody>
          {members.map((m) => (
            <tr key={m.id}>
              <td style={S.td}>{m.callsign || "—"}</td>
              <td style={S.td}>{m.full_name || "—"}</td>
              <td style={S.td}>{roleLabel(m.role)}</td>
              <td style={S.td}>{m.email}</td>
            </tr>
          ))}
          {members.length === 0 && (
            <tr><td style={S.td} colSpan={4}>NO MEMBERS</td></tr>
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
      if (!nm) throw new Error("SQUAD NAME REQUIRED");
      const { error } = await supabase.from("squads").insert({ name: nm });
      if (error) throw error;
      setName("");
      onCreated(`SQUAD "${nm}" REGISTERED`);
    } catch (e) {
      setErr(String(e.message || e).toUpperCase());
    } finally { setBusy(false); }
  }

  return (
    <Panel title="// REGISTER NEW SQUAD">
      <form onSubmit={create}>
        <Field label="SQUAD NAME">
          <Input value={name} onChange={(e) => setName(e.target.value)}
                 placeholder="E.G. WRAITH" />
        </Field>
        <Btn primary type="submit" disabled={busy}>
          {busy ? "REGISTERING..." : "[ REGISTER SQUAD ]"}
        </Btn>
      </form>
    </Panel>
  );
}

function InvitesPanel({ squads, invites, profile, onChanged, setErr }) {
  const isAdmin = profile?.role === "admin" || profile?.role === "officer";

  // squad leaders can only invite snipers to their own squad
  const allowedSquads = isAdmin ? squads : squads.filter((s) => s.id === profile?.squad_id);
  const allowedRoles  = isAdmin ? ["sniper", "squad_leader"] : ["sniper"];

  const [squadId, setSquadId] = useState(allowedSquads[0]?.id || "");
  const [role, setRole] = useState("sniper");
  const [busy, setBusy] = useState(false);

  // keep squadId valid when squads list changes
  useEffect(() => {
    if (!allowedSquads.find((s) => s.id === squadId)) {
      setSquadId(allowedSquads[0]?.id || "");
    }
  }, [allowedSquads, squadId]);

  async function create(e) {
    e.preventDefault();
    setBusy(true); setErr("");
    try {
      if (!squadId) throw new Error("SELECT A SQUAD");
      const code = shortCode();
      const { error } = await supabase.from("invites").insert({
        code, squad_id: squadId, role,
      });
      if (error) throw error;
      onChanged(`INVITE GENERATED: ${code}`);
    } catch (e) {
      setErr(String(e.message || e).toUpperCase());
    } finally { setBusy(false); }
  }

  return (
    <Panel title="// INVITE CODES"
           action={<span style={{ color: C.dim, fontSize: 11 }}>SHARE CODE WITH NEW OPERATOR</span>}>
      <form onSubmit={create} style={{ marginBottom: 18 }}>
        <Field inline label="SQUAD">
          <select value={squadId}
                  onChange={(e) => setSquadId(e.target.value)}
                  style={{ ...S.input, maxWidth: 240 }}>
            {allowedSquads.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
            {allowedSquads.length === 0 && <option value="">— NO SQUADS —</option>}
          </select>
        </Field>
        <Field inline label="ROLE">
          <select value={role}
                  onChange={(e) => setRole(e.target.value)}
                  style={{ ...S.input, maxWidth: 200 }}>
            {allowedRoles.map((r) => (
              <option key={r} value={r}>{roleLabel(r)}</option>
            ))}
          </select>
        </Field>
        <div style={{ marginTop: 4 }}>
          <Btn primary type="submit" disabled={busy || !squadId}>
            {busy ? "GENERATING..." : "[ GENERATE CODE ]"}
          </Btn>
        </div>
      </form>

      <table style={S.table}>
        <thead>
          <tr>
            <th style={S.th}>CODE</th>
            <th style={S.th}>SQUAD</th>
            <th style={S.th}>ROLE</th>
            <th style={S.th}>STATUS</th>
            <th style={S.th}>CREATED</th>
          </tr>
        </thead>
        <tbody>
          {invites.map((inv) => {
            const sq = squads.find((s) => s.id === inv.squad_id);
            const used = !!inv.used_by;
            return (
              <tr key={inv.id}>
                <td style={{ ...S.td, color: used ? C.dim : C.bright }}>{inv.code}</td>
                <td style={S.td}>{sq?.name || "—"}</td>
                <td style={S.td}>{roleLabel(inv.role)}</td>
                <td style={{ ...S.td, color: used ? C.dim : C.bright }}>
                  {used ? "USED" : "AVAILABLE"}
                </td>
                <td style={S.td}>
                  {new Date(inv.created_at).toLocaleString([], {
                    month: "2-digit", day: "2-digit",
                    hour: "2-digit", minute: "2-digit",
                  })}
                </td>
              </tr>
            );
          })}
          {invites.length === 0 && (
            <tr><td style={S.td} colSpan={5}>NO INVITES GENERATED</td></tr>
          )}
        </tbody>
      </table>
    </Panel>
  );
}
