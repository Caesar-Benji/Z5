// Z5 :: shared UI primitives
import { C, S, FONT } from "./theme";
import { useIsMobile } from "./useIsMobile";

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
  const isMobile = useIsMobile();
  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: isMobile ? "flex-start" : "center",
      justifyContent: "center",
      padding: isMobile
        ? "calc(24px + var(--safe-top)) 16px calc(24px + var(--safe-bottom))"
        : "40px 24px",
    }}>
      <div style={{ width: "100%", maxWidth }}>{children}</div>
    </div>
  );
}

// Height of the mobile bottom tab bar; used to pad main content so the
// last panel doesn't disappear behind the tab bar + safe-area.
const BOTTOM_TAB_HEIGHT = 62;

/**
 * App shell with:
 *  - Desktop: left sidebar 220px + scrollable main
 *  - Mobile:  compact top bar + main + fixed bottom tab bar
 *
 * Props:
 *   sidebar        — full sidebar node (desktop only, or opened drawer)
 *   mobileTopBar   — small node shown in the mobile top bar (logo + user chip)
 *   mobileTabBar   — tab bar node rendered at the bottom on mobile
 *   children       — main content
 */
export function AppShell({ sidebar, mobileTopBar, mobileTabBar, children }) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <div style={{
        display: "flex",
        flexDirection: "column",
        minHeight: "100vh",
        background: C.bg,
      }}>
        {mobileTopBar && (
          <header style={{
            position: "sticky",
            top: 0,
            zIndex: 20,
            background: "rgba(0,0,0,0.92)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
            borderBottom: `1px solid ${C.border}`,
            padding: "calc(10px + var(--safe-top)) 16px 10px",
          }}>
            {mobileTopBar}
          </header>
        )}
        <main style={{
          flex: 1,
          padding: `18px 16px calc(${BOTTOM_TAB_HEIGHT + 24}px + var(--safe-bottom))`,
          width: "100%",
          boxSizing: "border-box",
          minWidth: 0,
        }}>
          {children}
        </main>
        {mobileTabBar && (
          <nav style={{
            position: "fixed",
            left: 0,
            right: 0,
            bottom: 0,
            height: `calc(${BOTTOM_TAB_HEIGHT}px + var(--safe-bottom))`,
            paddingBottom: "var(--safe-bottom)",
            background: "rgba(0,0,0,0.96)",
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
            borderTop: `1px solid ${C.border}`,
            display: "flex",
            zIndex: 30,
          }}>
            {mobileTabBar}
          </nav>
        )}
      </div>
    );
  }

  // Desktop
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

// Sidebar nav link (desktop).
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

// Bottom tab bar item (mobile). Equally-spaced, stacked icon + label.
export function TabItem({ active, onClick, icon, label }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        background: "transparent",
        border: "none",
        borderTop: `2px solid ${active ? C.bright : "transparent"}`,
        color: active ? C.bright : C.dim,
        fontFamily: FONT,
        fontSize: 11,
        fontWeight: active ? 700 : 500,
        letterSpacing: "0.4px",
        textTransform: "uppercase",
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 3,
        padding: "8px 4px",
        minWidth: 0,
      }}
    >
      <span aria-hidden style={{ fontSize: 20, lineHeight: 1 }}>{icon}</span>
      <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%" }}>
        {label}
      </span>
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
  const isMobile = useIsMobile();
  return (
    <div style={{
      display: "flex",
      flexDirection: isMobile ? "column" : "row",
      justifyContent: "space-between",
      alignItems: isMobile ? "stretch" : "flex-start",
      gap: isMobile ? 12 : 0,
      marginBottom: isMobile ? 14 : 28,
      paddingBottom: isMobile ? 10 : 20,
      borderBottom: `1px solid ${C.border}`,
    }}>
      <div>
        <h1 style={{
          margin: 0,
          fontSize: isMobile ? 16 : 26,
          fontWeight: 700,
          color: C.bright,
          letterSpacing: isMobile ? "0.3px" : "-0.3px",
          textTransform: isMobile ? "uppercase" : "none",
          lineHeight: 1.2,
        }}>{title}</h1>
        {subtitle && (
          <div style={{
            color: C.dim,
            fontSize: isMobile ? 12 : 14,
            marginTop: isMobile ? 3 : 6,
          }}>
            {subtitle}
          </div>
        )}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}

export function Panel({ title, children, action }) {
  const isMobile = useIsMobile();
  const panelStyle = isMobile
    ? { ...S.panel, padding: "18px 16px", marginBottom: 16, borderRadius: 6 }
    : S.panel;
  return (
    <div style={panelStyle}>
      {title && (
        <div style={{
          ...S.panelTitle,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: isMobile ? 14 : 20,
          paddingBottom: isMobile ? 10 : 12,
          fontSize: isMobile ? 12 : 13,
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
  const isMobile = useIsMobile();
  return (
    <div style={{
      display: inline && !isMobile ? "inline-block" : "block",
      marginRight: inline && !isMobile ? 16 : 0,
      marginBottom: 16,
      minWidth: inline && !isMobile ? 240 : "auto",
      width: isMobile ? "100%" : "auto",
      verticalAlign: "top",
    }}>
      <div style={S.label}>{label}</div>
      {children}
    </div>
  );
}

export function Btn({ active, primary, small, fullWidth, style, ...rest }) {
  const isMobile = useIsMobile();
  let s = { ...S.btn };
  if (active) s = { ...s, ...S.btnActive };
  if (primary) s = { ...s, ...S.btnPrimary };
  if (small) s = { ...s, ...S.btnSmall };
  if (isMobile) {
    s = {
      ...s,
      minHeight: 44,
      padding: primary ? "12px 20px" : "11px 16px",
      fontSize: 15,
    };
  }
  if (fullWidth) s = { ...s, width: "100%" };
  if (style) s = { ...s, ...style };
  return <button {...rest} style={s} />;
}

export function Input({ mono, ...props }) {
  const isMobile = useIsMobile();
  const base = { ...S.input, ...(mono ? S.inputMono : {}) };
  if (isMobile) {
    base.fontSize = 16; // prevent iOS zoom on focus
    base.padding = "12px 14px";
    base.minHeight = 46;
  }
  return <input {...props} style={{ ...base, ...(props.style || {}) }} />;
}

export function Textarea(props) {
  const isMobile = useIsMobile();
  const base = { ...S.input, height: 120, resize: "vertical" };
  if (isMobile) {
    base.fontSize = 16;
    base.padding = "12px 14px";
  }
  return <textarea {...props} style={{ ...base, ...(props.style || {}) }} />;
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

/**
 * Stacked-card alternative to a table row, used on mobile to avoid
 * horizontal scroll. `rows` is an array of { label, value } pairs.
 */
export function DataCard({ title, rows, action }) {
  return (
    <div style={{
      border: `1px solid ${C.border}`,
      borderRadius: 4,
      padding: "14px 14px 10px",
      marginBottom: 12,
      background: "rgba(255,255,255,0.02)",
    }}>
      {(title || action) && (
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 10,
          paddingBottom: 8,
          borderBottom: `1px solid ${C.border}`,
        }}>
          <div style={{ color: C.bright, fontWeight: 600, fontSize: 14 }}>{title}</div>
          {action}
        </div>
      )}
      {rows.map((r, i) => (
        <div key={i} style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          padding: "6px 0",
          fontSize: 14,
        }}>
          <div style={{
            color: C.dim,
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: "0.8px",
            textTransform: "uppercase",
            flexShrink: 0,
          }}>{r.label}</div>
          <div style={{
            color: C.text,
            textAlign: "right",
            overflow: "hidden",
            textOverflow: "ellipsis",
            minWidth: 0,
          }}>{r.value}</div>
        </div>
      ))}
    </div>
  );
}
