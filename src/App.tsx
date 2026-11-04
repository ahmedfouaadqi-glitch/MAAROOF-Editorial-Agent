import { useMemo, useState } from "react";
import { Activity, BookOpenText, CheckCircle2, CircleAlert, ExternalLink, FileText, Globe2, Layers3, Search, ShieldCheck } from "lucide-react";
import { categoryLabels, modeLabels, platforms, readinessLabels, type PlatformCategory } from "./data/platforms";

const categories: Array<"all" | PlatformCategory> = ["all", "editorial", "professional", "community", "knowledge", "research", "developer", "web-data"];

export default function App() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<"all" | PlatformCategory>("all");
  const visible = useMemo(() => platforms.filter((p) =>
    (category === "all" || p.category === category) &&
    (p.name + " " + p.contentPurpose + " " + p.note).toLowerCase().includes(query.toLowerCase())
  ), [query, category]);

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark">M</div><div><strong>MAAROOF</strong><span>EDITORIAL AGENT</span></div></div>
      <div className="workspace-chip"><span className="status-dot"/> مساحة العمل الرئيسية</div>
      <nav>
        <a className="nav-item active"><Activity size={17}/> لوحة التحكم</a>
        <a className="nav-item"><FileText size={17}/> المقالات</a>
        <a className="nav-item"><Globe2 size={17}/> سجل المجلات والمنصات</a>
        <a className="nav-item"><Layers3 size={17}/> مساحات العمل</a>
        <a className="nav-item"><ShieldCheck size={17}/> النشر والتحقق</a>
      </nav>
      <div className="sidebar-foot">Foundation · v0.1.0<br/>Lovable-compatible · React + Vite</div>
    </aside>
    <main className="main">
      <header className="topbar"><div><span className="eyebrow">EDITORIAL OPERATIONS</span><h1>مركز النشر التحريري</h1><p>إدارة وجهات النشر، جاهزية التكامل، وسير العمل التحريري.</p></div><div className="top-status"><span className="status-dot"/> النظام في وضع التأسيس</div></header>
      <section className="stats">
        <article className="stat-card"><div className="stat-icon"><Globe2/></div><span>المنصات المسجلة</span><strong>{platforms.length}</strong><small>من الملف المرفق</small></article>
        <article className="stat-card"><div className="stat-icon"><BookOpenText/></div><span>وجهات تحريرية</span><strong>{platforms.filter(p=>p.category==="editorial").length}</strong><small>مجلات ومدونات</small></article>
        <article className="stat-card"><div className="stat-icon"><CircleAlert/></div><span>تحتاج مراجعة سياسات</span><strong>{platforms.filter(p=>p.readiness==="policy-review-required").length}</strong><small>قبل أي نشر أو أتمتة</small></article>
        <article className="stat-card"><div className="stat-icon"><CheckCircle2/></div><span>موصلات مكتملة</span><strong>0</strong><small>لم يتم اختبار نشر فعلي بعد</small></article>
      </section>
      <section className="panel">
        <div className="panel-heading"><div><h2>Magazine & Platform Registry</h2><p>قائمة أولية مصنفة؛ حالة النشر لا تُعد مؤكدة قبل اختبار مستقل.</p></div><span className="count-pill">{visible.length} منصة</span></div>
        <div className="toolbar"><div className="search"><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="ابحث عن منصة أو نوع محتوى..." /></div><div className="filters">{categories.map(c=><button key={c} className={category===c?"filter active-filter":"filter"} onClick={()=>setCategory(c)}>{c==="all"?"الكل":categoryLabels[c]}</button>)}</div></div>
        <div className="platform-list">{visible.map(p=><article className="platform-row" key={p.id}>
          <div className="platform-logo">{p.name.slice(0,1)}</div><div className="platform-info"><strong>{p.name}</strong><span>{p.contentPurpose}</span><small>{p.note}</small></div>
          <div className="platform-meta"><span className="mode">{modeLabels[p.mode]}</span><span className="readiness">{readinessLabels[p.readiness]}</span></div>
        </article>)}</div>
      </section>
      <footer>تنبيه: تسجيل المنصة لا يعني أن النشر الآلي متاح أو مسموح. لا يُفعّل أي موصل قبل مراجعة شروط المنصة واختبار المسودة والتحقق من النتيجة.</footer>
    </main>
  </div>;
}