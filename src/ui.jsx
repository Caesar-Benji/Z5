// Z5 :: shared UI primitives
import { C, S, FONT } from "./theme";

// Full-viewport page wrapper (replaces the old ScanlineWrap).
export function Page({ children }) {
  return (
    <div style={{
      minHeight: "100vh",
      background: C.bg,
      color: C.text,
      fontFamily: FONT,
      fontSize: 15,
      lineHeight: 1.5,
      WebkitFontSmoothing: "antialiased",
      MozOsxFontSmoothing: "grayscale",
    }}>
      {children}
    </div>
  );
}

// Centered narrow column (used for the auth screen).
export function CenteredColumn({ children, maxWidth = 460 }) {
  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "40px 24px",
    }}>
      <div style={{ width: "100%", maxWidth }}>{children}</div>
    </div>
  );
}

// App shell with a left sidebar nav and a main content area that fills the rest.
export function AppShell({ sidebar, topBar, children }) {
  return (
    <div style={{
      display: "flex",
      minHeight: "100vh",
      background: C.bg,
    }}>
      <aside style={{
        width: 220,
        flexShrink: 0,
        borderRight: `1px solid ${C.border}`,
        padding: "28px 18px",
        background: "rgba(255,255,255,0.015)",
        display: "flex",
        flexDirection: "column",
        gap: 4,
        position: "sticky",
        top: 0,
        height: "100vh",
        overflowY: "auto",
      }}>
        {sidebar}
      </aside>
      <main style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        minWidth: 0,
      }}>
        {topBar}
        <div style={{
          flex: 1,
          padding: "32px 40px",
          maxWidth: 1400,
          width: "100%",
          boxSizing: "border-box",
        }}>
          {children}
        </div>
      </main>
    </div>
  );
}

// Sidebar nav link.
export function NavItem({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: active ? "rgba(255,255,255,0.08)" : "transparent",
        color: active ? C.bright : C.dim,
        border: "none",
        borderLeft: `2px solid ${active ? C.bright : "transparent"}`,
        padding: "10px 14px",
        textAlign: "left",
        fontFamily: FONT,
        fontSize: 14,
        fontWeight: active ? 600 : 500,
        cursor: "pointer",
        letterSpacing: "0.3px",
        transition: "all 120ms",
        borderRadius: 0,
      }}
    >
      {children}
    </button>
  );
}

// Sidebar section label (e.g. "NAVIGATION", "ACCOUNT").
export function NavLabel({ children }) {
  return (
    <div style={{
      color: C.dimmer,
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: "1.2px",
      textTransform: "uppercase",
      padding: "18px 14px 8px",
    }}>
      {children}
    </div>
  );
}

// Section heading used at the top of each screen.
export function PageHeader({ title, subtitle, action }) {
  return (
    <div style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "flex-start",
      marginBottom: 28,
      paddingBottom: 20,
      borderBottom: `1px solid ${C.border}`,
    }}>
      <div>
        <h1 style={{
          margin: 0,
          fontSize: 26,
          fontWeight: 700,
          color: C.bright,
          letterSpacing: "-0.3px",
        }}>{title}</h1>
        {subtitle && (
          <div style={{ color: C.dim, fontSize: 14, marginTop: 6 }}>
            {subtitle}
          </div>
        )}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}

export function Panel({ title, children, action }) {
  return (
    <div style={S.panel}>
      {title && (
        <div style={{
          ...S.panelTitle,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}>
          <span>{title}</span>
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

export function Field({ label, children, inline }) {
  return (
    <div style={{
      display: inline ? "inline-block" : "block",
      marginRight: inline ? 16 : 0,
      marginBottom: 16,
      minWidth: inline ? 240 : "auto",
      verticalAlign: "top",
    }}>
      <div style={S.label}>{label}</div>
      {children}
    </div>
  );
}

export function Btn({ active, primary, small, style, ...rest }) {
  let s = { ...S.btn };
  if (active) s = { ...s, ...S.btnActive };
  if (primary) s = { ...s, ...S.btnPrimary };
  if (small) s = { ...s, ...S.btnSmall };
  if (style) s = { ...s, ...style };
  return <button {...rest} style={s} />;
}

export function Input({ mono, ...props }) {
  return <input {...props} style={{ ...S.input, ...(mono ? S.inputMono : {}), ...(props.style || {}) }} />;
}

export function Textarea(props) {
  return <textarea {...props} style={{ ...S.input, height: 120, resize: "vertical", ...(props.style || {}) }} />;
}

export function Mono({ children, style }) {
  return <span style={{ ...S.mono, ...(style || {}) }}>{children}</span>;
}

export function Badge({ children, tone = "default" }) {
  const tones = {
    default: { bg: "rgba(255,255,255,0.08)", fg: C.text, border: C.border },
    bright:  { bg: "rgba(255,255,255,0.14)", fg: C.bright, border: C.borderBright },
    ok:      { bg: "rgba(85,255,153,0.1)",   fg: C.ok,     border: "#2a5a3a" },
    warn:    { bg: "rgba(255,204,85,0.1)",   fg: C.warn,   border: "#5a4a2a" },
    error:   { bg: "rgba(255,85,85,0.1)",    fg: C.error,  border: "#5a2a2a" },
  };
  const t = tones[tone] || tones.default;
  return (
    <span style={{
      display: "inline-block",
      padding: "3px 10px",
      fontSize: 11,
      fontWeight: 600,
      letterSpacing: "0.5px",
      textTransform: "uppercase",
      background: t.bg,
      color: t.fg,
      border: `1px solid ${t.border}`,
      borderRadius: 2,
    }}>{children}</span>
  );
}

export function ErrLine({ children }) {
  if (!children) return null;
  return (
    <div style={{
      color: C.error,
      marginTop: 14,
      fontSize: 13,
      padding: "8px 12px",
      background: "rgba(255,85,85,0.08)",
      border: `1px solid rgba(255,85,85,0.25)`,
      borderRadius: 2,
    }}>{children}</div>
  );
}

export function OkLine({ children }) {
  if (!children) return null;
  return (
    <div style={{
      color: C.ok,
      marginTop: 14,
      fontSize: 13,
      padding: "8px 12px",
      background: "rgba(85,255,153,0.08)",
      border: `1px solid rgba(85,255,153,0.25)`,
      borderRadius: 2,
    }}>{children}</div>
  );
}

export function Footer({ text }) {
  return (
    <div style={{
      borderTop: `1px solid ${C.border}`,
      color: C.dimmer,
      padding: "14px 40px",
      fontSize: 12,
      marginTop: "auto",
      letterSpacing: "0.3px",
    }}>
      {text || "Z5 · Internal Use Only · No Transmission Outside Operational Net"}
    </div>
  );
}
