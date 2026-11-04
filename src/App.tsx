import { useMemo, useState } from "react";
import { Activity, BookOpenText, CheckCircle2, CircleAlert, ExternalLink, FileText, Globe2, Layers3, Search, ShieldCheck, X, LockKeyhole, Workflow, SlidersHorizontal, Save, RotateCcw } from "lucide-react";
import { DEFAULT_RESEARCH_BUDGET, validateResearchBudgetLimits, type ResearchBudgetLimits } from "./domain/research-budget";
import { categoryLabels, modeLabels, platforms, readinessLabels, type PlatformCategory } from "./data/platforms";
import { adapterRegistry } from "./data/adapter-registry";

const categories: Array<"all" | PlatformCategory> = ["all", "editorial", "professional", "community", "knowledge", "research", "developer", "web-data"];

export default function App() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<"all" | PlatformCategory>("all");
  const [selectedId, setSelectedId] = useState<string>("wordpress");
  const [activeView, setActiveView] = useState<"registry" | "research-settings">("registry");
  const [budget, setBudget] = useState<ResearchBudgetLimits>({ ...DEFAULT_RESEARCH_BUDGET });
  const [budgetNotice, setBudgetNotice] = useState("");
  const [adminToken, setAdminToken] = useState("");
  const [budgetBusy, setBudgetBusy] = useState(false);
  const apiBase = (import.meta.env.VITE_API_BASE_URL || "http://localhost:8787").replace(/\\/$/, "");
  const budgetValidation = validateResearchBudgetLimits(budget);
  async function saveBudget() {
    if (!budgetValidation.valid || !adminToken.trim()) return;
    setBudgetBusy(true); setBudgetNotice("");
    try {
      const response = await fetch(`${apiBase}/api/v1/admin/research-limits`, { method: "PUT", headers: { "content-type": "application/json", authorization: `Bearer ${adminToken}` }, body: JSON.stringify({ limits: budget }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "تعذر حفظ الإعدادات");
      setBudget(payload.limits);
      setBudgetNotice("تم حفظ الحدود في خدمة API المستقلة.");
    } catch (error) { setBudgetNotice(error instanceof Error ? error.message : "تعذر الاتصال بالخدمة الخلفية."); }
    finally { setBudgetBusy(false); }
  }
  async function loadBudget() {
    if (!adminToken.trim()) return;
    setBudgetBusy(true); setBudgetNotice("");
    try {
      const response = await fetch(`${apiBase}/api/v1/admin/research-limits`, { headers: { authorization: `Bearer ${adminToken}` } });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "تعذر تحميل الإعدادات");
      setBudget(payload.limits); setBudgetNotice("تم تحميل الحدود المحفوظة من الخدمة الخلفية.");
    } catch (error) { setBudgetNotice(error instanceof Error ? error.message : "تعذر الاتصال بالخدمة الخلفية."); }
    finally { setBudgetBusy(false); }
  }
  const selected = platforms.find((p) => p.id === selectedId);
  const adapter = selected ? adapterRegistry[selected.id] : undefined;
  const visible = useMemo(() => platforms.filter((p) =>
    (category === "all" || p.category === category) &&
    (p.name + " " + p.contentPurpose + " " + p.note).toLowerCase().includes(query.toLowerCase())
  ), [query, category]);

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark">M</div><div><strong>MAAROOF</strong><span>EDITORIAL AGENT</span></div></div>
      <div className="workspace-chip"><span className="status-dot"/> مساحة العمل الرئيسية</div>
      <nav>
        <button className={activeView==="registry"?"nav-item active":"nav-item"} onClick={()=>setActiveView("registry")}><Globe2 size={17}/> سجل المجلات والمنصات</button>
        <button className={activeView==="research-settings"?"nav-item active":"nav-item"} onClick={()=>setActiveView("research-settings")}><SlidersHorizontal size={17}/> حدود البحث والكشط</button>
        <div className="nav-item"><Activity size={17}/> لوحة التحكم</div>
        <div className="nav-item"><FileText size={17}/> المقالات <span className="nav-soon">قريباً</span></div>
        <div className="nav-item"><Layers3 size={17}/> مساحات العمل <span className="nav-soon">لاحقاً</span></div>
        <div className="nav-item"><ShieldCheck size={17}/> النشر والتحقق <span className="nav-soon">لاحقاً</span></div>
      </nav>
      <div className="sidebar-foot">Foundation · v0.2.0<br/>Lovable-compatible · React + Vite</div>
    </aside>
    <main className="main">
      <header className="topbar"><div><span className="eyebrow">EDITORIAL OPERATIONS</span><h1>مركز النشر التحريري</h1><p>سجل المنصات، عقود التكامل، ومتطلبات النشر قبل تشغيل الوكلاء.</p></div><div className="top-status"><span className="status-dot"/> وضع التأسيس — دون Supabase</div></header>
      {activeView === "registry" ? <>
      <section className="stats">
        <article className="stat-card"><div className="stat-icon"><Globe2/></div><span>المنصات المسجلة</span><strong>{platforms.length}</strong><small>من ملف المستخدم</small></article>
        <article className="stat-card"><div className="stat-icon"><BookOpenText/></div><span>وجهات تحريرية</span><strong>{platforms.filter(p=>p.category==="editorial").length}</strong><small>مجلات ومدونات</small></article>
        <article className="stat-card"><div className="stat-icon"><CircleAlert/></div><span>تحتاج مراجعة سياسات</span><strong>{platforms.filter(p=>p.readiness==="policy-review-required").length}</strong><small>قبل النشر أو الأتمتة</small></article>
        <article className="stat-card"><div className="stat-icon"><CheckCircle2/></div><span>موصلات مختبرة</span><strong>0</strong><small>لا توجد عمليات نشر موثقة بعد</small></article>
      </section>
      <section className="panel">
        <div className="panel-heading"><div><h2>Magazine & Platform Registry</h2><p>اختر منصة لعرض نموذج التكامل والمتطلبات والفحوص المطلوبة.</p></div><span className="count-pill">{visible.length} منصة</span></div>
        <div className="toolbar"><div className="search"><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="ابحث عن منصة أو نوع محتوى..." /></div><div className="filters">{categories.map(c=><button key={c} className={category===c?"filter active-filter":"filter"} onClick={()=>setCategory(c)}>{c==="all"?"الكل":categoryLabels[c]}</button>)}</div></div>
        <div className="registry-layout">
          <div className="platform-list">{visible.map(p=><button className={selectedId===p.id?"platform-row selected-platform":"platform-row"} key={p.id} onClick={()=>setSelectedId(p.id)}>
            <div className="platform-logo">{p.name.slice(0,1)}</div><div className="platform-info"><strong>{p.name}</strong><span>{p.contentPurpose}</span><small>{p.note}</small></div>
            <div className="platform-meta"><span className="mode">{modeLabels[p.mode]}</span><span className="readiness">{readinessLabels[p.readiness]}</span></div>
          </button>)}</div>
          {selected && adapter && <aside className="detail-panel">
            <div className="detail-top"><span className="detail-kicker">PLATFORM PROFILE</span><button className="icon-button" onClick={()=>setSelectedId("")} aria-label="إغلاق التفاصيل"><X size={16}/></button></div>
            <div className="detail-title"><div className="platform-logo large-logo">{selected.name.slice(0,1)}</div><div><h3>{selected.name}</h3><span>{selected.contentPurpose}</span></div></div>
            <div className="detail-warning"><LockKeyhole size={15}/><span>النشر الآلي غير مفعّل. هذا الملف يحدد المرشحات والمتطلبات فقط.</span></div>
            <h4>طريقة التكامل المرشحة</h4><div className="detail-value">{adapter.integration==="official-api"?"واجهة API رسمية مرشحة":adapter.integration==="manual"?"تسليم يدوي مع مراجعة بشرية":adapter.integration==="research-only"?"استخدام بحثي فقط": "لم تُحسم بعد"}</div>
            <h4>قدرات النشر</h4>
            <div className="capability-grid"><div><span>إنشاء مقال</span><b>{capabilityLabel(adapter.canCreateArticle)}</b></div><div><span>رفع صور</span><b>{capabilityLabel(adapter.canUploadMedia)}</b></div><div><span>بيانات وصفية</span><b>{capabilityLabel(adapter.canSetMetadata)}</b></div></div>
            <h4>قيود يجب احترامها</h4><ul className="detail-list">{adapter.constraints.map((item,i)=><li key={i}>{item}</li>)}</ul>
            <h4>قائمة التحقق قبل التفعيل</h4><ol className="detail-list numbered">{adapter.verificationChecklist.map((item,i)=><li key={i}>{item}</li>)}</ol>
            {adapter.officialDocsUrl && <a className="docs-link" href={adapter.officialDocsUrl} target="_blank" rel="noreferrer">الوثائق الرسمية <ExternalLink size={14}/></a>}
            <div className="adapter-state"><Workflow size={15}/><span>حالة الموصل: {adapter.implementationStatus==="adapter-not-implemented"?"لم يُبنَ بعد":adapter.implementationStatus==="not-a-publishing-target"?"ليست وجهة نشر صحفي": "سجل أولي فقط"}</span></div>
          </aside>}
        </div>
      </section>
      <section className="next-panel"><div className="next-icon"><Workflow/></div><div><strong>Editorial Workflow Contracts</strong><p>تم تعريف مراحل العمل وواجهات المحركات كعقود TypeScript مستقلة عن قاعدة البيانات. لم يتم ربطها بعد بنماذج مدفوعة أو تنفيذ نشر خارجي.</p></div><span className="contract-badge">Contracts defined</span></section>
      <footer>لا تُفعّل أي منصة قبل مراجعة شروطها، التحقق من الصلاحيات، اختبار المسودة، ثم التحقق من ظهور النتيجة خارج النظام. تصنيف القدرات لا يعني أن الموصل جاهز.</footer>
      </> : <section className="panel budget-admin">
        <div className="panel-heading"><div><h2>Research & Source Limits</h2><p>حدود استهلاك البحث وإضافة المصادر وفحصها لكل مقالة.</p></div><span className="count-pill">Admin controls</span></div>
        <div className="budget-notice"><LockKeyhole size={16}/><span>تُحفظ الإعدادات في خدمة Node المستقلة. لا يوجد تكامل Supabase أو Firecrawl؛ إضافة الروابط تتم كمراجع يدوية دون جلب محتوى المواقع تلقائياً.</span></div>
        <label className="budget-field admin-token-field"><span>مفتاح إدارة الخدمة الخلفية</span><small>أدخل ADMIN_API_TOKEN الذي أعددته في بيئة الخادم. لا يُحفظ في المتصفح.</small><input type="password" autoComplete="off" value={adminToken} onChange={e=>setAdminToken(e.target.value)} placeholder="ADMIN_API_TOKEN"/></label>
        <div className="budget-grid">
          <label className="budget-field"><span>روابط الكشط لكل مقالة</span><small>إجمالي عدد عناوين URL التي يمكن كشطها، حتى لو جُمعت في طلب واحد.</small><input type="number" min="0" max="10000" step="1" value={budget.crawlUrlsPerArticle} onChange={e=>setBudget(v=>({...v,crawlUrlsPerArticle:Number(e.target.value)}))}/></label>
          <label className="budget-field"><span>عمليات البحث لكل مقالة</span><small>عدد استدعاءات Search المسموح بها.</small><input type="number" min="0" max="10000" step="1" value={budget.searchesPerArticle} onChange={e=>setBudget(v=>({...v,searchesPerArticle:Number(e.target.value)}))}/></label>
          <label className="budget-field"><span>عمليات الفحص لكل مقالة</span><small>عدد عمليات Inspect/Extraction المسموح بها.</small><input type="number" min="0" max="10000" step="1" value={budget.inspectionsPerArticle} onChange={e=>setBudget(v=>({...v,inspectionsPerArticle:Number(e.target.value)}))}/></label>
        </div>
        {!budgetValidation.valid && <p className="budget-error">{budgetValidation.errors.join(" · ")}</p>}
        <div className="budget-actions"><button className="filter" onClick={()=>{setBudget({...DEFAULT_RESEARCH_BUDGET});setBudgetNotice("أُعيدت القيم الافتراضية محلياً؛ اضغط حفظ لإرسالها للخادم.");}}><RotateCcw size={14}/> استعادة الافتراضي</button><button className="filter" disabled={!adminToken.trim() || budgetBusy} onClick={loadBudget}>تحميل المحفوظ</button><button className="apply-budget" disabled={!budgetValidation.valid || !adminToken.trim() || budgetBusy} onClick={saveBudget}><Save size={14}/> {budgetBusy?"جارٍ الحفظ...":"حفظ في الخادم"}</button></div>
        {budgetNotice && <p className="budget-feedback">{budgetNotice}</p>}
        <div className="budget-rules"><h3>قواعد تطبيق الميزانية</h3><ul><li>العدادات مستقلة لكل مقالة/مهمة، ولا تتشارك الاستهلاك بين المقالات.</li><li>يُحجز الاستهلاك قبل إرسال الطلب، ولا يُرسل أي طلب بعد بلوغ الحد.</li><li>عند فشل الاستدعاء قبل إتمامه يمكن تحرير الحجز وفق نتيجة التنفيذ.</li><li>الخدمة الحالية تستخدم ملف JSON وحجزاً تسلسلياً داخل عملية Node واحدة؛ لا تشغّل أكثر من نسخة API على ملف البيانات نفسه.</li><li>تغيير الحد لا يمحو الاستهلاك السابق للمقالات قيد التنفيذ.</li></ul></div>
      </section>}
    </main>
  </div>;
}

function capabilityLabel(value: "yes" | "limited" | "no" | "unverified") {
  return value === "yes" ? "متاح مبدئياً" : value === "limited" ? "محدود" : value === "no" ? "غير مناسب" : "غير متحقق";
}
