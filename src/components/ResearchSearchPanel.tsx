import { useEffect, useState, type FormEvent } from "react";
import { FileSearch, Globe2, LoaderCircle, Plus, Search, ScanSearch } from "lucide-react";

type Result = { url: string; title: string; snippet: string; publisher: string; publishedAt: string | null; provider: string; verificationState: string };
type Scraped = { sourceId: string; markdown: string; verificationState: string; retrievedAt?: string };
type Inspection = { metrics: { wordCount: number; headingCount: number; inlineLinkCount: number }; issues: string[]; verificationState: string };
type Usage = { source?: number; scrape?: number; search?: number; inspect?: number };
type Limits = { sourceUrlsPerArticle: number; scrapesPerArticle: number; searchesPerArticle: number; inspectionsPerArticle: number };
type Props = { apiBase: string; token: string; workspaceId: string; taskId: string; language: "ar" | "en"; locale: "ar" | "en" };

export default function ResearchSearchPanel({ apiBase, token, workspaceId, taskId, language, locale }: Props) {
  const ar = locale === "ar";
  const [query, setQuery] = useState("");
  const [country, setCountry] = useState("IQ");
  const [results, setResults] = useState<Result[]>([]);
  const [registered, setRegistered] = useState<string[]>([]);
  const [scraped, setScraped] = useState<Record<string, Scraped>>({});
  const [inspections, setInspections] = useState<Record<string, Inspection>>({});
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
  const [scraping, setScraping] = useState<string | null>(null);
  const [inspecting, setInspecting] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [provider, setProvider] = useState("");
  const [usage, setUsage] = useState<Usage>({});
  const [limits, setLimits] = useState<Limits | null>(null);

  async function request(path: string, init: RequestInit = {}) {
    const response = await fetch(apiBase + path, {
      ...init,
      headers: {
        authorization: `Bearer ${token}`,
        ...(init.body ? { "content-type": "application/json" } : {}),
        ...init.headers
      }
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Request failed");
    return payload;
  }

  async function refreshUsage() {
    if (!token.trim()) return;
    try {
      const payload = await request(`/api/v1/workspaces/${encodeURIComponent(workspaceId)}/tasks/${encodeURIComponent(taskId)}/research-usage`);
      setUsage(payload.usage || {});
      setLimits(payload.limits || null);
    } catch { /* Keep the research UI usable when the usage endpoint is temporarily unavailable. */ }
  }

  useEffect(() => { void refreshUsage(); }, [workspaceId, taskId, token, apiBase]);

  async function search(event: FormEvent) {
    event.preventDefault();
    if (!query.trim()) return;
    setBusy(true); setNotice(""); setResults([]); setRegistered([]); setScraped({}); setInspections({});
    try {
      const payload = await request(`/api/v1/workspaces/${encodeURIComponent(workspaceId)}/tasks/${encodeURIComponent(taskId)}/research/searches`, {
        method: "POST", body: JSON.stringify({ query, language, country, limit: 10 })
      });
      setResults(payload.result.results || []);
      setProvider(payload.result.provider || "");
      setNotice(ar ? "نتائج البحث مؤشرات أولية فقط؛ لم يتم جلب محتوى صفحاتها." : "Search results are discovery leads only; page content has not been fetched.");
      await refreshUsage();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Search failed");
    } finally { setBusy(false); }
  }

  async function addSource(item: Result) {
    setAdding(item.url); setNotice("");
    try {
      await request("/api/v1/sources", {
        method: "POST",
        body: JSON.stringify({
          workspaceId, taskId, url: item.url, title: item.title,
          notes: [item.publisher, item.publishedAt || "", item.snippet, "Search discovery result; not opened or verified."].filter(Boolean).join("\n")
        })
      });
      setRegistered(old => [...old, item.url]);
      setNotice(ar ? "أضيف المرجع إلى مصادر المقالة، دون جلب محتواه." : "Reference added to article sources; its content was not fetched.");
      await refreshUsage();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to register source");
    } finally { setAdding(null); }
  }

  async function scrapePage(item: Result) {
    setScraping(item.url); setNotice("");
    try {
      const operationId = crypto.randomUUID();
      const payload = await request(`/api/v1/workspaces/${encodeURIComponent(workspaceId)}/tasks/${encodeURIComponent(taskId)}/research/scrapes`, {
        method: "POST",
        headers: { "idempotency-key": operationId },
        body: JSON.stringify({ url: item.url, title: item.title, operationId })
      });
      setScraped(old => ({ ...old, [item.url]: payload.result }));
      setNotice(ar
        ? "تم جلب الصفحة وتخزينها كمحتوى غير متحقق. الجلب لا يثبت صحة المعلومات."
        : "Page fetched and stored as unverified content. Retrieval does not establish factual accuracy.");
      await refreshUsage();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Scrape failed");
    } finally { setScraping(null); }
  }

  async function inspectPage(item: Result) {
    const source = scraped[item.url];
    if (!source) return;
    setInspecting(item.url); setNotice("");
    try {
      const operationId = crypto.randomUUID();
      const payload = await request(`/api/v1/workspaces/${encodeURIComponent(workspaceId)}/tasks/${encodeURIComponent(taskId)}/research/inspections`, {
        method: "POST",
        headers: { "idempotency-key": operationId },
        body: JSON.stringify({ sourceId: source.sourceId, operationId })
      });
      setInspections(old => ({ ...old, [item.url]: payload.result }));
      setNotice(ar ? "اكتمل فحص بنية الصفحة، وليس التحقق من صحة ادعاءاتها." : "Page structure inspection completed; factual claims were not verified.");
      await refreshUsage();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Inspection failed");
    } finally { setInspecting(null); }
  }

  const quotaText = (used: number | undefined, limit: number | undefined) =>
    `${used || 0}/${Number.isFinite(limit) ? limit : "—"}`;

  return <section className="surface-card evidence-panel" style={{ marginTop: 16 }}>
    <div className="section-heading">
      <div>
        <span className="tiny-overline">LIVE RESEARCH</span>
        <h2>{ar ? "البحث عن مصادر للمقالة" : "Find article sources"}</h2>
        <p>{ar ? "بحث وكشط وفحص بمزود خارجي مضبوط في الخادم" : "Search, scrape and inspect through server-configured providers"}</p>
      </div>
      <Globe2 size={18} />
    </div>
    <div className="research-metrics">
      <div><b>{quotaText(usage.scrape, limits?.scrapesPerArticle)}</b><span>{ar ? "كشط الصفحات" : "Page scrapes"}</span></div>
      <div><b>{quotaText(usage.search, limits?.searchesPerArticle)}</b><span>{ar ? "عمليات البحث" : "Searches"}</span></div>
      <div><b>{quotaText(usage.inspect, limits?.inspectionsPerArticle)}</b><span>{ar ? "عمليات الفحص" : "Inspections"}</span></div>
    </div>
    <form className="evidence-form" onSubmit={search}>
      <textarea required minLength={2} maxLength={400} rows={2} value={query} onChange={event => setQuery(event.target.value)} placeholder={ar ? "اكتب سؤال البحث أو الكلمات المفتاحية..." : "Enter a research question or keywords..."} />
      <div className="form-pair">
        <label>{ar ? "لغة النتائج" : "Result language"}
          <select value={language} disabled><option value="ar">العربية</option><option value="en">English</option></select>
        </label>
        <label>{ar ? "السوق / الدولة" : "Market / country"}
          <select value={country} onChange={event => setCountry(event.target.value)}>
            {[["IQ","العراق / Iraq"],["AE","الإمارات / UAE"],["SA","السعودية / Saudi Arabia"],["US","United States"],["GB","United Kingdom"],["TR","Türkiye"],["JO","Jordan"],["EG","Egypt"]].map(([value,label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
      </div>
      <button className="primary-button" disabled={busy || !token.trim()}>
        {busy ? <LoaderCircle size={15} className="spin" /> : <Search size={15} />}
        {ar ? "تنفيذ البحث" : "Run search"}
      </button>
    </form>
    {provider && <p className="form-note">{ar ? "مزود البحث: " : "Search provider: "}{provider}</p>}
    {results.map((item, index) => <article key={item.url} className="evidence-record">
      <b>{index + 1}. {item.title}</b>
      <small>{item.publisher}{item.publishedAt ? " · " + new Date(item.publishedAt).toLocaleDateString() : ""}</small>
      <a href={item.url} target="_blank" rel="noreferrer">{item.url}</a>
      <p>{item.snippet}</p>
      <small>{ar ? "نتيجة بحث غير متحققة" : "Unverified search result"}</small>
      <div className="form-actions">
        <button className="secondary-button" disabled={adding === item.url || registered.includes(item.url)} onClick={() => addSource(item)}>
          <Plus size={14} />{registered.includes(item.url) ? (ar ? "أُضيف للمصادر" : "Added to sources") : (ar ? "تسجيل الرابط فقط" : "Register URL only")}
        </button>
        <button className="secondary-button" disabled={scraping === item.url || !!scraped[item.url]} onClick={() => scrapePage(item)}>
          {scraping === item.url ? <LoaderCircle size={14} className="spin" /> : <FileSearch size={14} />}
          {scraped[item.url] ? (ar ? "تم الكشط" : "Scraped") : (ar ? "كشط الصفحة" : "Scrape page")}
        </button>
        {scraped[item.url] && <button className="secondary-button" disabled={inspecting === item.url || !!inspections[item.url]} onClick={() => inspectPage(item)}>
          {inspecting === item.url ? <LoaderCircle size={14} className="spin" /> : <ScanSearch size={14} />}
          {inspections[item.url] ? (ar ? "تم الفحص" : "Inspected") : (ar ? "فحص البنية" : "Inspect structure")}
        </button>}
      </div>
      {scraped[item.url] && <details className="evidence-record">
        <summary>{ar ? "عرض المحتوى المستخرج" : "View extracted content"}</summary>
        <small>{scraped[item.url].verificationState} · {scraped[item.url].sourceId}</small>
        <pre style={{ whiteSpace: "pre-wrap", maxHeight: 320, overflow: "auto" }}>{scraped[item.url].markdown.slice(0, 12000)}</pre>
      </details>}
      {inspections[item.url] && <div className="form-note">
        {ar ? "عدد الكلمات" : "Words"}: {inspections[item.url].metrics.wordCount} ·
        {ar ? "العناوين" : "Headings"}: {inspections[item.url].metrics.headingCount} ·
        {ar ? "الروابط" : "Links"}: {inspections[item.url].metrics.inlineLinkCount}
        {inspections[item.url].issues.length > 0 && <span> · {inspections[item.url].issues.join(", ")}</span>}
      </div>}
    </article>)}
    {notice && <p className="inline-feedback">{notice}</p>}
  </section>;
}
