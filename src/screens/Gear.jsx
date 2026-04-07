import { useEffect, useState, useCallback } from "react";
import { useAuth } from "../auth";
import { supabase } from "../supabase";
import { Panel, PageHeader, Btn, Input, ErrLine, Field } from "../ui";
import { useIsMobile } from "../useIsMobile";
import { S, C } from "../theme";

const DEFAULT_SLOTS = [
  "Primary weapon",
  "Scope / optic",
  "Suppressor",
  "Secondary weapon",
  "Radio",
  "NVG / thermal",
];

export default function Gear() {
  const { session } = useAuth();
  const userId = session?.user?.id;
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  const isMobile = useIsMobile();

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("gear").select("*")
      .eq("user_id", userId)
      .order("sort_order", { ascending: true });
    if (error) { setErr(String(error.message)); setLoading(false); return; }
    if (!data || data.length === 0) {
      const seed = DEFAULT_SLOTS.map((slot, i) => ({
        user_id: userId, slot, model: "", serial: "", sort_order: i,
      }));
      const { data: inserted, error: e2 } = await supabase
        .from("gear").insert(seed).select();
      if (e2) setErr(String(e2.message));
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
      .insert({ user_id: userId, slot: "Custom", model: "", serial: "", sort_order: sort })
      .select().single();
    if (data) setRows((arr) => [...arr, data]);
  }

  async function removeRow(id) {
    setRows((arr) => arr.filter((r) => r.id !== id));
    await supabase.from("gear").delete().eq("id", id);
  }

  return (
    <>
      <PageHeader
        title="Personal gear inventory"
        subtitle="Register every piece of gear with model and serial number."
        action={<Btn onClick={addRow} fullWidth={isMobile}>+ Add row</Btn>}
      />
      <Panel>
        {loading && <div style={{ color: C.dim }}>Loading…</div>}
        <ErrLine>{err}</ErrLine>

        {isMobile ? (
          <div>
            {rows.map((r) => (
              <div key={r.id} style={{
                border: `1px solid ${C.border}`,
                borderRadius: 6,
                padding: 14,
                marginBottom: 14,
                background: "rgba(255,255,255,0.02)",
              }}>
                <Field label="Slot">
                  <Input value={r.slot || ""}
                         onChange={(e) => update(r.id, "slot", e.target.value)} />
                </Field>
                <Field label="Model">
                  <Input value={r.model || ""}
                         onChange={(e) => update(r.id, "model", e.target.value)} />
                </Field>
                <Field label="Serial #">
                  <Input mono value={r.serial || ""}
                         onChange={(e) => update(r.id, "serial", e.target.value)} />
                </Field>
                <Field label="Notes">
                  <Input value={r.notes || ""}
                         onChange={(e) => update(r.id, "notes", e.target.value)} />
                </Field>
                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 4 }}>
                  <Btn small onClick={() => removeRow(r.id)}>Remove</Btn>
                </div>
              </div>
            ))}
            {rows.length === 0 && !loading && (
              <div style={{ color: C.dim, fontSize: 14, padding: "8px 0" }}>
                No gear registered.
              </div>
            )}
          </div>
        ) : (
          <table style={S.table}>
            <thead>
              <tr>
                <th style={{ ...S.th, width: "22%" }}>Slot</th>
                <th style={{ ...S.th, width: "28%" }}>Model</th>
                <th style={{ ...S.th, width: "22%" }}>Serial #</th>
                <th style={S.th}>Notes</th>
                <th style={{ ...S.th, width: 60 }}></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td style={S.td}>
                    <Input value={r.slot || ""}
                           onChange={(e) => update(r.id, "slot", e.target.value)} />
                  </td>
                  <td style={S.td}>
                    <Input value={r.model || ""}
                           onChange={(e) => update(r.id, "model", e.target.value)} />
                  </td>
                  <td style={S.td}>
                    <Input mono value={r.serial || ""}
                           onChange={(e) => update(r.id, "serial", e.target.value)} />
                  </td>
                  <td style={S.td}>
                    <Input value={r.notes || ""}
                           onChange={(e) => update(r.id, "notes", e.target.value)} />
                  </td>
                  <td style={S.td}>
                    <Btn small onClick={() => removeRow(r.id)}>Remove</Btn>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && !loading && (
                <tr><td style={S.td} colSpan={5}>No gear registered.</td></tr>
              )}
            </tbody>
          </table>
        )}
      </Panel>
    </>
  );
}
