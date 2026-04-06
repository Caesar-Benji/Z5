// Z5 :: shared theme constants and base style atoms
// White-on-black operations UI. Sans-serif body, mono for codes/serials.

export const C = {
  bg:         "#000",
  bgElevated: "#0a0a0a",
  panel:      "rgba(255,255,255,0.03)",
  panelHover: "rgba(255,255,255,0.05)",
  text:       "#f5f5f5",
  dim:        "#8a8a8a",
  dimmer:     "#5a5a5a",
  bright:     "#ffffff",
  border:     "#2a2a2a",
  borderBright:"#444444",
  accent:     "#ffffff",
  error:      "#ff5555",
  warn:       "#ffcc55",
  ok:         "#55ff99",
};

// Sans-serif body (system stack — SF Pro on Mac, Segoe UI on Windows, Roboto on Android).
export const FONT = `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`;
// Monospace reserved for callsigns, serials, invite codes, numeric data.
export const FONT_MONO = `"SF Mono", "Consolas", "Monaco", "Courier New", monospace`;

export const S = {
  input: {
    background: C.bgElevated,
    color: C.text,
    border: `1px solid ${C.border}`,
    padding: "10px 12px",
    fontFamily: FONT,
    fontSize: 15,
    width: "100%",
    outline: "none",
    boxSizing: "border-box",
    borderRadius: 2,
  },
  inputMono: {
    fontFamily: FONT_MONO,
    letterSpacing: "0.5px",
  },
  btn: {
    background: "transparent",
    color: C.text,
    border: `1px solid ${C.borderBright}`,
    padding: "10px 18px",
    fontFamily: FONT,
    cursor: "pointer",
    fontSize: 14,
    fontWeight: 500,
    letterSpacing: "0.3px",
    transition: "all 120ms",
    borderRadius: 2,
  },
  btnActive: {
    background: C.bright,
    borderColor: C.bright,
    color: "#000",
  },
  btnPrimary: {
    borderColor: C.bright,
    color: C.bright,
    padding: "12px 22px",
    fontSize: 15,
    fontWeight: 600,
  },
  btnSmall: {
    padding: "6px 12px",
    fontSize: 13,
  },
  panel: {
    border: `1px solid ${C.border}`,
    padding: "24px 28px",
    background: C.panel,
    marginBottom: 24,
    borderRadius: 4,
  },
  panelTitle: {
    color: C.bright,
    marginBottom: 20,
    fontSize: 13,
    fontWeight: 600,
    letterSpacing: "1.2px",
    textTransform: "uppercase",
    borderBottom: `1px solid ${C.border}`,
    paddingBottom: 12,
  },
  table: { width: "100%", borderCollapse: "collapse", marginBottom: 12 },
  th: {
    textAlign: "left",
    color: C.dim,
    borderBottom: `1px solid ${C.border}`,
    padding: "10px 8px",
    fontWeight: 600,
    fontSize: 12,
    letterSpacing: "0.8px",
    textTransform: "uppercase",
  },
  td: {
    padding: "10px 8px",
    borderBottom: `1px solid ${C.border}`,
    fontSize: 14,
    color: C.text,
  },
  tdMono: {
    fontFamily: FONT_MONO,
    fontSize: 13,
    color: C.text,
    letterSpacing: "0.3px",
  },
  label: {
    color: C.dim,
    fontSize: 12,
    marginBottom: 6,
    fontWeight: 600,
    letterSpacing: "0.8px",
    textTransform: "uppercase",
  },
  mono: {
    fontFamily: FONT_MONO,
    letterSpacing: "0.3px",
  },
};
