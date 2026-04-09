import { useCallback, useEffect, useState, useRef } from "react";
import { useAuth, canManageSquads } from "../auth";
import { Panel, PageHeader, Btn, Input, Textarea, Field, ErrLine, OkLine, Badge } from "../ui";
import { useIsMobile } from "../useIsMobile";
import { C, FONT_MONO, S } from "../theme";
import {
  listMaterials, listCategories, uploadMaterial,
  deleteMaterial, getMaterialUrl, subscribeKnowledge,
} from "../data/knowledge";

function canUpload(role) {
  return role === "admin" || role === "officer" || role === "instructor";
}

export default function Knowledge() {
  const { profile } = useAuth();
  const isMobile = useIsMobile();
  const [materials, setMaterials] = useState([]);
  const [categories, setCategories] = useState([]);
  const [catFilter, setCatFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [viewingUrl, setViewingUrl] = useState(null);
  const [viewingTitle, setViewingTitle] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data }, { data: cats }] = await Promise.all([
      listMaterials({ category: catFilter }),
      listCategories(),
    ]);
    setMaterials(data);
    setCategories(cats);
    setLoading(false);
  }, [catFilter]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const unsub = subscribeKnowledge(() => load());
    return unsub;
  }, [load]);

  const showUpload = canUpload(profile?.role);

  // Viewing a PDF inline
  if (viewingUrl) {
    return (
      <>
        <PageHeader
          title={<><span style={{ marginRight: 8 }}>📖</span>{viewingTitle}</>}
        />
        <Panel>
          <div style={{
            width: "100%",
            height: isMobile ? "calc(100vh - 200px)" : "calc(100vh - 180px)",
            border: `1px solid ${C.border}`,
            borderRadius: 4,
            overflow: "hidden",
            background: "#111",
          }}>
            <iframe
              src={viewingUrl}
              title={viewingTitle}
              style={{
                width: "100%",
                height: "100%",
                border: "none",
              }}
            />
          </div>
          <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
            <Btn onClick={() => { setViewingUrl(null); setViewingTitle(""); }}>
              ← Back to materials
            </Btn>
            <Btn small onClick={() => window.open(viewingUrl, "_blank")}>
              Open in new tab
            </Btn>
          </div>
        </Panel>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={<><span style={{ marginRight: 8 }}>📖</span>Knowledge base</>}
        subtitle="Course materials, presentations and references."
      />

      {showUpload && <UploadPanel onUploaded={load} />}

      <Panel>
        {/* Category filter */}
        {categories.length > 1 && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
            <Btn small active={catFilter === "all"} onClick={() => setCatFilter("all")}>
              All
            </Btn>
            {categories.map((cat) => (
              <Btn
                key={cat}
                small
                active={catFilter === cat}
                onClick={() => setCatFilter(cat)}
              >
                {cat.toUpperCase()}
              </Btn>
            ))}
          </div>
        )}

        {loading && <div style={{ color: C.dim, fontSize: 13 }}>Loading…</div>}
        {!loading && materials.length === 0 && (
          <div style={{ color: C.dim, fontSize: 13, padding: "4px 0" }}>
            No materials uploaded yet.
          </div>
        )}

        {materials.map((m) => (
          <MaterialRow
            key={m.id}
            material={m}
            canDelete={canUpload(profile?.role)}
            onView={() => {
              const url = getMaterialUrl(m.file_path);
              setViewingUrl(url);
              setViewingTitle(m.title || m.file_name);
            }}
            onDeleted={load}
          />
        ))}
      </Panel>
    </>
  );
}

/* ── Upload panel ── */
function UploadPanel({ onUploaded }) {
  const isMobile = useIsMobile();
  const fileRef = useRef(null);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [category, setCategory] = useState("general");
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  async function handleUpload(e) {
    e.preventDefault();
    if (!file) { setErr("Select a file."); return; }
    if (!title.trim()) { setErr("Title is required."); return; }
    setBusy(true); setErr(""); setOk("");
    const { error } = await uploadMaterial({
      file,
      title: title.trim(),
      description: desc.trim(),
      category: category.trim().toLowerCase() || "general",
    });
    setBusy(false);
    if (error) { setErr(String(error.message || error)); return; }
    setOk(`"${title.trim()}" uploaded.`);
    setTitle(""); setDesc(""); setFile(null);
    if (fileRef.current) fileRef.current.value = "";
    onUploaded?.();
  }

  return (
    <Panel title="Upload material">
      <form onSubmit={handleUpload}>
        <div style={{
          display: "flex",
          gap: 12,
          flexWrap: "wrap",
          flexDirection: isMobile ? "column" : "row",
          alignItems: isMobile ? "stretch" : "flex-end",
        }}>
          <Field label="Title">
            <Input value={title} onChange={(e) => setTitle(e.target.value)}
                   placeholder="Lesson title" style={{ width: isMobile ? "100%" : 220 }} />
          </Field>
          <Field label="Category">
            <Input value={category} onChange={(e) => setCategory(e.target.value)}
                   placeholder="e.g. week-1, ballistics"
                   style={{ width: isMobile ? "100%" : 160 }} />
          </Field>
        </div>

        <Field label="Description (optional)">
          <Textarea value={desc} onChange={(e) => setDesc(e.target.value)}
                    placeholder="Brief summary of the material"
                    rows={2} />
        </Field>

        <Field label="File (PDF recommended)">
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.pptx,.ppt,.doc,.docx,.png,.jpg,.jpeg"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            style={{
              color: C.text,
              fontSize: 14,
              fontFamily: FONT_MONO,
              padding: "8px 0",
            }}
          />
          {file && (
            <div style={{ color: C.dim, fontSize: 12, marginTop: 4 }}>
              {file.name} — {(file.size / 1024).toFixed(0)} KB
            </div>
          )}
        </Field>

        <div style={{ marginTop: 8 }}>
          <Btn primary disabled={busy} fullWidth={isMobile}>
            {busy ? "Uploading…" : "Upload"}
          </Btn>
        </div>

        <ErrLine>{err}</ErrLine>
        <OkLine>{ok}</OkLine>
      </form>
    </Panel>
  );
}

/* ── Material row ── */
function MaterialRow({ material, canDelete, onView, onDeleted }) {
  const [confirmDel, setConfirmDel] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function handleDelete() {
    if (!confirmDel) { setConfirmDel(true); return; }
    setBusy(true);
    const { error } = await deleteMaterial(material);
    setBusy(false);
    if (error) { setErr(String(error.message || error)); return; }
    onDeleted?.();
  }

  const sizeLabel = material.file_size > 1024 * 1024
    ? `${(material.file_size / (1024 * 1024)).toFixed(1)} MB`
    : `${(material.file_size / 1024).toFixed(0)} KB`;

  return (
    <div style={{
      padding: "12px 4px",
      borderBottom: `1px solid ${C.border}`,
    }}>
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        gap: 10,
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <button
            type="button"
            onClick={onView}
            style={{
              all: "unset",
              color: C.bright,
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
              display: "block",
              marginBottom: 4,
            }}
          >
            📄 {material.title || material.file_name}
          </button>
          {material.description && (
            <div style={{ color: C.text, fontSize: 13, lineHeight: 1.4, marginBottom: 4 }}>
              {material.description}
            </div>
          )}
          <div style={{
            color: C.dimmer,
            fontSize: 11,
            fontFamily: FONT_MONO,
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
          }}>
            <Badge>{material.category.toUpperCase()}</Badge>
            <span>{sizeLabel}</span>
            <span>{new Date(material.created_at).toLocaleDateString()}</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, flexShrink: 0, alignItems: "flex-start" }}>
          <Btn small onClick={onView}>View</Btn>
          {canDelete && (
            <>
              <Btn
                small
                onClick={handleDelete}
                style={confirmDel ? { color: C.error, borderColor: C.error } : {}}
                disabled={busy}
              >
                {busy ? "…" : confirmDel ? "Confirm" : "Delete"}
              </Btn>
              {confirmDel && !busy && (
                <Btn small onClick={() => setConfirmDel(false)}>Cancel</Btn>
              )}
            </>
          )}
        </div>
      </div>
      <ErrLine>{err}</ErrLine>
    </div>
  );
}
