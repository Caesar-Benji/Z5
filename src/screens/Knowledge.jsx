import { useCallback, useEffect, useState, useRef, useMemo } from "react";
import { useAuth } from "../auth";
import { useI18n } from "../i18n";
import { Panel, PageHeader, Btn, Input, Textarea, Field, ErrLine, OkLine, Badge } from "../ui";
import { useIsMobile } from "../useIsMobile";
import { C, FONT_MONO, S } from "../theme";
import {
  listMaterials, listCategories, uploadMaterial,
  deleteMaterial, getMaterialUrl, subscribeKnowledge,
  SUBJECTS, SUBJECT_MAP, WEEKS,
} from "../data/knowledge";

function canUpload(role) {
  return role === "admin" || role === "officer" || role === "instructor";
}

// Subject icons for visual grouping
const SUBJECT_ICONS = {
  wind:               "🌬",
  shooting_technique: "🎯",
  physics:            "⚛",
  gear:               "🔧",
  camouflage:         "🌿",
  navigation:         "🧭",
  communication:      "📡",
  general:            "📋",
};

export default function Knowledge({ isBootcamp }) {
  const { profile } = useAuth();
  const { t } = useI18n();
  const isMobile = useIsMobile();
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [viewingUrl, setViewingUrl] = useState(null);
  const [viewingTitle, setViewingTitle] = useState("");
  const [viewingFileName, setViewingFileName] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await listMaterials();
    if (error) setErr(String(error.message || error));
    setMaterials(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const unsub = subscribeKnowledge(() => load());
    return unsub;
  }, [load]);

  const showUpload = canUpload(profile?.role);

  function openViewer(m) {
    setViewingUrl(getMaterialUrl(m.file_path));
    setViewingTitle(m.title || m.file_name);
    setViewingFileName(m.file_name || "");
  }

  // ── Document Viewer ──
  if (viewingUrl) {
    // Detect file type — use Google Docs Viewer for non-PDF files
    const ext = (viewingFileName.split(".").pop() || "").toLowerCase();
    const isPdf = ext === "pdf";
    const isImage = ["png", "jpg", "jpeg", "gif", "webp"].includes(ext);
    // Google Docs Viewer handles pptx, docx, xlsx etc.
    const embedUrl = isPdf || isImage
      ? viewingUrl
      : `https://docs.google.com/gview?url=${encodeURIComponent(viewingUrl)}&embedded=true`;

    return (
      <>
        <PageHeader title={<><span style={{ marginRight: 8 }}>📖</span>{viewingTitle}</>} />
        <Panel>
          {!isPdf && !isImage && (
            <div style={{ color: C.dim, fontSize: 12, marginBottom: 8, fontFamily: FONT_MONO }}>
              {t("kn.google_note")}
            </div>
          )}
          <div style={{
            width: "100%",
            height: isMobile ? "calc(100vh - 220px)" : "calc(100vh - 200px)",
            border: `1px solid ${C.border}`,
            borderRadius: 4,
            overflow: "hidden",
            background: "#111",
          }}>
            {isImage ? (
              <img
                src={viewingUrl}
                alt={viewingTitle}
                style={{ width: "100%", height: "100%", objectFit: "contain" }}
              />
            ) : (
              <iframe
                src={embedUrl}
                title={viewingTitle}
                style={{ width: "100%", height: "100%", border: "none" }}
                allow="autoplay"
              />
            )}
          </div>
          <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
            <Btn onClick={() => { setViewingUrl(null); setViewingTitle(""); setViewingFileName(""); }}>
              {t("kn.back")}
            </Btn>
            <Btn small onClick={() => window.open(viewingUrl, "_blank")}>
              {t("kn.download")}
            </Btn>
            {!isPdf && !isImage && (
              <Btn small onClick={() => window.open(embedUrl, "_blank")}>
                {t("kn.google_viewer")}
              </Btn>
            )}
          </div>
        </Panel>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={<><span style={{ marginRight: 8 }}>📖</span>{t("kn.title")}</>}
        subtitle={isBootcamp ? t("kn.sub_bootcamp") : t("kn.sub_normal")}
      />

      {showUpload && <UploadPanel onUploaded={load} />}

      {loading && (
        <Panel><div style={{ color: C.dim, fontSize: 13 }}>{t("kn.loading")}</div></Panel>
      )}
      {err && (
        <Panel><div style={{ color: C.error, fontSize: 13 }}>{err}</div></Panel>
      )}

      {!loading && materials.length === 0 && (
        <Panel>
          <div style={{ color: C.dim, fontSize: 13, padding: "4px 0" }}>
            {t("kn.empty")}
          </div>
        </Panel>
      )}

      {!loading && materials.length > 0 && (
        isBootcamp
          ? <WeeklyView materials={materials} profile={profile} onView={openViewer} onDeleted={load} />
          : <SubjectView materials={materials} profile={profile} onView={openViewer} onDeleted={load} />
      )}
    </>
  );
}

/* ═══════════════════════════════════════════════
   SUBJECT VIEW — regular users: grouped by subject
   ═══════════════════════════════════════════════ */
function SubjectView({ materials, profile, onView, onDeleted }) {
  const { t } = useI18n();
  const canDel = canUpload(profile?.role);

  // Group materials by category, preserving SUBJECTS order
  const groups = useMemo(() => {
    const map = {};
    for (const m of materials) {
      const cat = m.category || "general";
      if (!map[cat]) map[cat] = [];
      map[cat].push(m);
    }
    // Order by SUBJECTS list, then any remaining categories
    const ordered = [];
    for (const s of SUBJECTS) {
      if (map[s.key]) ordered.push({ key: s.key, label: t(`subj.${s.key}`) || s.label, items: map[s.key] });
    }
    for (const key of Object.keys(map)) {
      if (!SUBJECTS.find((s) => s.key === key)) {
        ordered.push({ key, label: t(`subj.${key}`) || key.toUpperCase(), items: map[key] });
      }
    }
    return ordered;
  }, [materials, t]);

  return (
    <>
      {groups.map((g) => (
        <Panel
          key={g.key}
          title={`${SUBJECT_ICONS[g.key] || "📋"}  ${g.label}`}
          action={<Badge>{g.items.length}</Badge>}
        >
          {g.items.map((m) => (
            <MaterialRow
              key={m.id}
              material={m}
              canDelete={canDel}
              showWeek
              onView={() => onView(m)}
              onDeleted={onDeleted}
            />
          ))}
        </Panel>
      ))}
    </>
  );
}

/* ═══════════════════════════════════════════════
   WEEKLY VIEW — boot camp: grouped by week 1-4,
   with subjects within each week
   ═══════════════════════════════════════════════ */
function WeeklyView({ materials, profile, onView, onDeleted }) {
  const { t } = useI18n();
  const canDel = canUpload(profile?.role);

  const weekGroups = useMemo(() => {
    const result = [];
    for (const w of WEEKS) {
      const weekMats = materials.filter((m) => m.week === w);
      // Sub-group by subject within the week
      const subjectMap = {};
      for (const m of weekMats) {
        const cat = m.category || "general";
        if (!subjectMap[cat]) subjectMap[cat] = [];
        subjectMap[cat].push(m);
      }
      const subjects = [];
      for (const s of SUBJECTS) {
        if (subjectMap[s.key]) subjects.push({ key: s.key, label: t(`subj.${s.key}`) || s.label, items: subjectMap[s.key] });
      }
      for (const key of Object.keys(subjectMap)) {
        if (!SUBJECTS.find((s) => s.key === key)) {
          subjects.push({ key, label: t(`subj.${key}`) || key.toUpperCase(), items: subjectMap[key] });
        }
      }
      result.push({ week: w, subjects, total: weekMats.length });
    }
    // Also collect unassigned materials (week = null)
    const unassigned = materials.filter((m) => !m.week);
    return { weeks: result, unassigned };
  }, [materials]);

  return (
    <>
      {weekGroups.weeks.map((wg) => (
        <Panel
          key={wg.week}
          title={t("kn.week", { n: wg.week })}
          action={<Badge>{wg.total} {wg.total === 1 ? t("kn.material") : t("kn.materials")}</Badge>}
        >
          {wg.total === 0 && (
            <div style={{ color: C.dim, fontSize: 13, padding: "4px 0" }}>
              {t("kn.week_empty")}
            </div>
          )}
          {wg.subjects.map((sg) => (
            <div key={sg.key} style={{ marginBottom: 16 }}>
              <div style={{
                color: C.dim,
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: "0.8px",
                textTransform: "uppercase",
                marginBottom: 8,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}>
                <span>{SUBJECT_ICONS[sg.key] || "📋"}</span>
                <span>{sg.label}</span>
                <Badge>{sg.items.length}</Badge>
              </div>
              {sg.items.map((m) => (
                <MaterialRow
                  key={m.id}
                  material={m}
                  canDelete={canDel}
                  showWeek={false}
                  onView={() => onView(m)}
                  onDeleted={onDeleted}
                />
              ))}
            </div>
          ))}
        </Panel>
      ))}

      {weekGroups.unassigned.length > 0 && (
        <Panel
          title={t("kn.general")}
          action={<Badge>{weekGroups.unassigned.length}</Badge>}
        >
          {weekGroups.unassigned.map((m) => (
            <MaterialRow
              key={m.id}
              material={m}
              canDelete={canDel}
              showWeek={false}
              onView={() => onView(m)}
              onDeleted={onDeleted}
            />
          ))}
        </Panel>
      )}
    </>
  );
}

/* ═══════════════════════════════════════════════
   UPLOAD PANEL
   ═══════════════════════════════════════════════ */
function UploadPanel({ onUploaded }) {
  const { t } = useI18n();
  const isMobile = useIsMobile();
  const fileRef = useRef(null);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [category, setCategory] = useState("general");
  const [week, setWeek] = useState("");
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  async function handleUpload(e) {
    e.preventDefault();
    if (!file) { setErr(t("kn.no_file")); return; }
    if (!title.trim()) { setErr(t("kn.no_title")); return; }
    setBusy(true); setErr(""); setOk("");
    const { error } = await uploadMaterial({
      file,
      title: title.trim(),
      description: desc.trim(),
      category,
      week: week ? parseInt(week, 10) : null,
    });
    setBusy(false);
    if (error) { setErr(String(error.message || error)); return; }
    setOk(`"${title.trim()}" uploaded.`);
    setTitle(""); setDesc(""); setFile(null); setWeek("");
    if (fileRef.current) fileRef.current.value = "";
    onUploaded?.();
  }

  return (
    <Panel title={t("kn.upload_title")}>
      <form onSubmit={handleUpload}>
        <div style={{
          display: "flex",
          gap: 12,
          flexWrap: "wrap",
          flexDirection: isMobile ? "column" : "row",
          alignItems: isMobile ? "stretch" : "flex-end",
        }}>
          <Field label={t("kn.title_label")}>
            <Input value={title} onChange={(e) => setTitle(e.target.value)}
                   placeholder={t("kn.title_ph")} style={{ width: isMobile ? "100%" : 220 }} />
          </Field>
          <Field label={t("kn.subject")}>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              style={{
                ...S.input,
                width: isMobile ? "100%" : 200,
                fontSize: isMobile ? 16 : S.input.fontSize,
                minHeight: isMobile ? 46 : undefined,
              }}
            >
              {SUBJECTS.map((s) => (
                <option key={s.key} value={s.key}>
                  {SUBJECT_ICONS[s.key] || ""} {t(`subj.${s.key}`) || s.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("kn.week_label")}>
            <select
              value={week}
              onChange={(e) => setWeek(e.target.value)}
              style={{
                ...S.input,
                width: isMobile ? "100%" : 160,
                fontSize: isMobile ? 16 : S.input.fontSize,
                minHeight: isMobile ? 46 : undefined,
              }}
            >
              <option value="">{t("kn.week_none")}</option>
              {WEEKS.map((w) => (
                <option key={w} value={w}>{t("kn.week_n", { n: w })}</option>
              ))}
            </select>
          </Field>
        </div>

        <Field label={t("kn.desc")}>
          <Textarea value={desc} onChange={(e) => setDesc(e.target.value)}
                    placeholder={t("kn.desc_ph")}
                    rows={2} />
        </Field>

        <Field label={t("kn.file")}>
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
            {busy ? t("kn.uploading") : t("kn.upload")}
          </Btn>
        </div>

        <ErrLine>{err}</ErrLine>
        <OkLine>{ok}</OkLine>
      </form>
    </Panel>
  );
}

/* ═══════════════════════════════════════════════
   MATERIAL ROW
   ═══════════════════════════════════════════════ */
function MaterialRow({ material, canDelete, showWeek, onView, onDeleted }) {
  const { t } = useI18n();
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

  const subjectLabel = t(`subj.${material.category}`) || SUBJECT_MAP[material.category] || material.category;

  return (
    <div style={{
      padding: "10px 4px",
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
            gap: 8,
            flexWrap: "wrap",
            alignItems: "center",
          }}>
            <Badge>{subjectLabel.toUpperCase()}</Badge>
            {showWeek && material.week && <Badge tone="warn">{t("kn.week", { n: material.week })}</Badge>}
            <span>{sizeLabel}</span>
            <span>{new Date(material.created_at).toLocaleDateString()}</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, flexShrink: 0, alignItems: "flex-start" }}>
          <Btn small onClick={onView}>{t("kn.view")}</Btn>
          {canDelete && (
            <>
              <Btn
                small
                onClick={handleDelete}
                style={confirmDel ? { color: C.error, borderColor: C.error } : {}}
                disabled={busy}
              >
                {busy ? "…" : confirmDel ? t("kn.confirm") : t("kn.delete")}
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
