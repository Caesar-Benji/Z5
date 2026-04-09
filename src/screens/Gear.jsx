import { useEffect, useState, useCallback } from "react";
import { useAuth } from "../auth";
import { supabase } from "../supabase";
import { Panel, PageHeader, Btn, Input, ErrLine } from "../ui";
import { useIsMobile } from "../useIsMobile";
import { S, C, FONT_MONO } from "../theme";

function GearMobileCard({ row, onChange, onRemove }) {
  const [open, setOpen] = useState(false);
  const r = row;

  return (
    <div style={{
      border: `1px solid ${C.border}`,
      borderRadius: 5,
      marginBottom: 8,
      background: "rgba(255,255,255,0.02)",
      overflow: "hidden",
    }}>
      {/* Collapsed summary — one tap to expand/edit */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          all: "unset",
          display: "flex",
          alignItems: "center",
          gap: 10,
          width: "100%",
          padding: "10px 12px",
          cursor: "pointer",
          boxSizing: "border-box",
          minHeight: 0,
        }}
      >
        <span style={{
          color: C.dimmer,
          fontSize: 12,
          width: 10,
          flexShrink: 0,
          transform: open ? "rotate(90deg)" : "none",
          transition: "transform 120ms",
          display: "inline-block",
        }}>▶</span>
        <div style={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          gap: 2,
        }}>
          <div style={{
            color: C.bright,
            fontSize: 14,
            fontWeight: 600,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            letterSpacing: "0.2px",
            textTransform: "uppercase",
          }}>
            {r.slot || "—"}
          </div>
          <div style={{
            color: C.dim,
            fontSize: 12,
            display: "flex",
            gap: 8,
            minWidth: 0,
          }}>
            <span style={{
              flex: 1,
              minWidth: 0,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}>
              {r.model || <span style={{ color: C.dimmer }}>no model</span>}
            </span>
            {r.serial && (
              <span style={{
                fontFamily: FONT_MONO,
                color: C.text,
                fontSize: 11,
                flexShrink: 0,
              }}>
                {r.serial}
              </span>
            )}
          </div>
        </div>
      </button>

      {/* Expanded editor */}
      {open && (
        <div style={{
          padding: "4px 12px 12px",
          borderTop: `1px solid ${C.border}`,
        }}>
          <CompactField label="Slot">
            <Input value={r.slot || ""}
                   onChange={(e) => onChange(r.id, "slot", e.target.value)} />
          </CompactField>
          <CompactField label="Model">
            <Input value={r.model || ""}
                   onChange={(e) => onChange(r.id, "model", e.target.value)} />
          </CompactField>
          <CompactField label="Serial #">
            <Input mono value={r.serial || ""}
                   onChange={(e) => onChange(r.id, "serial", e.target.value)} />
          </CompactField>
          <CompactField label="Notes">
            <Input value={r.notes || ""}
                   onChange={(e) => onChange(r.id, "notes", e.target.value)} />
          </CompactField>
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 4 }}>
            <Btn small onClick={() => onRemove(r.id)}>Remove</Btn>
          </div>
        </div>
      )}
    </div>
  );
}

function CompactField({ label, children }) {
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{
        color: C.dim,
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: "0.8px",
        textTransform: "uppercase",
        marginBottom: 4,
      }}>{label}</div>
      {children}
    </div>
  );
}

const DEFAULT_SLOTS = [
  "Primary weapon",
  "Scope / optic",
  "Suppressor",
  "Secondary weapon",
  "Radio",
  "NVG / thermal",
];

function RifleIcon({ size = 20 }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 48 28" fill="currentColor"
      style={{ verticalAlign: "middle", marginRight: 8, opacity: 0.85 }}
    >
      {/* Barrel + suppressor */}
      <rect x="0" y="10" width="20" height="2.5" rx="1" />
      {/* Handguard */}
      <rect x="12" y="8.5" width="10" height="5" rx="1" />
      {/* Receiver */}
      <rect x="22" y="7" width="10" height="7" rx="1.2" />
      {/* Scope body */}
      <rect x="16" y="3" width="14" height="4" rx="2" />
      {/* Scope front lens */}
      <circle cx="15" cy="5" r="2.2" />
      {/* Scope rear lens */}
      <circle cx="31" cy="5" r="1.8" />
      {/* Scope mount */}
      <rect x="22" y="5.5" width="2" height="2" />
      <rect x="28" y="5.5" width="2" height="2" />
      {/* Magazine */}
      <rect x="26" y="14" width="4" height="7" rx="0.8" />
      {/* Trigger guard */}
      <path d="M24 14 L24 18 Q24 20 26 20 L28 20" fill="none" stroke="currentColor" strokeWidth="1.4" />
      {/* Stock */}
      <path d="M32 8 L38 8 Q42 8 44 10 L48 14 L48 16 L44 16 L40 13 Q38 11.5 36 12 L32 14 Z" />
      {/* Grip */}
      <path d="M30 14 L31 14 L32 22 Q32 24 30 24 L29 24 Q28 24 28 22 L29 14 Z" />
    </svg>
  );
}

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
        title={<><RifleIcon /> Personal gear inventory</>}
        subtitle="Register every piece of gear with model and serial number."
        action={<Btn onClick={addRow} fullWidth={isMobile}>+ Add row</Btn>}
      />
      <Panel>
        {loading && <div style={{ color: C.dim }}>Loading…</div>}
        <ErrLine>{err}</ErrLine>

        {isMobile ? (
          <div>
            {rows.map((r) => (
              <GearMobileCard
                key={r.id}
                row={r}
                onChange={update}
                onRemove={removeRow}
              />
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
