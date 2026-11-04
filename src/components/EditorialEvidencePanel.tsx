import { useEffect, useState, type FormEvent } from "react";
import { FileCheck2, Link2, Plus, ScanSearch, ShieldAlert } from "lucide-react";
import EditorialEntityPanel from "./EditorialEntityPanel";

type Source = { id: string; url: string; title: string; notes: string; registeredAt: string; fetched: false };
type Claim = { id: string; text: string; sourceIds: string[]; evidenceState: string; createdAt: string };
type Props = { apiBase: string; token: string; workspaceId: string; article: { id: string; topic: string }; locale: "ar" | "en" };

export default function EditorialEvidencePanel({ apiBase, token, workspaceId, article, locale }: Props) {
  const ar = locale === "ar";
  const [sources, setSources] = useState<Source[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [summary, setSummary] = useState({ total: 0, sourceLinked: 0, unlinked: 0, coveragePercent: 0 });
  const [url, setUrl] = useState("");
  const [sourceTitle, setSourceTitle] = useState("");
  const [sourceNotes, setSourceNotes] = useState("");
  const [claimText, setClaimText] = useState("");
  const [sourceId, setSourceId] = useState("");
  const [originalityText, setOriginalityText] = useState("");
  const [originality, setOriginality] = useState<Record<string, unknown> | null>(null);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  async function request(path: string, init: RequestInit = {}) {
    const response = await fetch(apiBase + path, {
      ...init,
      headers: { authorization: `Bearer ${token}`, ...(init.body ? { "content-type": "application/json" } : {}), ...init.headers }
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Request failed");
    return payload;
  }

  async function refresh() {
    if (!token.trim()) return;
    const [sourcePayload, claimPayload] = await Promise.all([
      request(`/api/v1/workspaces/${encodeURIComponent(workspaceId)}/tasks/${encodeURIComponent(article.id)}/sources`),
      request(`/api/v1/workspaces/${encodeURIComponent(workspaceId)}/tasks/${encodeURIComponent(article.id)}/claims`)
    ]);
    setSources(sourcePayload.sources || []);
    setClaims(claimPayload.claims || []);
    setSummary(claimPayload.summary || { total: 0, sourceLinked: 0, unlinked: 0, coveragePercent: 0 });
  }

  useEffect(() => {
    let active = true;
    if (!token.trim()) return;
    Promise.all([
      request(`/api/v1/workspaces/${encodeURIComponent(workspaceId)}/tasks/${encodeURIComponent(article.id)}/sources`),
      request(`/api/v1/workspaces/${encodeURIComponent(workspaceId)}/tasks/${encodeURIComponent(article.id)}/claims`)
    ]).then(([sourcePayload, claimPayload]) => {
      if (!active) return;
      setSources(sourcePayload.sources || []);
      setClaims(claimPayload.claims || []);
      setSummary(claimPayload.summary || { total: 0, sourceLinked: 0, unlinked: 0, coveragePercent: 0 });
    }).catch(error => { if (active) setNotice(error instanceof Error ? error.message : "Unable to load evidence"); });
    return () => { active = false; };
  }, [apiBase, token, workspaceId, article.id]);

  async function addSource(event: FormEvent) {
    event.preventDefault();
    setBusy(true); setNotice("");
    try {
      await request("/api/v1/sources", { method: "POST", body: JSON.stringify({ workspaceId, taskId: article.id, url, title: sourceTitle, notes: sourceNotes }) });
      setUrl(""); setSourceTitle(""); setSourceNotes("");
      await refresh();
      setNotice(ar ? "تم تسجيل المرجع. لم يتم جلب محتواه." : "Reference registered. Its content was not fetched.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Unable to register source"); }
    finally { setBusy(false); }
  }

  async function addClaim(event: FormEvent) {
    event.preventDefault();
    setBusy(true); setNotice("");
    try {
      await request("/api/v1/claims", { method: "POST", body: JSON.stringify({ workspaceId, taskId: article.id, text: claimText, sourceIds: sourceId ? [sourceId] : [] }) });
      setClaimText(""); setSourceId("");
      await refresh();
      setNotice(ar ? "تم حفظ الادعاء التحريري." : "Editorial claim saved.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Unable to save claim"); }
    finally { setBusy(false); }
  }

  async function runOriginality(event: FormEvent) {
    event.preventDefault();
    setBusy(true); setNotice(""); setOriginality(null);
    try {
      const payload = await request("/api/v1/originality/check", { method: "POST", body: JSON.stringify({ workspaceId, taskId: article.id, text: originalityText }) });
      setOriginality(payload.result);
    } catch (error) { setNotice(error instanceof Error ? error.message : "Unable to check originality"); }
    finally { setBusy(false); }
  }

  return <section className="surface-card evidence-panel">
    <div className="section-heading"><div><span className="tiny-overline">EDITORIAL EVIDENCE</span><h2>{ar ? "ملف الأدلة والادعاءات" : "Evidence & claims workspace"}</h2><p>{article.topic}</p></div><span className="count-badge">{sources.length} {ar ? "مصادر" : "sources"}</span></div>
    {!token.trim() ? <p className="evidence-notice"><ShieldAlert size={15}/>{ar ? "أدخل مفتاح الإدارة لتحميل ملف الأدلة." : "Enter the admin token to load the evidence workspace."}</p> : <>
      <div className="evidence-summary"><div><b>{summary.total}</b><span>{ar ? "إجمالي الادعاءات" : "Claims"}</span></div><div><b>{summary.sourceLinked}</b><span>{ar ? "مرتبطة بمصدر" : "Source linked"}</span></div><div><b>{summary.coveragePercent}%</b><span>{ar ? "تغطية الإسناد" : "Link coverage"}</span></div></div>
      <div className="evidence-grid">
        <form className="evidence-form" onSubmit={addSource}>
          <h3><Link2 size={15}/>{ar ? "تسجيل مصدر يدوي" : "Register a source"}</h3>
          <input type="url" required value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://..." />
          <input value={sourceTitle} onChange={e=>setSourceTitle(e.target.value)} placeholder={ar ? "عنوان المصدر" : "Source title"} />
          <textarea value={sourceNotes} onChange={e=>setSourceNotes(e.target.value)} rows={2} placeholder={ar ? "ملاحظات ومكان المعلومة" : "Notes and relevant location"} />
          <button className="secondary-button" disabled={busy}><Plus size={14}/>{ar ? "إضافة المصدر" : "Add source"}</button>
        </form>
        <form className="evidence-form" onSubmit={addClaim}>
          <h3><FileCheck2 size={15}/>{ar ? "إضافة ادعاء تحريري" : "Add an editorial claim"}</h3>
          <textarea required minLength={8} value={claimText} onChange={e=>setClaimText(e.target.value)} rows={3} placeholder={ar ? "اكتب حقيقة أو ادعاء يحتاج إلى إسناد..." : "Write a factual claim that needs sourcing..."} />
          <select value={sourceId} onChange={e=>setSourceId(e.target.value)}><option value="">{ar ? "دون ربط بمصدر" : "No source linked"}</option>{sources.map(source=><option key={source.id} value={source.id}>{source.title || source.url}</option>)}</select>
          <button className="secondary-button" disabled={busy}><Plus size={14}/>{ar ? "حفظ الادعاء" : "Save claim"}</button>
        </form>
      </div>
      <div className="evidence-records">
        <h3>{ar ? "المصادر المسجلة" : "Registered sources"}</h3>
        {sources.length ? sources.map(source=><div className="evidence-record" key={source.id}><b>{source.title || source.url}</b><a href={source.url} target="_blank" rel="noreferrer">{source.url}</a><small>{ar ? "مرجع يدوي — غير مفحوص" : "Manual reference — not inspected"}</small></div>) : <p className="muted">{ar ? "لا توجد مصادر مسجلة." : "No sources registered."}</p>}
        <h3>{ar ? "الادعاءات" : "Claims"}</h3>
        {claims.length ? claims.map(claim=><div className="evidence-record" key={claim.id}><b>{claim.text}</b><small>{claim.sourceIds.length ? (ar ? "مرتبط بمصدر، لم يتم التحقق منه" : "Source linked, not verified") : (ar ? "بلا مصدر مرتبط" : "No source linked")}</small></div>) : <p className="muted">{ar ? "لم تتم إضافة ادعاءات بعد." : "No claims added yet."}</p>}
      </div>
      <form className="evidence-form originality-form" onSubmit={runOriginality}>
        <h3><ScanSearch size={15}/>{ar ? "فحص التكرار المحلي" : "Local originality check"}</h3>
        <textarea required minLength={30} value={originalityText} onChange={e=>setOriginalityText(e.target.value)} rows={4} placeholder={ar ? "الصق النص المراد فحصه..." : "Paste text to check..."} />
        <button className="secondary-button" disabled={busy}>{ar ? "فحص النص" : "Check text"}</button>
        {originality && <pre className="originality-result">{JSON.stringify(originality, null, 2)}</pre>}
      </form>
      <EditorialEntityPanel apiBase={apiBase} token={token} workspaceId={workspaceId} taskId={article.id} locale={locale}/>
      <p className="evidence-disclaimer">{ar ? "تنبيه: ربط الادعاء بمصدر لا يعني التحقق من صحة المصدر أو الادعاء. فحص الأصالة يقارن فقط بالنصوص التي سبق إدخالها عبر هذه الأداة ضمن مساحة العمل، ولا يكشف إعادة الصياغة الدلالية أو الترجمة." : "Linking a claim to a source does not verify either one. Originality checks compare only text previously submitted through this tool in this workspace; semantic paraphrases and translations are not detected."}</p>
    </>}
    {notice && <p className="inline-feedback">{notice}</p>}
  </section>;
}
