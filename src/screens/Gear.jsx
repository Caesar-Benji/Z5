import { useEffect, useState, useCallback } from "react";
import { useAuth } from "../auth";
import { supabase } from "../supabase";
import { Panel, Btn, Input, ErrLine } from "../ui";
import { S } from "../theme";

const DEFAULT_SLOTS = [
  "PRIMARY WEAPON",
  "SCOPE / OPTIC",
  "SUPPRESSOR",
  "SECONDARY WEAPON",
  "RADIO",
  "NVG / THERMAL",
];

export default function Gear() {
  const { session } = useAuth();
  const userId = session?.user?.id;
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("gear").select("*")
      .eq("user_id", userId)
      .order("sort_order", { ascending: true });
    if (error) { setErr(String(error.message).toUpperCase()); setLoading(false); return; }
    if (!data || data.length === 0) {
      // seed defaults
      const seed = DEFAULT_SLOTS.map((slot, i) => ({
        user_id: userId, slot, model: "", serial: "", sort_order: i,
      }));
      const { data: inserted, error: e2 } = await supabase
        .from("gear").insert(seed).select();
      if (e2) { setErr(String(e2.message).toUpperCase()); }
      setRows(inserted || []);
    } else {
      setRows(data);
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  async function update(id, field, value) {
    setRows((arr) => arr.map((r) => r.id === id ? { ...r, [field]: value } : r));
    await supabase.from("gear").update({ [field]: value }).eq("id", id);
  }

  async function addRow() {
    const sort = rows.length;
    const { data } = await supabase.from("gear")
      .insert({ user_id: userId, slot: "CUSTOM", model: "", serial: "", sort_order: sort })
      .select().single();
    if (data) setRows((arr) => [...arr, data]);
  }

  async function removeRow(id) {
    setRows((arr) => arr.filter((r) => r.id !== id));
    await supabase.from("gear").delete().eq("id", id);
  }

  return (
    <Panel title="// PERSONAL GEAR INVENTORY"
           action={<Btn small onClick={addRow}>[ + ADD ROW ]</Btn>}>
      {loading && <div>LOADING...</div>}
      <ErrLine>{err}</ErrLine>
      <table style={S.table}>
        <thead>
          <tr>
            <th style={{ ...S.th, width: "22%" }}>SLOT</th>
            <th style={{ ...S.th, width: "32%" }}>MODEL</th>
            <th style={{ ...S.th, width: "26%" }}>SERIAL #</th>
            <th style={S.th}>NOTES</th>
            <th style={S.th}> </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td style={S.td}>
                <Input value={r.slot}
                       onChange={(e) => update(r.id, "slot", e.target.value.toUpperCase())} />
              </td>
              <td style={S.td}>
                <Input value={r.model}
                       onChange={(e) => update(r.id, "model", e.target.value)} />
              </td>
              <td style={S.td}>
                <Input value={r.serial}
                       onChange={(e) => update(r.id, "serial", e.target.value)} />
              </td>
              <td style={S.td}>
                <Input value={r.notes}
                       onChange={(e) => update(r.id, "notes", e.target.value)} />
              </td>
              <td style={S.td}>
                <Btn small onClick={() => removeRow(r.id)}>[ X ]</Btn>
              </td>
            </tr>
          ))}
          {rows.length === 0 && !loading && (
            <tr><td style={S.td} colSpan={5}>NO GEAR REGISTERED</td></tr>
          )}
        </tbody>
      </table>
    </Panel>
  );
}
