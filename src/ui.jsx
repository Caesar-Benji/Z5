// Z5 :: shared UI primitives
import { useEffect, useState } from "react";
import { C, S, FONT } from "./theme";

export function ScanlineWrap({ children }) {
  return (
    <div style={{
      minHeight: "100vh", background: C.bg, color: C.text, fontFamily: FONT,
      fontSize: 14, position: "relative", overflowX: "hidden",
    }}>
      <div style={{
        pointerEvents: "none", position: "fixed", inset: 0, zIndex: 9999,
        background: `repeating-linear-gradient(
          to bottom,
          rgba(0,0,0,0) 0px,
          rgba(0,0,0,0) 2px,
          rgba(0,0,0,0.18) 3px,
          rgba(0,0,0,0.18) 3px
        )`,
      }} />
      <div style={{
        pointerEvents: "none", position: "fixed", inset: 0, zIndex: 9998,
        boxShadow: "inset 0 0 140px rgba(0,0,0,0.95)",
      }} />
      {children}
    </div>
  );
}

export function Cursor() {
  const [on, setOn] = useState(true);
  useEffect(() => {
    const t = setInterval(() => setOn((v) => !v), 500);
    return () => clearInterval(t);
  }, []);
  return <span style={{ color: C.bright }}>{on ? "█" : " "}</span>;
}

export function Panel({ title, children, action }) {
  return (
    <div style={S.panel}>
      <div style={{
        ...S.panelTitle, display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <span>{title}</span>
        {action}
      </div>
      {children}
    </div>
  );
}

export function Field({ label, children, inline }) {
  return (
    <div style={{
      display: inline ? "inline-block" : "block",
      marginRight: inline ? 16 : 0, marginBottom: 14,
      minWidth: inline ? 240 : "auto",
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

export function Input(props) {
  return <input {...props} style={{ ...S.input, ...(props.style || {}) }} />;
}

export function Textarea(props) {
  return <textarea {...props} style={{ ...S.input, height: 120, resize: "vertical", ...(props.style || {}) }} />;
}

export function ErrLine({ children }) {
  if (!children) return null;
  return <div style={{ color: C.error, marginTop: 12, fontSize: 13 }}>! {children}</div>;
}

export function OkLine({ children }) {
  if (!children) return null;
  return <div style={{ color: C.bright, marginTop: 12, fontSize: 13 }}>&gt; {children}</div>;
}

export function Footer({ text }) {
  return (
    <div style={{
      borderTop: `1px solid ${C.border}`, color: C.dim,
      padding: "10px 24px", fontSize: 12, marginTop: 32,
    }}>
      {text || "Z5 :: INTERNAL USE ONLY :: NO TRANSMISSION OUTSIDE OPERATIONAL NET"} <Cursor />
    </div>
  );
}
