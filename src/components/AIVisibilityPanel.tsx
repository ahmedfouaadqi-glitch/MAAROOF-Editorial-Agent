import { useEffect, useState, type FormEvent } from "react";

type EventType = "crawler_fetch" | "search_index_verified" | "citation_verified" | "training_attestation" | "referral_visit";
type VisibilityEvent = {
  id: string; url: string; eventType: EventType; provider: string; botName: string;
  observedAt: string; evidenceUrl: string | null; evidenceNote: string | null;
  verified: boolean; verificationMethod: string; source: string;
};
type Props = { apiBase: string; token: string; workspaceId: string; locale: "ar" | "en" };

const labels = {
  ar: {
    title: "رصد ظهور المحتوى لدى محركات الذكاء الاصطناعي",
    subtitle: "سجل أدلة الزحف والفهرسة والاستشهاد والزيارات. لا يمكن استنتاج التدريب من مجرد زيارة الزاحف.",
    load: "تحديث السجل", url: "رابط المقال", event: "نوع الرصد", provider: "المزوّد / المحرك",
    bot: "اسم الروبوت أو User-Agent", evidence: "رابط الدليل (نتيجة بحث / إجابة / وثيقة رسمية)",
    note: "ملاحظات التحقق", verified: "تم التحقق من الدليل", add: "تسجيل الرصد",
    crawl: "زيارة زاحف / قراءة تقنية", index: "فهرسة مؤكدة", citation: "استشهاد مؤكد في إجابة", training: "إفادة صريحة عن استخدام التدريب", referral: "زيارة إحالة",
    crawls: "زيارات الزواحف المسجلة", indexes: "صفحات مفهرسة (موثقة)", citations: "استشهادات موثقة", trainingCount: "إفادات تدريب موثقة",
    empty: "لا توجد أحداث مسجلة بعد.", noToken: "أدخل مفتاح الإدارة في صفحة المقالات أو إعدادات البحث أولاً.",
    warning: "مهم: ظهور GPTBot أو ClaudeBot في السجلات لا يثبت أن المقال دُرّب عليه. وظهور OAI-SearchBot أو Googlebot لا يثبت الفهرسة أو الاستشهاد.",
    sourceManual: "المصدر يدوي", sourceLog: "سجل خادم", sourceConsole: "أداة مشرف الموقع", sourceSearch: "نتيجة بحث/إجابة",
    statusVerified: "موثق", statusUnverified: "غير موثق", error: "تعذر تنفيذ الطلب"
  },
  en: {
    title: "AI content visibility monitoring",
    subtitle: "Track evidence for crawler access, indexing, citations, and referrals. Training cannot be inferred from a crawler visit.",
    load: "Refresh", url: "Article URL", event: "Observation type", provider: "Provider / engine",
    bot: "Bot name or User-Agent", evidence: "Evidence URL (search result / answer / official statement)",
    note: "Verification notes", verified: "Evidence verified", add: "Record observation",
    crawl: "Crawler fetch / technical read", index: "Verified indexing", citation: "Verified answer citation", training: "Explicit training-use attestation", referral: "Referral visit",
    crawls: "Recorded crawler fetches", indexes: "Verified indexed pages", citations: "Verified citations", trainingCount: "Training attestations",
    empty: "No observations recorded yet.", noToken: "Enter the admin token on the Articles or Research settings page first.",
    warning: "Important: GPTBot or ClaudeBot access does not prove an article was used for training. OAI-SearchBot or Googlebot access does not prove indexing or citation.",
    sourceManual: "Manual", sourceLog: "Server log", sourceConsole: "Search console", sourceSearch: "Search / answer result",
    statusVerified: "Verified", statusUnverified: "Unverified", error: "Request failed"
  }
};

export default function AIVisibilityPanel({ apiBase, token, workspaceId, locale }: Props) {
  const copy = labels[locale];
  const [events, setEvents] = useState<VisibilityEvent[]>([]);
  const [summary, setSummary] = useState({ crawlerFetches: 0, searchIndexVerified: 0, citationsVerified: 0, trainingAttestations: 0, referralVisits: 0, uniqueUrls: 0 });
  const [eventType, setEventType] = useState<EventType>("crawler_fetch");
  const [url, setUrl] = useState("");
  const [provider, setProvider] = useState("");
  const [bot, setBot] = useState("");
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [evidenceNote, setEvidenceNote] = useState("");
  const [verified, setVerified] = useState(false);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    if (!token.trim()) return;
    setBusy(true);
    try {
      const response = await fetch(`${apiBase}/api/v1/admin/ai-visibility?workspaceId=${encodeURIComponent(workspaceId)}`, { headers: { authorization: `Bearer ${token}` } });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || copy.error);
      setEvents(payload.events || []);
      setSummary(payload.summary || summary);
      setNotice("");
    } catch (error) { setNotice(error instanceof Error ? error.message : copy.error); }
    finally { setBusy(false); }
  }
  useEffect(() => { void load(); }, [apiBase, token, workspaceId]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!token.trim() || !url.trim()) return;
    setBusy(true); setNotice("");
    try {
      const response = await fetch(`${apiBase}/api/v1/admin/ai-visibility/events`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({ workspaceId, url, eventType, provider, bot, evidenceUrl, evidenceNote, verified, source: "manual", verificationMethod: verified ? "admin_manual_review" : "manual_unverified" })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || copy.error);
      setUrl(""); setEvidenceUrl(""); setEvidenceNote(""); setVerified(false);
      await load();
      setNotice(locale === "ar" ? "تم تسجيل الرصد." : "Observation recorded.");
    } catch (error) { setNotice(error instanceof Error ? error.message : copy.error); }
    finally { setBusy(false); }
  }

  const eventLabel = (type: EventType) => type === "crawler_fetch" ? copy.crawl : type === "search_index_verified" ? copy.index : type === "citation_verified" ? copy.citation : type === "training_attestation" ? copy.training : copy.referral;
  return <section className="page-section">
    <div className="page-heading"><div><span className="tiny-overline">AI DISCOVERY / CITATION / INDEXING</span><h1>{copy.title}</h1><p>{copy.subtitle}</p></div><button className="secondary-button" onClick={() => void load()} disabled={busy}>{copy.load}</button></div>
    <div className="registry-summary">
      <div className="summary-tile"><span>{copy.crawls}</span><b>{summary.crawlerFetches}</b></div>
      <div className="summary-tile"><span>{copy.indexes}</span><b>{summary.searchIndexVerified}</b></div>
      <div className="summary-tile"><span>{copy.citations}</span><b>{summary.citationsVerified}</b></div>
      <div className="summary-tile"><span>{copy.trainingCount}</span><b>{summary.trainingAttestations}</b></div>
    </div>
    <div className="surface-card budget-panel">
      <div className="card-topline"><span className="tiny-overline">EVIDENCE LEDGER</span><span className="status-chip">{summary.uniqueUrls} URLs</span></div>
      <p className="muted">{copy.warning}</p>
      {!token.trim() && <p className="inline-feedback">{copy.noToken}</p>}
      <form className="article-form" onSubmit={submit}>
        <label>{copy.url}<input type="url" value={url} onChange={e=>setUrl(e.target.value)} required placeholder="https://example.com/article"/></label>
        <div className="form-pair">
          <label>{copy.event}<select value={eventType} onChange={e=>setEventType(e.target.value as EventType)}>
            <option value="crawler_fetch">{copy.crawl}</option><option value="search_index_verified">{copy.index}</option><option value="citation_verified">{copy.citation}</option><option value="training_attestation">{copy.training}</option><option value="referral_visit">{copy.referral}</option>
          </select></label>
          <label>{copy.provider}<input value={provider} onChange={e=>setProvider(e.target.value)} placeholder="OpenAI / Google / Anthropic / Perplexity"/></label>
        </div>
        <label>{copy.bot}<input value={bot} onChange={e=>setBot(e.target.value)} placeholder="GPTBot / OAI-SearchBot / ClaudeBot..."/></label>
        <label>{copy.evidence}<input type="url" value={evidenceUrl} onChange={e=>setEvidenceUrl(e.target.value)} placeholder="https://..."/></label>
        <label>{copy.note}<textarea rows={3} value={evidenceNote} onChange={e=>setEvidenceNote(e.target.value)}/></label>
        <label className="checkbox-line"><input type="checkbox" checked={verified} onChange={e=>setVerified(e.target.checked)}/>{copy.verified}</label>
        <button className="primary-button" type="submit" disabled={busy||!token.trim()}>{copy.add}</button>
        {notice&&<p className="inline-feedback">{notice}</p>}
      </form>
    </div>
    <div className="surface-card article-list-card"><div className="section-heading"><div><span className="tiny-overline">OBSERVATION HISTORY</span><h2>{locale==="ar"?"سجل القراءات والفهرسة والاستشهاد":"Crawl, indexing and citation history"}</h2></div><span className="count-badge">{events.length}</span></div>
      {events.length===0?<p className="muted">{copy.empty}</p>:<div className="article-table">{events.map(item=><div className="article-row" key={item.id}><div className="article-row-main"><b>{eventLabel(item.eventType)}</b><small>{item.provider} · {item.botName} · {new Date(item.observedAt).toLocaleString(locale==="ar"?"ar-IQ":"en-US")}</small><small dir="ltr">{item.url}</small>{item.evidenceUrl&&<a href={item.evidenceUrl} target="_blank" rel="noreferrer">{item.evidenceUrl}</a>}{item.evidenceNote&&<small>{item.evidenceNote}</small>}</div><span className="stage-pill">{item.verified?copy.statusVerified:copy.statusUnverified}</span></div>)}</div>}
    </div>
  </section>;
}
