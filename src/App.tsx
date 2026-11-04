import { useEffect, useMemo, useState } from "react";
import {
  Activity, ArrowDownLeft, ArrowLeft, ArrowUpLeft, BookOpenText, Check,
  CheckCircle2, ChevronDown, CircleHelp, Command, FileCheck2, FilePlus2,
  FileText, Globe2, Home, Layers3, LayoutDashboard, Library, ListFilter,
  LockKeyhole, Menu, Moon, MoreHorizontal, Plus, Search, Settings2,
  ShieldCheck, SlidersHorizontal, Sparkles, Sun, Workflow, X, Zap
} from "lucide-react";
import SpotlightCard from "./components/SpotlightCard";
import { DEFAULT_RESEARCH_BUDGET, validateResearchBudgetLimits, type ResearchBudgetLimits } from "./domain/research-budget";
import { categoryLabels, modeLabels, platforms, readinessLabels, type PlatformCategory } from "./data/platforms";
import { adapterRegistry } from "./data/adapter-registry";

type View = "home" | "articles" | "registry" | "research-settings";
type Article = { id: string; topic: string; language: string; objective: string; stage: string; createdAt: string };
type Locale = "ar" | "en";
const categories: Array<"all" | PlatformCategory> = ["all", "editorial", "professional", "community", "knowledge", "research", "developer", "web-data"];
const stageLabels: Record<string, string> = {
  intake: "استلام الطلب", planning: "التخطيط", research: "البحث", "entity-analysis": "تحليل الكيانات",
  outline: "المخطط", drafting: "كتابة المسودة", "source-review": "مراجعة المصادر",
  "originality-review": "فحص الأصالة", "media-review": "مراجعة الوسائط",
  "editorial-approval": "الموافقة التحريرية", "ready-to-publish": "جاهز للنشر"
};
const enStageLabels: Record<string, string> = {
  intake: "Intake", planning: "Planning", research: "Research", "entity-analysis": "Entity analysis",
  outline: "Outline", drafting: "Drafting", "source-review": "Source review",
  "originality-review": "Originality", "media-review": "Media review",
  "editorial-approval": "Editorial approval", "ready-to-publish": "Ready to publish"
};
const t = {
  ar: {
    workspace: "مساحة العمل الرئيسية", overview: "نظرة عامة", articles: "المقالات", registry: "المنصات والمجلات",
    research: "البحث والمصادر", settings: "الإعدادات", help: "المساعدة", search: "ابحث عن أي شيء...",
    eyebrow: "منظومة العمليات التحريرية", title: "مساحة العمل التحريرية", subtitle: "من الفكرة إلى مقال موثّق وجاهز للنشر، ضمن مسار تحريري واضح.",
    create: "إنشاء مقالة", explore: "استعراض المنصات", active: "حالة المنظومة", ready: "البنية الأساسية جاهزة",
    platforms: "منصة مسجلة", destinations: "وجهات تحريرية", connectors: "موصلات نشر مختبرة", drafts: "مقالات قيد العمل",
    workflow: "مسار الإنتاج التحريري", workflowSub: "مراحل واضحة، ومراجعة قبل أي نشر خارجي.",
    recent: "أحدث المقالات", allArticles: "كل المقالات", noArticles: "لا توجد مقالات بعد",
    noArticlesSub: "ابدأ بإنشاء أول مهمة تحريرية. ستظهر هنا مراحل تقدمها بعد ربط المحركات.",
    quick: "اختصارات العمل", newArticle: "مقالة جديدة", platformRegistry: "دليل المنصات",
    settingsTitle: "إعدادات البحث والمصادر", settingsSub: "تحديد حدود العمليات لكل مقالة وحفظها في الخدمة الخلفية.",
    registryTitle: "دليل المنصات والمجلات", registrySub: "ملفات المنصات، نماذج التكامل، والقيود التحريرية قبل التفعيل.",
    filter: "كل التصنيفات", searchPlatform: "ابحث عن منصة أو نوع محتوى...",
    profile: "ملف المنصة", noPublish: "النشر غير مفعّل. هذا الملف يوضح المتطلبات ولا يثبت جاهزية الموصل.",
    integration: "طريقة التكامل المرشحة", capabilities: "قدرات النشر", constraints: "قيود يجب احترامها",
    checklist: "قائمة التحقق قبل التفعيل", docs: "الوثائق الرسمية", adapter: "حالة الموصل",
    apiKey: "مفتاح إدارة الخدمة الخلفية", apiKeyHint: "أدخل ADMIN_API_TOKEN المحفوظ في بيئة الخادم. يبقى في ذاكرة الجلسة فقط.",
    load: "تحميل المحفوظ", save: "حفظ الإعدادات", reset: "استعادة الافتراضي", sourceLimit: "روابط المصادر لكل مقالة",
    searchLimit: "عمليات البحث لكل مقالة", inspectLimit: "عمليات الفحص لكل مقالة",
    sourceHint: "مراجع يضيفها المستخدم يدوياً، ولا يتم جلب محتواها تلقائياً.",
    searchHint: "حجوزات للبحث المستقبلي؛ لا يوجد مزوّد بحث متصل حالياً.",
    inspectHint: "حجوزات للفحص المستقبلي؛ لا توجد خدمة استخراج متصلة حالياً.",
    newTitle: "إنشاء مهمة تحريرية", newSub: "حدد الموضوع واللغة والهدف. لن يتم النشر الخارجي تلقائياً.",
    topic: "موضوع المقالة", topicPlaceholder: "اكتب الموضوع أو الفكرة الرئيسية...",
    language: "لغة المقالة", objective: "الهدف التحريري", createTask: "إنشاء المهمة",
    analysis: "تحليل", thought: "قيادة فكرية", news: "خبر", education: "محتوى تعليمي", researchSummary: "ملخص بحثي",
    arabic: "العربية", english: "الإنجليزية", status: "الحالة", stage: "المرحلة",
    sourceNotice: "لا يوجد Supabase أو Firecrawl في هذه النسخة. الروابط تُسجّل يدوياً دون جلب آلي.",
    loading: "جارٍ التحميل...", viewAll: "عرض الكل", light: "الوضع النهاري", dark: "الوضع الليلي",
    langToggle: "English", emptyRegistry: "لم يتم العثور على نتائج مطابقة.",
    policy: "مراجعة السياسات مطلوبة", unverified: "غير متحقق", notBuilt: "لم يُبنَ بعد",
    targetCount: "وجهات نشر محتملة", noClaims: "لا توجد عمليات نشر موثقة"
  },
  en: {
    workspace: "Main workspace", overview: "Overview", articles: "Articles", registry: "Platforms & magazines",
    research: "Research & sources", settings: "Settings", help: "Help", search: "Search anything...",
    eyebrow: "EDITORIAL OPERATIONS", title: "Editorial workspace", subtitle: "Move from an idea to a sourced, publication-ready article through a clear editorial workflow.",
    create: "Create article", explore: "Explore platforms", active: "SYSTEM STATUS", ready: "Foundation is ready",
    platforms: "Registered platforms", destinations: "Editorial destinations", connectors: "Verified publishers", drafts: "Articles in progress",
    workflow: "Editorial production flow", workflowSub: "Defined stages with human review before external publishing.",
    recent: "Recent articles", allArticles: "All articles", noArticles: "No articles yet",
    noArticlesSub: "Create your first editorial task. Its progress will appear here as engines are connected.",
    quick: "Quick actions", newArticle: "New article", platformRegistry: "Platform directory",
    settingsTitle: "Research & source settings", settingsSub: "Configure per-article operation limits and save them to the backend.",
    registryTitle: "Platform & magazine directory", registrySub: "Platform profiles, integration models, and editorial restrictions before activation.",
    filter: "All categories", searchPlatform: "Search platforms or content types...",
    profile: "PLATFORM PROFILE", noPublish: "Publishing is disabled. This profile describes requirements; it does not prove connector readiness.",
    integration: "Proposed integration", capabilities: "Publishing capabilities", constraints: "Restrictions",
    checklist: "Activation checklist", docs: "Official documentation", adapter: "Connector status",
    apiKey: "Backend admin token", apiKeyHint: "Enter ADMIN_API_TOKEN from the server environment. Kept in session memory only.",
    load: "Load saved", save: "Save settings", reset: "Reset defaults", sourceLimit: "Source URLs per article",
    searchLimit: "Search operations per article", inspectLimit: "Inspection operations per article",
    sourceHint: "Manually registered references. Their content is not fetched automatically.",
    searchHint: "Reservations for future search; no search provider is connected.",
    inspectHint: "Reservations for future inspection; no extraction service is connected.",
    newTitle: "Create editorial task", newSub: "Set the topic, language, and objective. No external publishing will happen automatically.",
    topic: "Article topic", topicPlaceholder: "Enter the main topic or idea...",
    language: "Article language", objective: "Editorial objective", createTask: "Create task",
    analysis: "Analysis", thought: "Thought leadership", news: "News", education: "Educational", researchSummary: "Research summary",
    arabic: "Arabic", english: "English", status: "Status", stage: "Stage",
    sourceNotice: "Supabase and Firecrawl are not used. URLs are registered manually without remote fetching.",
    loading: "Loading...", viewAll: "View all", light: "Light mode", dark: "Dark mode",
    langToggle: "العربية", emptyRegistry: "No matching platforms found.",
    policy: "Policy review required", unverified: "Unverified", notBuilt: "Not built",
    targetCount: "Potential destinations", noClaims: "No verified publications"
  }
};

export default function App() {
  const [view, setView] = useState<View>("home");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<"all" | PlatformCategory>("all");
  const [selectedId, setSelectedId] = useState<string>("wordpress");
  const [budget, setBudget] = useState<ResearchBudgetLimits>({ ...DEFAULT_RESEARCH_BUDGET });
  const [budgetNotice, setBudgetNotice] = useState("");
  const [adminToken, setAdminToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [locale, setLocale] = useState<Locale>("ar");
  const [mobileNav, setMobileNav] = useState(false);
  const [topic, setTopic] = useState("");
  const [language, setLanguage] = useState<"ar" | "en">("ar");
  const [objective, setObjective] = useState("analysis");
  const [articles, setArticles] = useState<Article[]>([]);
  const [articleNotice, setArticleNotice] = useState("");
  const apiBase = (import.meta.env.VITE_API_BASE_URL || "http://localhost:8787").replace(/\/$/, "");
  const copy = t[locale];
  const budgetValidation = validateResearchBudgetLimits(budget);
  const selected = platforms.find((p) => p.id === selectedId);
  const adapter = selected ? adapterRegistry[selected.id] : undefined;
  const visible = useMemo(() => platforms.filter((p) =>
    (category === "all" || p.category === category) &&
    (p.name + " " + p.contentPurpose + " " + p.note).toLowerCase().includes(query.toLowerCase())
  ), [query, category]);

  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);
  useEffect(() => {
    if (view !== "articles" || !adminToken.trim()) return;
    let cancelled = false;
    fetch(`${apiBase}/api/v1/workspaces/main-workspace/articles`, { headers: { authorization: `Bearer ${adminToken}` } })
      .then(async response => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "تعذر تحميل المقالات");
        if (!cancelled) setArticles(payload.articles || []);
      })
      .catch(error => { if (!cancelled) setArticleNotice(error instanceof Error ? error.message : "تعذر الاتصال بالخدمة الخلفية."); });
    return () => { cancelled = true; };
  }, [view, adminToken, apiBase]);

  async function saveBudget() {
    if (!budgetValidation.valid || !adminToken.trim()) return;
    setBusy(true); setBudgetNotice("");
    try {
      const response = await fetch(`${apiBase}/api/v1/admin/research-limits`, {
        method: "PUT", headers: { "content-type": "application/json", authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ limits: budget })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "تعذر حفظ الإعدادات");
      setBudget(payload.limits); setBudgetNotice(locale === "ar" ? "تم حفظ الحدود في الخدمة الخلفية." : "Limits saved to the backend.");
    } catch (error) { setBudgetNotice(error instanceof Error ? error.message : "تعذر الاتصال بالخدمة الخلفية."); }
    finally { setBusy(false); }
  }

  async function loadBudget() {
    if (!adminToken.trim()) return;
    setBusy(true); setBudgetNotice("");
    try {
      const response = await fetch(`${apiBase}/api/v1/admin/research-limits`, { headers: { authorization: `Bearer ${adminToken}` } });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "تعذر تحميل الإعدادات");
      setBudget(payload.limits); setBudgetNotice(locale === "ar" ? "تم تحميل الإعدادات المحفوظة." : "Saved settings loaded.");
    } catch (error) { setBudgetNotice(error instanceof Error ? error.message : "تعذر الاتصال بالخدمة الخلفية."); }
    finally { setBusy(false); }
  }

  async function createArticle(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!topic.trim() || !adminToken.trim()) {
      setArticleNotice(locale === "ar" ? "أدخل مفتاح الإدارة وموضوع المقالة أولاً." : "Enter the admin token and article topic first.");
      return;
    }
    setBusy(true); setArticleNotice("");
    try {
      const response = await fetch(`${apiBase}/api/v1/workspaces/main-workspace/articles`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ topic, language, objective })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "تعذر إنشاء المهمة");
      setArticles(current => [payload.article, ...current]);
      setTopic("");
      setArticleNotice(locale === "ar" ? "تم إنشاء المهمة في مرحلة الاستلام." : "Task created in the intake stage.");
    } catch (error) { setArticleNotice(error instanceof Error ? error.message : "تعذر الاتصال بالخدمة الخلفية."); }
    finally { setBusy(false); }
  }

  const navItems = [
    { id: "home" as const, label: copy.overview, icon: LayoutDashboard },
    { id: "articles" as const, label: copy.articles, icon: FileText },
    { id: "registry" as const, label: copy.registry, icon: Globe2 },
    { id: "research-settings" as const, label: copy.research, icon: SlidersHorizontal }
  ];
  const destinationCount = platforms.filter(p => p.category === "editorial").length;

  return <div className={`app-shell ${theme === "dark" ? "theme-dark" : "theme-light"}`} dir={locale === "ar" ? "rtl" : "ltr"}>
    <aside className={`sidebar ${mobileNav ? "sidebar-open" : ""}`}>
      <button className="brand" onClick={() => { setView("home"); setMobileNav(false); }} aria-label="MAAROOF home">
        <span className="brand-mark"><BrandMark /></span>
        <span className="brand-copy"><strong>MAAROOF</strong><small>EDITORIAL AGENT</small></span>
        <span className="brand-version">BETA</span>
      </button>
      <button className="workspace-switch"><span className="workspace-avatar">M</span><span><b>{copy.workspace}</b><small>Personal workspace</small></span><ChevronDown size={15}/></button>
      <div className="side-label">{locale === "ar" ? "مساحة العمل" : "WORKSPACE"}</div>
      <nav className="side-nav">
        {navItems.map(item => <button key={item.id} className={view === item.id ? "nav-item active" : "nav-item"} onClick={() => { setView(item.id); setMobileNav(false); }}>
          <item.icon size={17} strokeWidth={1.8}/><span>{item.label}</span>{item.id === "articles" && articles.length > 0 && <i>{articles.length}</i>}
        </button>)}
      </nav>
      <div className="side-label secondary-label">{locale === "ar" ? "الإدارة" : "MANAGE"}</div>
      <button className="nav-item" onClick={() => setView("research-settings")}><Settings2 size={17}/><span>{copy.settings}</span></button>
      <div className="sidebar-bottom">
        <div className="sidebar-help"><span className="help-icon"><CircleHelp size={16}/></span><span><b>{copy.help}</b><small>{locale === "ar" ? "دليل استخدام المنصة" : "Product documentation"}</small></span><ArrowUpLeft size={14}/></div>
        <div className="profile-row"><div className="profile-avatar">M</div><div><b>MAAROOF Workspace</b><small>{locale === "ar" ? "مساحة تجريبية" : "Development workspace"}</small></div><MoreHorizontal size={17}/></div>
      </div>
    </aside>

    <main className="main-area">
      <header className="topbar">
        <div className="topbar-start">
          <button className="mobile-menu" onClick={() => setMobileNav(!mobileNav)} aria-label="Toggle navigation"><Menu size={19}/></button>
          <div className="breadcrumbs"><span>MAAROOF</span><span className="crumb-slash">/</span><b>{navItems.find(item => item.id === view)?.label}</b></div>
        </div>
        <div className="topbar-actions">
          <label className="global-search"><Search size={15}/><input placeholder={copy.search}/><kbd><Command size={10}/> K</kbd></label>
          <button className="top-icon" onClick={() => setLocale(locale === "ar" ? "en" : "ar")} title={copy.langToggle}><span className="language-code">{locale === "ar" ? "EN" : "ع"}</span></button>
          <button className="top-icon" onClick={() => setTheme(theme === "light" ? "dark" : "light")} title={theme === "light" ? copy.dark : copy.light}>{theme === "light" ? <Moon size={17}/> : <Sun size={17}/>}</button>
          <div className="top-avatar">M</div>
        </div>
      </header>

      <div className="page-content">
        {view === "home" && <HomeView copy={copy} articles={articles} onCreate={() => setView("articles")} onRegistry={() => setView("registry")} onViewAll={() => setView("articles")} locale={locale}/>}
        {view === "articles" && <section className="page-section">
          <PageHeading eyebrow="EDITORIAL WORKFLOW" title={copy.newTitle} subtitle={copy.newSub} action={<span className="status-chip"><span className="status-dot"/> API workspace</span>}/>
          <div className="article-layout">
            <SpotlightCard theme={theme} className="surface-card create-card" spotlightColor={theme === "light" ? "#b88c54" : "#d6ae78"} intensity={0.14} spotlightSize={360} borderGlow={0.2}>
              <div className="card-topline"><span className="section-icon"><FilePlus2 size={17}/></span><span className="tiny-overline">{locale === "ar" ? "NEW EDITORIAL TASK" : "NEW EDITORIAL TASK"}</span></div>
              <h2>{copy.newTitle}</h2><p className="muted">{copy.newSub}</p>
              <form className="article-form" onSubmit={createArticle}>
                <label>{copy.topic}<textarea value={topic} onChange={e=>setTopic(e.target.value)} placeholder={copy.topicPlaceholder} rows={4} required minLength={3}/></label>
                <div className="form-pair">
                  <label>{copy.language}<select value={language} onChange={e=>setLanguage(e.target.value as "ar"|"en")}><option value="ar">{copy.arabic}</option><option value="en">{copy.english}</option></select></label>
                  <label>{copy.objective}<select value={objective} onChange={e=>setObjective(e.target.value)}><option value="analysis">{copy.analysis}</option><option value="thought-leadership">{copy.thought}</option><option value="news">{copy.news}</option><option value="educational">{copy.education}</option><option value="research-summary">{copy.researchSummary}</option></select></label>
                </div>
                <div className="form-note"><LockKeyhole size={14}/>{copy.sourceNotice}</div>
                <button className="primary-button" type="submit" disabled={busy}><Plus size={16}/>{busy ? copy.loading : copy.createTask}<ArrowLeft size={15}/></button>
                {articleNotice && <p className="inline-feedback">{articleNotice}</p>}
              </form>
            </SpotlightCard>
            <div className="side-stack">
              <div className="surface-card token-card"><div className="card-topline"><span className="section-icon"><ShieldCheck size={17}/></span><span className="tiny-overline">BACKEND ACCESS</span></div><h3>{copy.apiKey}</h3><p className="muted">{copy.apiKeyHint}</p><input className="token-input" type="password" autoComplete="off" value={adminToken} onChange={e=>setAdminToken(e.target.value)} placeholder="ADMIN_API_TOKEN"/></div>
              <div className="surface-card workflow-mini"><div className="card-title-row"><div><span className="tiny-overline">PIPELINE</span><h3>{copy.workflow}</h3></div><Workflow size={18}/></div><div className="mini-pipeline"><span className="pipeline-node current">01</span><i/><span className="pipeline-node">02</span><i/><span className="pipeline-node">03</span><i/><span className="pipeline-node">04</span></div><div className="pipeline-captions"><span>{locale==="ar"?"استلام":"Intake"}</span><span>{locale==="ar"?"بحث":"Research"}</span><span>{locale==="ar"?"كتابة":"Draft"}</span><span>{locale==="ar"?"مراجعة":"Review"}</span></div></div>
            </div>
          </div>
          <section className="surface-card article-list-card"><div className="section-heading"><div><span className="tiny-overline">WORK QUEUE</span><h2>{copy.recent}</h2></div><span className="count-badge">{articles.length}</span></div>
            {articles.length === 0 ? <EmptyArticles copy={copy}/> : <div className="article-table">{articles.map(article=><div className="article-row" key={article.id}><div className="article-file-icon"><FileText size={17}/></div><div className="article-row-main"><b>{article.topic}</b><small>{article.language.toUpperCase()} · {new Date(article.createdAt).toLocaleDateString(locale === "ar" ? "ar-IQ" : "en-US")}</small></div><span className="stage-pill">{(locale==="ar"?stageLabels:enStageLabels)[article.stage] || article.stage}</span></div>)}</div>}
          </section>
        </section>}
        {view === "registry" && <section className="page-section">
          <PageHeading eyebrow="PUBLISHING DESTINATIONS" title={copy.registryTitle} subtitle={copy.registrySub} action={<span className="status-chip"><Globe2 size={14}/>{platforms.length} {copy.platforms}</span>}/>
          <div className="registry-summary">
            <div className="summary-tile"><span>{copy.platforms}</span><b>{platforms.length}</b><Globe2 size={18}/></div>
            <div className="summary-tile"><span>{copy.destinations}</span><b>{destinationCount}</b><BookOpenText size={18}/></div>
            <div className="summary-tile"><span>{copy.connectors}</span><b>0</b><ShieldCheck size={18}/></div>
          </div>
          <div className="registry-panel surface-card">
            <div className="registry-toolbar"><label className="registry-search"><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder={copy.searchPlatform}/></label><div className="filter-control"><ListFilter size={15}/><select value={category} onChange={e=>setCategory(e.target.value as "all"|PlatformCategory)}><option value="all">{copy.filter}</option>{categories.filter(c=>c!=="all").map(c=><option key={c} value={c}>{categoryLabels[c]}</option>)}</select></div></div>
            <div className="registry-content"><div className="platform-list">{visible.map(p=><button className={selectedId===p.id?"platform-row selected-platform":"platform-row"} key={p.id} onClick={()=>setSelectedId(p.id)}>
              <div className="platform-logo">{p.name.slice(0,1)}</div><div className="platform-info"><strong>{p.name}</strong><span>{p.contentPurpose}</span><small>{p.note}</small></div><div className="platform-meta"><span>{modeLabels[p.mode]}</span><small>{readinessLabels[p.readiness]}</small></div><ArrowDownLeft className="platform-open" size={15}/>
            </button>)}{visible.length===0&&<div className="empty-registry">{copy.emptyRegistry}</div>}</div>
            {selected && adapter && <aside className="detail-panel"><div className="detail-top"><span className="tiny-overline">{copy.profile}</span><button className="top-icon" onClick={()=>setSelectedId("")}><X size={15}/></button></div><div className="detail-title"><div className="platform-logo large-logo">{selected.name.slice(0,1)}</div><div><h3>{selected.name}</h3><span>{selected.contentPurpose}</span></div></div><div className="detail-warning"><LockKeyhole size={14}/><span>{copy.noPublish}</span></div><h4>{copy.integration}</h4><div className="detail-value">{adapter.integration==="official-api"?"Official API candidate":adapter.integration==="manual"?"Manual handoff":adapter.integration==="research-only"?"Research only":"Not assessed"}</div><h4>{copy.capabilities}</h4><div className="capability-grid"><div><span>{locale==="ar"?"إنشاء مقال":"Create article"}</span><b>{capabilityLabel(adapter.canCreateArticle,locale)}</b></div><div><span>{locale==="ar"?"رفع صور":"Upload media"}</span><b>{capabilityLabel(adapter.canUploadMedia,locale)}</b></div><div><span>{locale==="ar"?"بيانات وصفية":"Metadata"}</span><b>{capabilityLabel(adapter.canSetMetadata,locale)}</b></div></div><h4>{copy.constraints}</h4><ul className="detail-list">{adapter.constraints.map((item,i)=><li key={i}>{item}</li>)}</ul><h4>{copy.checklist}</h4><ol className="detail-list numbered">{adapter.verificationChecklist.map((item,i)=><li key={i}>{item}</li>)}</ol>{adapter.officialDocsUrl&&<a className="docs-link" href={adapter.officialDocsUrl} target="_blank" rel="noreferrer">{copy.docs}<ArrowUpLeft size={14}/></a>}<div className="adapter-state"><Workflow size={14}/><span>{copy.adapter}: {adapter.implementationStatus==="adapter-not-implemented"?copy.notBuilt:adapter.implementationStatus==="not-a-publishing-target"?"Not a publishing destination":copy.unverified}</span></div></aside>}
            </div>
          </div>
        </section>}
        {view === "research-settings" && <section className="page-section">
          <PageHeading eyebrow="SYSTEM CONFIGURATION" title={copy.settingsTitle} subtitle={copy.settingsSub}/>
          <SpotlightCard theme={theme} className="surface-card budget-panel" spotlightColor={theme==="light"?"#b88c54":"#d6ae78"} intensity={0.1} spotlightSize={340}>
            <div className="card-topline"><span className="section-icon"><SlidersHorizontal size={17}/></span><span className="tiny-overline">RESEARCH GOVERNANCE</span></div>
            <div className="budget-intro"><div><h2>{copy.settingsTitle}</h2><p className="muted">{copy.sourceNotice}</p></div><span className="status-chip"><LockKeyhole size={13}/> Admin only</span></div>
            <label className="budget-field token-field"><span>{copy.apiKey}</span><small>{copy.apiKeyHint}</small><input type="password" autoComplete="off" value={adminToken} onChange={e=>setAdminToken(e.target.value)} placeholder="ADMIN_API_TOKEN"/></label>
            <div className="budget-grid">
              <BudgetField label={copy.sourceLimit} hint={copy.sourceHint} value={budget.sourceUrlsPerArticle} onChange={v=>setBudget(old=>({...old,sourceUrlsPerArticle:v}))}/>
              <BudgetField label={copy.searchLimit} hint={copy.searchHint} value={budget.searchesPerArticle} onChange={v=>setBudget(old=>({...old,searchesPerArticle:v}))}/>
              <BudgetField label={copy.inspectLimit} hint={copy.inspectHint} value={budget.inspectionsPerArticle} onChange={v=>setBudget(old=>({...old,inspectionsPerArticle:v}))}/>
            </div>
            {!budgetValidation.valid&&<p className="budget-error">{budgetValidation.errors.join(" · ")}</p>}
            <div className="budget-actions"><button className="secondary-button" onClick={()=>{setBudget({...DEFAULT_RESEARCH_BUDGET});setBudgetNotice(locale==="ar"?"استُعيدت القيم محلياً. احفظ لتثبيتها.":"Defaults restored locally. Save to persist.");}}><ArrowLeft size={14}/>{copy.reset}</button><div><button className="secondary-button" disabled={!adminToken.trim()||busy} onClick={loadBudget}>{copy.load}</button><button className="primary-button" disabled={!budgetValidation.valid||!adminToken.trim()||busy} onClick={saveBudget}><Check size={15}/>{busy?copy.loading:copy.save}</button></div></div>
            {budgetNotice&&<p className="inline-feedback">{budgetNotice}</p>}
            <div className="budget-footnote"><LockKeyhole size={15}/><span>{copy.sourceNotice} {locale==="ar"?"حدود البحث والفحص محاسبية فقط حتى ربط مزوّد فعلي.":"Search and inspection limits are accounting only until a provider is connected."}</span></div>
          </SpotlightCard>
        </section>}
      </div>
    </main>
    <nav className="mobile-bottom-nav">{navItems.map(item=><button key={item.id} className={view===item.id?"active":""} onClick={()=>setView(item.id)}><item.icon size={18}/><span>{item.label}</span></button>)}</nav>
  </div>;
}

function PageHeading({eyebrow,title,subtitle,action}:{eyebrow:string;title:string;subtitle:string;action?:React.ReactNode}) {
  return <div className="page-heading"><div><span className="tiny-overline">{eyebrow}</span><h1>{title}</h1><p>{subtitle}</p></div>{action}</div>;
}

function HomeView({copy,articles,onCreate,onRegistry,onViewAll,locale}:{copy:typeof t.ar;articles:Article[];onCreate:()=>void;onRegistry:()=>void;onViewAll:()=>void;locale:Locale}) {
  const metrics=[
    {label:copy.platforms,value:String(platforms.length).padStart(2,"0"),note:locale==="ar"?"ضمن سجل المنصات":"In platform registry",icon:Globe2},
    {label:copy.destinations,value:String(platforms.filter(p=>p.category==="editorial").length).padStart(2,"0"),note:locale==="ar"?"مجلات ومدونات":"Magazines & blogs",icon:BookOpenText},
    {label:copy.connectors,value:"00",note:copy.noClaims,icon:ShieldCheck},
    {label:copy.drafts,value:String(articles.length).padStart(2,"0"),note:locale==="ar"?"مهام تحريرية":"Editorial tasks",icon:FileText}
  ];
  const stages=locale==="ar"?["استلام","تخطيط","بحث","تحليل","مخطط","كتابة","مصادر","أصالة","وسائط","موافقة","جاهز"]:["Intake","Plan","Research","Entities","Outline","Draft","Sources","Originality","Media","Approval","Ready"];
  return <section className="home-view">
    <PageHeading eyebrow={copy.eyebrow} title={copy.title} subtitle={copy.subtitle} action={<span className="status-chip"><span className="status-dot"/>{copy.ready}</span>}/>
    <div className="hero-grid">
      <SpotlightCard theme="light" className="hero-card" spotlightColor="#c9a477" intensity={0.13} spotlightSize={390} softness={0.75} borderGlow={0.25}>
        <div className="hero-copy"><div className="hero-kicker"><span className="hero-kicker-dot"/>{locale==="ar"?"منظومة تحريرية ذكية":"INTELLIGENT EDITORIAL SYSTEM"}</div><h2>{locale==="ar"?<>حوّل الفكرة إلى<br/><em>قصة موثّقة.</em></>:<>Turn ideas into<br/><em>verified stories.</em></>}</h2><p>{locale==="ar"?"من التخطيط والبحث إلى الكتابة والمراجعة والنشر المنضبط — في مساحة عمل واحدة.":"Plan, research, write, review, and publish responsibly — all in one workspace."}</p><div className="hero-actions"><button className="primary-button" onClick={onCreate}><Plus size={16}/>{copy.create}<ArrowLeft size={15}/></button><button className="secondary-button" onClick={onRegistry}>{copy.explore}<ArrowUpLeft size={14}/></button></div><div className="hero-trust"><span><CheckCircle2 size={14}/>{locale==="ar"?"مراجعة بشرية":"Human review"}</span><span><ShieldCheck size={14}/>{locale==="ar"?"نشر موثّق":"Verified publishing"}</span></div></div>
        <div className="hero-visual"><EditorialVector/></div>
        <div className="hero-bottomline"><span>MAAROOF / EDITORIAL OS</span><span>01 — 11 / WORKFLOW</span></div>
      </SpotlightCard>
      <div className="hero-side">
        <div className="side-status-card surface-card"><div className="status-card-top"><span className="status-live"><i/> {copy.active}</span><MoreHorizontal size={17}/></div><div className="status-illustration"><div className="status-orbit orbit-a"/><div className="status-orbit orbit-b"/><div className="status-core"><Sparkles size={23}/></div><span className="orbit-dot dot-one"/><span className="orbit-dot dot-two"/><span className="orbit-dot dot-three"/></div><h3>{locale==="ar"?"الأساس التشغيلي":"Operational foundation"}</h3><p>{locale==="ar"?"البنية الأساسية وسجل المنصات جاهزان. محركات الإنتاج والنشر ما زالت قيد التطوير.":"Foundation and platform registry are in place. Editorial engines and publishing are still in development."}</p><div className="status-progress"><span/><b>FOUNDATION</b><strong>V0.3</strong></div></div>
        <div className="quick-action-card surface-card"><span className="tiny-overline">{copy.quick}</span><button onClick={onCreate}><span className="quick-icon"><FilePlus2 size={16}/></span><span><b>{copy.newArticle}</b><small>{locale==="ar"?"ابدأ مهمة تحريرية جديدة":"Start an editorial task"}</small></span><ArrowUpLeft size={15}/></button><button onClick={onRegistry}><span className="quick-icon"><Library size={16}/></span><span><b>{copy.platformRegistry}</b><small>{locale==="ar"?"راجع وجهات النشر":"Review publishing destinations"}</small></span><ArrowUpLeft size={15}/></button></div>
      </div>
    </div>
    <div className="metrics-grid">{metrics.map((item,i)=><SpotlightCard key={item.label} theme="light" className="metric-card" spotlightColor="#b98d5b" intensity={0.1} spotlightSize={200} borderGlow={0.12}><div className="metric-top"><span>{item.label}</span><item.icon size={17}/></div><strong>{item.value}</strong><small>{item.note}</small><span className="metric-index">0{i+1}</span></SpotlightCard>)}</div>
    <div className="home-lower-grid">
      <section className="surface-card pipeline-card"><div className="section-heading"><div><span className="tiny-overline">EDITORIAL PIPELINE</span><h2>{copy.workflow}</h2><p>{copy.workflowSub}</p></div><span className="pipeline-count">11 {locale==="ar"?"مرحلة":"stages"}</span></div><div className="pipeline-rail">{stages.map((stage,i)=><div className={i===0?"pipeline-step active":"pipeline-step"} key={stage}><span className="pipeline-step-dot">{i===0?"01":String(i+1).padStart(2,"0")}</span><small>{stage}</small>{i!==stages.length-1&&<i/>}</div>)}</div><div className="pipeline-caption"><span><i className="legend-dot active-dot"/> {locale==="ar"?"المرحلة المهيأة":"Defined stage"}</span><span><i className="legend-dot"/> {locale==="ar"?"محركات قيد التنفيذ":"Engines pending"}</span></div></section>
      <section className="surface-card recent-card"><div className="section-heading"><div><span className="tiny-overline">WORK QUEUE</span><h2>{copy.recent}</h2></div><button className="text-action" onClick={onViewAll}>{copy.viewAll}<ArrowUpLeft size={14}/></button></div>{articles.length===0?<EmptyArticles copy={copy}/>:<div className="recent-list">{articles.slice(0,4).map(article=><div className="recent-item" key={article.id}><span className="recent-file"><FileText size={16}/></span><span><b>{article.topic}</b><small>{(locale==="ar"?stageLabels:enStageLabels)[article.stage]||article.stage}</small></span><ArrowUpLeft size={14}/></div>)}</div>}</section>
    </div>
    <div className="home-footnote"><span><LockKeyhole size={14}/>{copy.sourceNotice}</span><span>BUILD 0.3.0 <i/> REACT + VITE</span></div>
  </section>;
}

function EditorialVector() {
  return <svg className="editorial-vector" viewBox="0 0 520 390" role="img" aria-label="Abstract editorial workflow vector illustration">
    <defs><linearGradient id="paperFill" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fff" stopOpacity=".98"/><stop offset="1" stopColor="#f0ece4" stopOpacity=".9"/></linearGradient><linearGradient id="goldLine" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#b48a58"/><stop offset="1" stopColor="#e0c49a"/></linearGradient><filter id="softShadow" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="15" stdDeviation="16" floodColor="#9b815f" floodOpacity=".13"/></filter></defs>
    <circle cx="265" cy="190" r="153" fill="none" stroke="#d6c4a8" strokeDasharray="2 9" strokeWidth="1.2"/><circle cx="265" cy="190" r="118" fill="none" stroke="#d9d1c4" strokeDasharray="4 8"/>
    <path d="M90 195 C145 62 350 38 426 174 S362 332 245 319" fill="none" stroke="#c7a77c" strokeWidth="1.4" strokeDasharray="5 7"/>
    <path d="M112 276 C178 346 324 358 408 258" fill="none" stroke="#ded4c5" strokeWidth="1.2"/>
    <g filter="url(#softShadow)" transform="translate(170 62) rotate(-5 105 130)"><rect x="0" y="0" width="210" height="260" rx="15" fill="url(#paperFill)" stroke="#e0d8cc"/><rect x="19" y="20" width="35" height="5" rx="2.5" fill="#c4a579"/><rect x="19" y="43" width="140" height="8" rx="4" fill="#293747"/><rect x="19" y="59" width="165" height="5" rx="2.5" fill="#b8b2a9"/><rect x="19" y="76" width="152" height="5" rx="2.5" fill="#d5d0c8"/><rect x="19" y="104" width="172" height="76" rx="8" fill="#eee9e0"/><path d="M33 159 L60 136 L84 147 L116 118 L145 132 L177 112" fill="none" stroke="#b48a58" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/><circle cx="116" cy="118" r="4" fill="#b48a58"/><rect x="19" y="198" width="90" height="5" rx="2.5" fill="#c7c0b6"/><rect x="19" y="211" width="145" height="5" rx="2.5" fill="#ddd7ce"/><rect x="19" y="230" width="52" height="15" rx="7.5" fill="#e8dfd1"/><text x="45" y="240" fontSize="7" textAnchor="middle" fill="#896a45" fontFamily="Inter">VERIFIED</text></g>
    <g filter="url(#softShadow)"><rect x="42" y="108" width="88" height="60" rx="12" fill="#fff" stroke="#e5ddd0"/><circle cx="61" cy="128" r="6" fill="#d4bd9a"/><path d="M75 126h39M75 137h27M54 151h61" stroke="#c9c2b8" strokeWidth="3" strokeLinecap="round"/><rect x="360" y="242" width="112" height="72" rx="13" fill="#fff" stroke="#e5ddd0"/><circle cx="383" cy="266" r="9" fill="#edf2eb"/><path d="M379 266l3 3 6-7" stroke="#66846d" strokeWidth="1.8" fill="none" strokeLinecap="round"/><path d="M402 263h51M402 275h37M376 294h76" stroke="#c9c2b8" strokeWidth="3" strokeLinecap="round"/></g>
    <g fill="#b68e5c"><circle cx="100" cy="274" r="4"/><circle cx="410" cy="108" r="4"/><circle cx="310" cy="353" r="3"/></g><g fill="none" stroke="url(#goldLine)" strokeWidth="1.5"><path d="M100 274l30-23 20 9"/><path d="M410 108l-22 20-16-2"/></g>
    <g transform="translate(395 58)"><circle cx="23" cy="23" r="22" fill="#fff" stroke="#e5ddd0"/><path d="M23 12v22M12 23h22" stroke="#b48a58" strokeWidth="1.8" strokeLinecap="round"/></g>
  </svg>;
}

function EmptyArticles({copy}:{copy:typeof t.ar}) {
  return <div className="empty-articles"><div className="empty-art"><div className="empty-sheet"><span/><span/><span/></div><div className="empty-plus"><Plus size={16}/></div></div><b>{copy.noArticles}</b><p>{copy.noArticlesSub}</p></div>;
}

function BudgetField({label,hint,value,onChange}:{label:string;hint:string;value:number;onChange:(value:number)=>void}) {
  return <label className="budget-field"><span>{label}</span><small>{hint}</small><input type="number" min="0" max="10000" step="1" value={value} onChange={e=>onChange(Number(e.target.value))}/></label>;
}

function capabilityLabel(value:"yes"|"limited"|"no"|"unverified",locale:Locale) {
  if(locale==="en") return value==="yes"?"Candidate":value==="limited"?"Limited":value==="no"?"Not suitable":"Unverified";
  return value==="yes"?"متاح مبدئياً":value==="limited"?"محدود":value==="no"?"غير مناسب":"غير متحقق";
}

function BrandMark() {
  return <svg viewBox="0 0 40 40" aria-hidden="true"><path d="M8 29V11l12 12 12-12v18" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"/><circle cx="20" cy="20" r="17" fill="none" stroke="currentColor" strokeOpacity=".32"/></svg>;
}
