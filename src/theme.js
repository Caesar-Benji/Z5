// Z5 :: shared theme constants and base style atoms
// White-on-black terminal aesthetic.

export const C = {
  bg:      "#000",
  panel:   "rgba(255,255,255,0.02)",
  text:    "#f5f5f5",
  dim:     "#888888",
  bright:  "#ffffff",
  border:  "#888888",
  accent:  "#ffffff",
  error:   "#ff5555",
  warn:    "#ffcc55",
  ok:      "#ffffff",
};

export const FONT = `"Courier New", "Consolas", "Monaco", "Lucida Console", monospace`;

export const S = {
  input: {
    background: "#0a0a0a",
    color: C.text,
    border: `1px solid ${C.border}`,
    padding: "8px 10px",
    fontFamily: FONT,
    fontSize: 14,
    width: "100%",
    maxWidth: 360,
    outline: "none",
    boxSizing: "border-box",
  },
  btn: {
    background: "#000",
    color: C.text,
    border: `1px solid ${C.border}`,
    padding: "8px 14px",
    fontFamily: FONT,
    cursor: "pointer",
    fontSize: 13,
    letterSpacing: "0.5px",
    transition: "all 120ms",
  },
  btnActive: {
    background: "#1a1a1a",
    borderColor: C.bright,
    color: C.bright,
  },
  btnPrimary: {
    borderColor: C.bright,
    color: C.bright,
    padding: "10px 18px",
    fontSize: 14,
  },
  btnSmall: {
    padding: "3px 8px",
    fontSize: 12,
  },
  panel: {
    border: `1px solid ${C.border}`,
    padding: "20px 24px",
    background: C.panel,
    marginBottom: 24,
  },
  panelTitle: {
    color: C.bright,
    marginBottom: 16,
    fontSize: 13,
    letterSpacing: "1px",
    borderBottom: `1px dashed ${C.border}`,
    paddingBottom: 8,
  },
  table: { width: "100%", borderCollapse: "collapse", marginBottom: 12 },
  th: {
    textAlign: "left",
    color: C.dim,
    borderBottom: `1px solid ${C.border}`,
    padding: "8px 6px",
    fontWeight: "normal",
    fontSize: 12,
    letterSpacing: "0.5px",
  },
  td: { padding: "6px", borderBottom: `1px dashed ${C.border}`, fontSize: 13 },
  label: { color: C.dim, fontSize: 12, marginBottom: 4, letterSpacing: "0.5px" },
};
