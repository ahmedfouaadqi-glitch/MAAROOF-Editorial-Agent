import { useEffect, useState } from "react";
import { FilePenLine, Save, WandSparkles, Share2, Video, Image as ImageIcon, Upload, Trash2 } from "lucide-react";
import EditorialGeoPanel from "./EditorialGeoPanel";

type Section = { id: string; heading: string; brief: string; body: string; evidenceIds?: string[]; claimIds?: string[] };
type Draft = {
  id: string; title?: string; dek?: string; metaTitle?: string; metaDescription?: string;
  editorialAngle: string; sections: Section[]; status: string; generationMode: string; updatedAt?: string;
  generatedBy?: { provider: string; model: string };
  modelUsage?: { promptTokens: number | null; completionTokens: number | null; totalTokens: number | null };
};
type MediaAsset = {
  id: string; kind: "image" | "video"; mimeType: string; sizeBytes: number;
  originalName: string; description: string; altText: string; caption: string; createdAt: string;
};
type PlatformVariant = {
  id: string; createdAt: string; platformId: string; platformName: string; language: string; format: string;
  title: string; hook: string; body: string; callToAction: string; hashtags: string[]; selectedMediaIds: string[];
  videoScript: string; onScreenText: string; shotPlan: string; mediaBrief: string;
  accessibilityNotes: string; status: string; reviewRequired: boolean; limitations: string[];
};

const SOCIAL_PLATFORMS = [
  { id: "linkedin", name: "LinkedIn" }, { id: "facebook", name: "Facebook Pages" },
  { id: "instagram", name: "Instagram" }, { id: "x", name: "X" },
  { id: "threads", name: "Threads" }, { id: "tiktok", name: "TikTok" },
  { id: "youtube", name: "YouTube" }, { id: "pinterest", name: "Pinterest" }
];
const MEDIA_ACCEPT = "image/jpeg,image/png,image/webp,video/mp4,video/webm";

function formatBytes(value: number) {
  return value >= 1024 * 1024 ? `${(value / (1024 * 1024)).toFixed(1)} MiB` : `${Math.max(1, Math.round(value / 1024))} KiB`;
}

function ProtectedMediaPreview({ apiBase, token, workspaceId, taskId, asset, locale }: {
  apiBase: string; token: string; workspaceId: string; taskId: string; asset: MediaAsset; locale: "ar" | "en";
}) {
  const [url, setUrl] = useState("");
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!show) { setUrl(""); return; }
    let active = true;
    let objectUrl = "";
    fetch(`${apiBase}/api/v1/workspaces/${encodeURIComponent(workspaceId)}/tasks/${encodeURIComponent(taskId)}/media/${encodeURIComponent(asset.id)}/file`, {
      headers: { authorization: `Bearer ${token}` }
    }).then(response => {
      if (!response.ok) throw new Error("Preview unavailable");
      return response.blob();
    }).then(blob => {
      objectUrl = URL.createObjectURL(blob);
      if (active) setUrl(objectUrl);
      else URL.revokeObjectURL(objectUrl);
    }).catch(() => { if (active) setUrl(""); });
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [apiBase, token, workspaceId, taskId, asset.id, show]);
  return <div>
    <button className="secondary-button" style={{ marginTop: 6 }} onClick={() => setShow(value => !value)}>{show ? (locale === "ar" ? "إخفاء المعاينة" : "Hide preview") : (locale === "ar" ? "معاينة الملف" : "Preview file")}</button>
    {show && !url && <div className="form-note">{locale === "ar" ? "جارٍ تحميل المعاينة أو تعذّر عرضها." : "Loading preview or preview unavailable."}</div>}
    {show && url && (asset.kind === "image"
      ? <img src={url} alt={asset.altText || asset.description} style={{ display: "block", maxWidth: 220, maxHeight: 150, objectFit: "contain", borderRadius: 8, marginTop: 8 }}/>
      : <video src={url} controls preload="metadata" style={{ display: "block", maxWidth: 280, maxHeight: 170, borderRadius: 8, marginTop: 8 }} />)}
  </div>;
}

export default function EditorialDraftPanel({ apiBase, token, workspaceId, taskId, stage, locale }: {
  apiBase: string; token: string; workspaceId: string; taskId: string; stage: string; locale: "ar" | "en";
}) {
  const ar = locale === "ar";
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [variantBusy, setVariantBusy] = useState(false);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [platform, setPlatform] = useState("linkedin");
  const [placement, setPlacement] = useState("");
  const [variants, setVariants] = useState<PlatformVariant[]>([]);
  const [selectedVariantId, setSelectedVariantId] = useState("");
  const [mediaAssets, setMediaAssets] = useState<MediaAsset[]>([]);
  const [mediaDescription, setMediaDescription] = useState("");
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [selectedMediaIds, setSelectedMediaIds] = useState<string[]>([]);

  async function request(method: "GET" | "POST" | "PUT", body?: unknown) {
    const response = await fetch(`${apiBase}/api/v1/workspaces/${encodeURIComponent(workspaceId)}/tasks/${encodeURIComponent(taskId)}/draft`, {
      method, headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      ...(body ? { body: JSON.stringify(body) } : {})
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Request failed");
    return payload.draft as Draft | null;
  }

  async function requestVariants(method: "GET" | "POST", body?: unknown) {
    const response = await fetch(`${apiBase}/api/v1/workspaces/${encodeURIComponent(workspaceId)}/tasks/${encodeURIComponent(taskId)}/platform-variants`, {
      method, headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      ...(body ? { body: JSON.stringify(body) } : {})
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Request failed");
    return payload as { variants?: PlatformVariant[]; variant?: PlatformVariant; publishingEnabled?: boolean };
  }

  async function loadMedia() {
    const response = await fetch(`${apiBase}/api/v1/workspaces/${encodeURIComponent(workspaceId)}/tasks/${encodeURIComponent(taskId)}/media`, {
      headers: { authorization: `Bearer ${token}` }
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Media list request failed");
    return payload.assets as MediaAsset[];
  }

  useEffect(() => {
    let active = true;
    if (!token.trim()) return;
    Promise.all([request("GET"), requestVariants("GET"), loadMedia()])
      .then(([value, variantPayload, assets]) => {
        if (!active) return;
        setDraft(value);
        setVariants(variantPayload.variants || []);
        setMediaAssets(assets);
      })
      .catch(error => { if (active) setNotice(error instanceof Error ? error.message : "Error"); });
    return () => { active = false; };
  }, [apiBase, token, workspaceId, taskId]);

  async function generateOutline() {
    setBusy(true); setNotice("");
    try {
      setDraft(await request("POST", { angle: "", audience: "" }));
      setNotice(ar ? "أُنشئ مخطط هيكلي. ليس مقالاً مولداً بالذكاء الاصطناعي." : "A structural outline was created. This is not AI-generated article content.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Error"); }
    finally { setBusy(false); }
  }

  async function saveDraft() {
    if (!draft) return;
    setBusy(true); setNotice("");
    try {
      setDraft(await request("PUT", draft));
      setNotice(ar ? "تم حفظ تعديلات المحرر." : "Editorial changes saved.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Error"); }
    finally { setBusy(false); }
  }

  async function uploadMedia() {
    if (!pendingFile || mediaDescription.trim().length < 3) return;
    setUploadBusy(true); setNotice("");
    try {
      const response = await fetch(`${apiBase}/api/v1/workspaces/${encodeURIComponent(workspaceId)}/tasks/${encodeURIComponent(taskId)}/media`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": pendingFile.type,
          "x-file-name": encodeURIComponent(pendingFile.name),
          "x-media-description": encodeURIComponent(mediaDescription.trim())
        },
        body: pendingFile
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Upload failed");
      const asset = payload.asset as MediaAsset;
      setMediaAssets(current => [asset, ...current]);
      setSelectedMediaIds(current => [...new Set([...current, asset.id])]);
      setPendingFile(null);
      setMediaDescription("");
      setNotice(ar ? "تم رفع الوسيط وربطه بهذه المقالة." : "Media uploaded and attached to this article.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Upload failed"); }
    finally { setUploadBusy(false); }
  }

  async function removeMedia(asset: MediaAsset) {
    if (!window.confirm(ar ? "حذف هذا الملف نهائياً؟" : "Permanently delete this file?")) return;
    setNotice("");
    try {
      const response = await fetch(`${apiBase}/api/v1/workspaces/${encodeURIComponent(workspaceId)}/tasks/${encodeURIComponent(taskId)}/media/${encodeURIComponent(asset.id)}`, {
        method: "DELETE", headers: { authorization: `Bearer ${token}` }
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Delete failed");
      setMediaAssets(current => current.filter(item => item.id !== asset.id));
      setSelectedMediaIds(current => current.filter(id => id !== asset.id));
      setNotice(ar ? "تم حذف الملف." : "Media deleted.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Delete failed"); }
  }

  async function generatePlatformDraft() {
    setVariantBusy(true); setNotice("");
    try {
      const result = await requestVariants("POST", { platformId: platform, placement, mediaAssetIds: selectedMediaIds });
      if (!result.variant) throw new Error(ar ? "لم تُستلم مسودة من الخدمة." : "The service returned no platform draft.");
      setVariants(current => [result.variant!, ...current]);
      setSelectedVariantId(result.variant.id);
      setNotice(ar ? "أُنشئت مسودة المنصة. لم يتم نشرها." : "Platform draft created. Nothing was published.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Error"); }
    finally { setVariantBusy(false); }
  }

  const selectedVariant = variants.find(item => item.id === selectedVariantId) || variants[0];

  return <section className="surface-card create-card" style={{ marginTop: 16 }}>
    <div className="section-heading"><div><span className="tiny-overline">EDITORIAL DRAFT</span><h2>{ar ? "مخطط ومسودة المقال" : "Article outline & draft"}</h2></div><FilePenLine size={18}/></div>
    {!draft ? <>
      <p className="muted">{ar ? "لا يوجد مخطط بعد. أنشئ هيكلاً تحريرياً منظماً للمقالة." : "No outline yet. Create a structured editorial scaffold."}</p>
      <button className="primary-button" disabled={busy || !token.trim()} onClick={generateOutline}><WandSparkles size={15}/>{ar ? "إنشاء المخطط" : "Create outline"}</button>
    </> : <>
      <label className="budget-field"><span>{ar ? "عنوان المقال" : "Article title"}</span><input value={draft.title || ""} onChange={event => setDraft({ ...draft, title: event.target.value })}/></label>
      <label className="budget-field"><span>{ar ? "زاوية المعالجة" : "Editorial angle"}</span><textarea value={draft.editorialAngle || ""} onChange={event => setDraft({ ...draft, editorialAngle: event.target.value })}/></label>
      {draft.sections.map((section, index) => <div key={section.id} style={{ display: "grid", gap: 8, marginTop: 14 }}>
        <label className="budget-field"><span>{ar ? "عنوان القسم" : "Section heading"} {index + 1}</span><input value={section.heading} onChange={event => setDraft({ ...draft, sections: draft.sections.map(item => item.id === section.id ? { ...item, heading: event.target.value } : item) })}/></label>
        <p className="muted">{section.brief}</p>
        <textarea rows={5} value={section.body} placeholder={ar ? "أدخل نصاً محرراً ومدعوماً بالمصادر..." : "Enter human-edited, source-supported copy..."} onChange={event => setDraft({ ...draft, sections: draft.sections.map(item => item.id === section.id ? { ...item, body: event.target.value } : item) })}/>
        {(section.evidenceIds?.length || section.claimIds?.length) ? <p className="form-note">{ar ? "الأدلة المرتبطة: " : "Linked evidence: "}{(section.evidenceIds || []).join(", ")} · {ar ? "الادعاءات: " : "Claims: "}{(section.claimIds || []).join(", ")}</p> : null}
      </div>)}
      <div className="form-pair"><label className="budget-field"><span>Meta title</span><input value={draft.metaTitle || ""} onChange={event => setDraft({ ...draft, metaTitle: event.target.value })}/></label><label className="budget-field"><span>Meta description</span><input value={draft.metaDescription || ""} onChange={event => setDraft({ ...draft, metaDescription: event.target.value })}/></label></div>
      <div className="form-pair">
        <button className="secondary-button" disabled title={ar ? "ميزة توليد المقال الكامل بالنموذج غير مفعلة حالياً" : "Full article model generation is not enabled"}><WandSparkles size={15}/>{ar ? "توليد المقال الكامل — غير مفعّل" : "Full article generation — not enabled"}</button>
        <button className="primary-button" disabled={busy} onClick={saveDraft}><Save size={15}/>{ar ? "حفظ المسودة" : "Save draft"}</button>
      </div>
      <p className="form-note">{ar ? "لا يوجد اتصال بـMAAROOF AI. تكييف المحتوى الاجتماعي يحتاج مزود نموذج مستقلاً ومفعّلاً من إعدادات الخادم." : "No MAAROOF AI connection. Social adaptation requires a separate model provider explicitly enabled in server settings."}</p>

      <EditorialGeoPanel apiBase={apiBase} token={token} workspaceId={workspaceId} taskId={taskId} locale={locale} sections={draft.sections} draftUpdatedAt={draft.updatedAt}/>

      <div className="surface-card" style={{ marginTop: 18, padding: 16 }}>
        <div className="section-heading"><div><span className="tiny-overline">MEDIA LIBRARY · THIS ARTICLE</span><h2>{ar ? "الصور والفيديو" : "Images and video"}</h2><p className="muted">{ar ? "ارفع ملفاتك وأضف وصفاً يوضح محتواها؛ ستُستخدم الأوصاف فقط لاختيار الوسيط الأنسب." : "Upload files and describe their content; descriptions only are used to select relevant media."}</p></div><ImageIcon size={18}/></div>
        <div className="form-pair" style={{ marginTop: 14 }}>
          <label className="budget-field"><span>{ar ? "اختر صورة أو فيديو" : "Choose image or video"}</span><input type="file" accept={MEDIA_ACCEPT} onChange={event => setPendingFile(event.target.files?.[0] || null)}/></label>
          <label className="budget-field"><span>{ar ? "وصف المحتوى / النص البديل" : "Content description / alt text"}</span><input value={mediaDescription} onChange={event => setMediaDescription(event.target.value)} maxLength={800} placeholder={ar ? "مثال: صورة ألواح شمسية على سطح مدرسة" : "e.g. Solar panels on a school rooftop"}/></label>
        </div>
        {pendingFile && <div className="form-note">{pendingFile.name} · {formatBytes(pendingFile.size)} · {pendingFile.type}</div>}
        <button className="primary-button" disabled={uploadBusy || !pendingFile || mediaDescription.trim().length < 3} onClick={uploadMedia}><Upload size={15}/>{uploadBusy ? (ar ? "جارٍ الرفع..." : "Uploading...") : (ar ? "رفع وإرفاق" : "Upload and attach")}</button>
        <p className="form-note">{ar ? "JPEG/PNG/WebP حتى 15 MiB؛ MP4/WebM حتى 100 MiB. تُحفظ الملفات محلياً في الخادم ولا تُرسل إلى نموذج الذكاء الاصطناعي." : "JPEG/PNG/WebP up to 15 MiB; MP4/WebM up to 100 MiB. Files are stored locally and are not sent to the model."}</p>
        {mediaAssets.length > 0 ? <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
          {mediaAssets.map(asset => <div key={asset.id} className="surface-card" style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", alignItems: "start", gap: 10, padding: 12 }}>
            <input type="checkbox" aria-label={ar ? `استخدام ${asset.originalName}` : `Use ${asset.originalName}`} checked={selectedMediaIds.includes(asset.id)} onChange={event => setSelectedMediaIds(current => event.target.checked ? [...new Set([...current, asset.id])] : current.filter(id => id !== asset.id))}/>
            <div><strong>{asset.originalName}</strong><p className="muted">{asset.kind === "image" ? (ar ? "صورة" : "Image") : (ar ? "فيديو" : "Video")} · {formatBytes(asset.sizeBytes)} · {asset.description}</p><ProtectedMediaPreview apiBase={apiBase} token={token} workspaceId={workspaceId} taskId={taskId} asset={asset} locale={locale}/></div>
            <button className="top-icon" onClick={() => removeMedia(asset)} title={ar ? "حذف الملف" : "Delete media"}><Trash2 size={15}/></button>
          </div>)}
        </div> : <p className="muted" style={{ marginTop: 12 }}>{ar ? "لا توجد ملفات مرفوعة لهذه المقالة." : "No files uploaded for this article."}</p>}
      </div>

      <div className="surface-card" style={{ marginTop: 18, padding: 16 }}>
        <div className="section-heading"><div><span className="tiny-overline">PLATFORM-NATIVE DRAFTS</span><h2>{ar ? "صياغة خاصة بكل منصة" : "Platform-native copy"}</h2><p className="muted">{ar ? "أنشئ نسخة تحريرية مستقلة من المقال. يبقى النشر معطلاً." : "Create a distinct editorial adaptation from the article. Publishing stays disabled."}</p></div><Share2 size={18}/></div>
        <div className="form-pair" style={{ marginTop: 14 }}>
          <label className="budget-field"><span>{ar ? "المنصة" : "Platform"}</span><select value={platform} onChange={event => setPlatform(event.target.value)}>{SOCIAL_PLATFORMS.map(item => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>
          <label className="budget-field"><span>{ar ? "موضع النشر المقصود (اختياري)" : "Intended placement (optional)"}</span><input value={placement} onChange={event => setPlacement(event.target.value)} placeholder={ar ? "مثال: منشور، Reel، فيديو قصير" : "e.g. feed post, Reel, Short"}/></label>
        </div>
        <button className="primary-button" disabled={variantBusy || !token.trim() || !draft.sections.some(section => section.body.trim())} onClick={generatePlatformDraft}>
          <WandSparkles size={15}/>{variantBusy ? (ar ? "جارٍ إعداد المسودة..." : "Preparing draft...") : (ar ? "إنشاء مسودة للمنصة" : "Create platform draft")}
        </button>
        <p className="form-note">{ar ? "يتطلب ذلك إعداد PLATFORM_CONTENT_GENERATION_ENABLED=true ومزوداً مستقلاً. لا يُرسل الملف نفسه إلى النموذج؛ يعتمد الاختيار على الوصف. هذا لا يفعّل MAAROOF AI أو النشر." : "Requires PLATFORM_CONTENT_GENERATION_ENABLED=true and a separate provider. Files are not sent to the model; selection uses descriptions only. This does not enable MAAROOF AI or publishing."}</p>
        {variants.length > 0 && <label className="budget-field" style={{ marginTop: 14 }}><span>{ar ? "المسودات المحفوظة" : "Saved platform drafts"}</span><select value={selectedVariant?.id || ""} onChange={event => setSelectedVariantId(event.target.value)}>{variants.map(item => <option value={item.id} key={item.id}>{item.platformName} · {new Date(item.createdAt).toLocaleString(ar ? "ar-IQ" : "en-US")}</option>)}</select></label>}
        {selectedVariant && <div className="surface-card" style={{ marginTop: 12, padding: 14 }}>
          <div className="section-heading"><div><span className="tiny-overline">{selectedVariant.platformName} · {selectedVariant.format}</span><h3>{selectedVariant.title || selectedVariant.hook}</h3></div><span className="status-chip">{ar ? "مسودة فقط" : "Draft only"}</span></div>
          {selectedVariant.title && <p className="muted">{selectedVariant.hook}</p>}
          <p style={{ whiteSpace: "pre-wrap", lineHeight: 1.9 }}>{selectedVariant.body}</p>
          {selectedVariant.callToAction && <p><strong>{ar ? "دعوة للتفاعل: " : "CTA: "}</strong>{selectedVariant.callToAction}</p>}
          {selectedVariant.hashtags.length > 0 && <p className="form-note">{selectedVariant.hashtags.map(tag => `#${tag}`).join(" ")}</p>}
          {selectedVariant.selectedMediaIds.length > 0 && <p className="form-note"><ImageIcon size={14}/>{ar ? "الوسائط المختارة حسب الوصف: " : "Selected from descriptions: "}{selectedVariant.selectedMediaIds.map(id => mediaAssets.find(asset => asset.id === id)?.originalName || id).join("، ")}</p>}
          {selectedVariant.videoScript && <div className="form-note"><Video size={14}/><strong>{ar ? "نص الفيديو" : "Video script"}</strong><p style={{ whiteSpace: "pre-wrap" }}>{selectedVariant.videoScript}</p></div>}
          {selectedVariant.onScreenText && <p className="form-note">{ar ? "نص ظاهر على الشاشة: " : "On-screen text: "}{selectedVariant.onScreenText}</p>}
          {selectedVariant.shotPlan && <p className="form-note">{ar ? "تخطيط اللقطات: " : "Shot plan: "}{selectedVariant.shotPlan}</p>}
          {selectedVariant.mediaBrief && <p className="form-note"><ImageIcon size={14}/>{ar ? "توجيه الوسائط: " : "Media brief: "}{selectedVariant.mediaBrief}</p>}
          {selectedVariant.accessibilityNotes && <p className="form-note">{ar ? "إتاحة الوصول: " : "Accessibility: "}{selectedVariant.accessibilityNotes}</p>}
          <p className="form-note">{ar ? "المسودة تحتاج مراجعة بشرية. لم يتم النشر." : "Human review is required. Nothing was published."}</p>
        </div>}
      </div>
      {stage === "ready-to-publish" && <p className="form-note">{ar ? "تم إعداد المقال للمراجعة؛ لا يعني ذلك أن أي منشور اجتماعي نُشر." : "The article is ready for review; this does not mean any social post was published."}</p>}
    </>}
    {notice && <p className="inline-feedback">{notice}</p>}
  </section>;
}
