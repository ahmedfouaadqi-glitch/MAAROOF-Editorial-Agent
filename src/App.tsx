import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  Activity, AlertTriangle, ArrowDownLeft, ArrowLeft, ArrowUpLeft, BookOpenText, Check,
  CheckCircle2, ChevronDown, CircleHelp, FileCheck2, FilePlus2,
  Download, FileText, Globe2, Home, Layers3, LayoutDashboard, Library, ListFilter,
  LoaderCircle, LockKeyhole, Menu, Moon, MoreHorizontal, Plus, Search,
  ShieldCheck, SlidersHorizontal, Sparkles, Sun, Workflow, X, Zap, MessageSquare
} from "lucide-react";
import SpotlightCard from "./components/SpotlightCard";
import EditorialEvidencePanel from "./components/EditorialEvidencePanel";
import AIVisibilityPanel from "./components/AIVisibilityPanel";
import MagazineSubmissionsPanel from "./components/MagazineSubmissionsPanel";
import EditorialDraftPanel from "./components/EditorialDraftPanel";
import EditorialReviewPanel from "./components/EditorialReviewPanel";
import BrowserPublishingPanel from "./components/BrowserPublishingPanel";
import EditorialChatWorkspace, { type ChatTarget, type ChatWorkspace } from "./components/EditorialChatWorkspace";
import type { EditorialChatBrowserDraft } from "./types/editorial-chat";
import { DEFAULT_RESEARCH_BUDGET, validateResearchBudgetLimits, type ResearchBudgetLimits } from "./domain/research-budget";
import { categoryLabels, modeLabels, platforms, readinessLabels, type PlatformCategory } from "./data/platforms";
import { adapterRegistry } from "./data/adapter-registry";
import { magazinePublications } from "./data/magazine-publications";
import editorialTargetCatalog from "../config/editorial-targets.json";

type View = "chat" | "home" | "articles" | "library" | "registry" | "research-settings" | "ai-visibility" | "magazine-submissions";
type Article = { id: string; topic: string; language: string; objective: string; stage: string; createdAt: string; clientId?: string; clientName?: string; brandId?: string; brandName?: string };
type Locale = "ar" | "en";
const NEXT_STAGE: Record<string, string> = { intake: "planning", planning: "research", research: "entity-analysis", "entity-analysis": "outline", outline: "drafting", drafting: "source-review", "source-review": "originality-review", "originality-review": "media-review", "media-review": "editorial-approval", "editorial-approval": "ready-to-publish" };
const categories: Array<"all" | PlatformCategory> = ["all", "editorial", "professional", "community", "knowledge", "research", "developer", "web-data"];
const editorialFormatNamesEn: Record<string, string> = {
  "منشور": "Post", "مقال": "Article", "صورة": "Image", "فيديو": "Video", "ألبوم": "Album",
  "تعليق": "Caption", "قصة": "Story", "ريلز": "Reel", "منشور قصير": "Short post",
  "سلسلة": "Thread", "سلسلة ردود": "Reply thread", "سيناريو فيديو": "Video script",
  "نص شاشة": "On-screen text", "فيديو عمودي": "Vertical video", "عنوان": "Title",
  "وصف": "Description", "مخطط فيديو": "Video outline", "وصف Pin": "Pin description",
  "صورة عمودية": "Vertical image", "مقال طويل": "Long-form article", "نشرة": "Newsletter",
  "تدوينة": "Blog post", "صفحة": "Page", "مقال مهني": "Professional article",
  "تحليل": "Analysis", "رأي": "Opinion", "مقال تقني": "Technical article", "دليل": "Guide",
  "منشور نقاش": "Discussion post", "سؤال": "Question", "إجابة": "Answer", "إجابة تقنية": "Technical answer",
  "مصدر": "Source", "دليل عملي": "Practical guide",
  "مقال قيادي": "Leadership article", "تقرير": "Report", "سيناريو": "Script"
};
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
    workspace: "مساحة العمل الرئيسية", chat: "المحادثة", overview: "نظرة عامة", articles: "المقالات", library: "المكتبة", registry: "المنصات والمجلات",
    research: "البحث والمصادر", visibility: "رصد ظهور الذكاء الاصطناعي", settings: "الإعدادات", help: "المساعدة", search: "ابحث عن منصة أو مجلة...",
    eyebrow: "منظومة العمليات التحريرية", title: "مساحة العمل التحريرية", subtitle: "من الفكرة إلى مقال قابل للمراجعة، ضمن مسار تحريري واضح.",
    create: "إنشاء مقالة", explore: "استعراض المنصات", active: "حالة النموذج", ready: "نموذج أولي",
    platforms: "منصة مسجلة", destinations: "وجهات تحريرية", connectors: "موائمات نشر مفعلة", drafts: "مقالات قيد العمل",
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
    apiKey: "رمز الوصول", apiKeyHint: "أدخل رمز الوصول الذي زوّدك به مسؤول المساحة. يبقى في ذاكرة الجلسة الحالية فقط.",
    load: "تحميل المحفوظ", save: "حفظ الإعدادات", reset: "استعادة الافتراضي", sourceLimit: "روابط المصادر اليدوية لكل مقالة", scrapeLimit: "روابط الكشط لكل مقالة",
    searchLimit: "عمليات البحث لكل مقالة", inspectLimit: "عمليات الفحص لكل مقالة",
    sourceHint: "روابط مرجعية يضيفها المستخدم؛ هذه الحصة منفصلة عن عمليات الكشط.",
    scrapeHint: "عدد صفحات الويب التي يسمح بجلب محتواها عبر Firecrawl لكل مقالة.",
    searchHint: "عدد استعلامات البحث الحي لكل مقالة عبر المزود المفعّل في الخادم.",
    inspectHint: "فحوص بنية المحتوى المستخرج؛ لا تعني التحقق من صحة الادعاءات.",
    newTitle: "إنشاء مهمة تحريرية", newSub: "حدد الموضوع واللغة والهدف. لن يتم النشر الخارجي تلقائياً.",
    topic: "موضوع المقالة", topicPlaceholder: "اكتب الموضوع أو الفكرة الرئيسية...", client: "العميل (اختياري)", clientHint: "اختر اسماً سابقاً أو أدخل عميلاً جديداً.", brand: "العلامة التجارية (اختياري)", brandHint: "العلامة تُسجّل تحت العميل عند تحديده.",
    language: "لغة المقالة", objective: "الهدف التحريري", createTask: "إنشاء المهمة",
    analysis: "تحليل", thought: "قيادة فكرية", news: "خبر", education: "محتوى تعليمي", researchSummary: "ملخص بحثي",
    arabic: "العربية", english: "الإنجليزية", status: "الحالة", stage: "المرحلة",
    sourceNotice: "راجع المصادر والوسائط بنفسك قبل اعتماد المسودة أو متابعة النشر.",
    loading: "جارٍ التحميل...", viewAll: "عرض الكل", light: "الوضع النهاري", dark: "الوضع الليلي",
    langToggle: "English", emptyRegistry: "لم يتم العثور على نتائج مطابقة.",
    policy: "مراجعة السياسات مطلوبة", unverified: "غير متحقق", notBuilt: "لم يُبنَ بعد",
    targetCount: "وجهات نشر محتملة", noClaims: "لا توجد عمليات نشر موثقة", libraryTitle: "مكتبة المسودات", librarySub: "المخرجات المحفوظة من محادثات مساحة العمل، مع سياق الطلب والوجهة.", libraryEmpty: "لا توجد مسودات محفوظة بعد", libraryEmptySub: "عند إنتاج مسودة من المحادثة ستظهر هنا تلقائياً.", libraryOpen: "فتح المحادثة", libraryDownload: "تنزيل Markdown", libraryNoPublish: "هذه مسودات محفوظة وليست منشورات منشورة.", libraryRequest: "الطلب الأصلي", libraryOutput: "المخرج", libraryCreated: "تاريخ الحفظ", libraryLoadError: "تعذر تحميل المكتبة."
  },
  en: {
    workspace: "Main workspace", chat: "Conversation", overview: "Overview", articles: "Articles", library: "Library", registry: "Platforms & magazines",
    research: "Research & sources", visibility: "AI visibility", settings: "Settings", help: "Help", search: "Search platforms or magazines...",
    eyebrow: "EDITORIAL OPERATIONS", title: "Editorial workspace", subtitle: "Move from an idea to a review-ready article through a clear editorial workflow.",
    create: "Create article", explore: "Explore platforms", active: "PROTOTYPE STATUS", ready: "Prototype",
    platforms: "Registered platforms", destinations: "Editorial destinations", connectors: "Active publishing adapters", drafts: "Articles in progress",
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
    apiKey: "Workspace access key", apiKeyHint: "Enter the access key provided by your workspace administrator. Kept in memory for this session only.",
    load: "Load saved", save: "Save settings", reset: "Reset defaults", sourceLimit: "Manually registered source URLs per article", scrapeLimit: "Scraped page URLs per article",
    searchLimit: "Search operations per article", inspectLimit: "Inspection operations per article",
    sourceHint: "Manually registered references; this quota is separate from scraping.",
    scrapeHint: "Maximum number of page URLs fetched through Firecrawl per article.",
    searchHint: "Live search queries allowed per article through the server-enabled provider.",
    inspectHint: "Structural checks of scraped content; not factual verification.",
    newTitle: "Create editorial task", newSub: "Set the topic, language, and objective. No external publishing will happen automatically.",
    topic: "Article topic", topicPlaceholder: "Enter the main topic or idea...", client: "Client (optional)", clientHint: "Choose an existing name or enter a new client.", brand: "Brand (optional)", brandHint: "The brand is recorded under the selected client, if any.",
    language: "Article language", objective: "Editorial objective", createTask: "Create task",
    analysis: "Analysis", thought: "Thought leadership", news: "News", education: "Educational", researchSummary: "Research summary",
    arabic: "Arabic", english: "English", status: "Status", stage: "Stage",
    sourceNotice: "Review sources and media yourself before approving a draft or continuing to publish.",
    loading: "Loading...", viewAll: "View all", light: "Light mode", dark: "Dark mode",
    langToggle: "العربية", emptyRegistry: "No matching platforms found.",
    policy: "Policy review required", unverified: "Unverified", notBuilt: "Not built",
    targetCount: "Potential destinations", noClaims: "No verified publications", libraryTitle: "Draft library", librarySub: "Saved outputs from workspace conversations, with their request and destination context.", libraryEmpty: "No saved drafts yet", libraryEmptySub: "Drafts generated in conversations will appear here automatically.", libraryOpen: "Open conversation", libraryDownload: "Download Markdown", libraryNoPublish: "These are saved drafts, not published posts.", libraryRequest: "Original request", libraryOutput: "Output", libraryCreated: "Saved", libraryLoadError: "Could not load the library."
  }
};

export default function App() {
  const [view, setView] = useState<View>("chat");
  const [query, setQuery] = useState("");
  const [globalQuery, setGlobalQuery] = useState("");
  const [category, setCategory] = useState<"all" | PlatformCategory>("all");
  const [selectedId, setSelectedId] = useState<string>("wordpress");
  const [budget, setBudget] = useState<ResearchBudgetLimits>({ ...DEFAULT_RESEARCH_BUDGET });
  const [budgetNotice, setBudgetNotice] = useState("");
  const [adminToken, setAdminToken] = useState("");
  const [workspaceId, setWorkspaceId] = useState(() => typeof window === "undefined" ? "main-workspace" : (window.localStorage.getItem("editorial-agent.active-workspace") || "main-workspace"));
  const [workspaces, setWorkspaces] = useState<ChatWorkspace[]>([{ id: "main-workspace", name: "مساحة العمل الرئيسية" }]);
  const [workspaceBusy, setWorkspaceBusy] = useState(false);
  const [workspaceNotice, setWorkspaceNotice] = useState("");
  const [workspaceCreateOpen, setWorkspaceCreateOpen] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [busy, setBusy] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [locale, setLocale] = useState<Locale>("ar");
  const [mobileNav, setMobileNav] = useState(false);
  const [browserDrawerOpen, setBrowserDrawerOpen] = useState(false);
  const [browserChatDraft, setBrowserChatDraft] = useState<EditorialChatBrowserDraft | null>(null);
  const browserOpenButtonRef = useRef<HTMLButtonElement>(null);
  const browserCloseButtonRef = useRef<HTMLButtonElement>(null);
  const workspaceListRequestRef = useRef(0);
  const [topic, setTopic] = useState("");
  const [clientName, setClientName] = useState("");
  const [brandName, setBrandName] = useState("");
  const [clientOptions, setClientOptions] = useState<Array<{id:string;name:string}>>([]);
  const [brandOptions, setBrandOptions] = useState<Array<{id:string;name:string;clientId:string|null}>>([]);
  const [language, setLanguage] = useState<"ar" | "en">("ar");
  const [objective, setObjective] = useState("analysis");
  const [articles, setArticles] = useState<Article[]>([]);
  const [pendingConversationId, setPendingConversationId] = useState<string | null>(null);
  const [articleNotice, setArticleNotice] = useState("");
  const [advancingId, setAdvancingId] = useState<string | null>(null);
  const [evidenceArticleId, setEvidenceArticleId] = useState<string | null>(null);
  const [draftArticleId, setDraftArticleId] = useState<string | null>(null);
  const [reviewArticleId, setReviewArticleId] = useState<string | null>(null);
  const apiBase = (import.meta.env.VITE_API_BASE_URL || "http://localhost:8787").replace(/\/$/, "");
  const copy = t[locale];
  const activeWorkspace = workspaces.find(item => item.id === workspaceId);
  const workspaceName = activeWorkspace?.name || (workspaceId === "main-workspace" ? (locale === "ar" ? "مساحة العمل الرئيسية" : "Main workspace") : (locale === "ar" ? "مساحة عمل" : "Workspace"));
  const chatTargets: ChatTarget[] = editorialTargetCatalog.targets.map(target => ({
    id: target.id, name: target.name, type: target.type as ChatTarget["type"],
    description: locale === "ar" ? target.descriptionAr : target.descriptionEn,
    scope: locale === "ar" ? target.scopeAr : target.scopeEn,
    styleSummary: locale === "ar" ? target.styleSummaryAr : target.styleSummaryEn,
    formats: locale === "ar" ? target.formats : target.formats.map(format => editorialFormatNamesEn[format] || format), selectable: target.selectable
  }));
  const normalizeIdentityName=(value:string)=>value.normalize("NFKC").toLocaleLowerCase().trim().replace(/\s+/g," ");
  const selectedClientOption=clientOptions.find(item=>normalizeIdentityName(item.name)===normalizeIdentityName(clientName));
  const clientSuggestions=clientOptions.map(item=>item.name);
  const brandSuggestions=brandOptions.filter(item=>clientName.trim()?Boolean(selectedClientOption&&item.clientId===selectedClientOption.id):!item.clientId).map(item=>item.name);
  const budgetValidation = validateResearchBudgetLimits(budget);
  const selected = platforms.find((p) => p.id === selectedId);
  const adapter = selected ? adapterRegistry[selected.id] : undefined;
  const visible = useMemo(() => platforms.filter((p) =>
    (category === "all" || p.category === category) &&
    (p.name + " " + p.contentPurpose + " " + p.note).toLowerCase().includes(query.toLowerCase())
  ), [query, category]);

  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);
  useEffect(() => { window.localStorage.setItem("editorial-agent.active-workspace", workspaceId); }, [workspaceId]);
  useEffect(() => {
    if (!adminToken.trim()) return;
    let cancelled = false;
    const requestId = ++workspaceListRequestRef.current;
    setWorkspaceBusy(true);
    fetch(`${apiBase}/api/v1/workspaces?locale=${locale}`, { headers: { authorization: `Bearer ${adminToken}` } })
      .then(async response => { const payload = await response.json(); if (!response.ok) throw new Error(payload.error || "Unable to load workspaces"); return payload.workspaces || []; })
      .then((items: ChatWorkspace[]) => {
        if (cancelled || requestId !== workspaceListRequestRef.current || !Array.isArray(items) || !items.length) return;
        setWorkspaces(items);
        setWorkspaceId(current => items.some(item => item.id === current) ? current : items[0].id);
        setWorkspaceNotice("");
      })
      .catch(error => { if (!cancelled) setWorkspaceNotice(error instanceof Error ? error.message : (locale === "ar" ? "تعذر تحميل مساحات العمل." : "Could not load workspaces.")); })
      .finally(() => { if (!cancelled && requestId === workspaceListRequestRef.current) setWorkspaceBusy(false); });
    return () => { cancelled = true; };
  }, [adminToken, apiBase, locale]);
  useEffect(() => {
    if (!browserDrawerOpen) return;
    browserCloseButtonRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setBrowserDrawerOpen(false); };
    window.addEventListener("keydown", closeOnEscape);
    return () => { window.removeEventListener("keydown", closeOnEscape); window.requestAnimationFrame(() => browserOpenButtonRef.current?.focus()); };
  }, [browserDrawerOpen]);
  useEffect(() => {
    if ((view !== "articles" && view !== "magazine-submissions" && !browserDrawerOpen) || !adminToken.trim()) return;
    let cancelled = false;
    fetch(`${apiBase}/api/v1/workspaces/${encodeURIComponent(workspaceId)}/articles`, { headers: { authorization: `Bearer ${adminToken}` } })
      .then(async response => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "تعذر تحميل المقالات");
        if (!cancelled) setArticles(payload.articles || []);
      })
      .catch(error => { if (!cancelled) setArticleNotice(error instanceof Error ? error.message : "تعذر الاتصال بالخدمة الخلفية."); });
    return () => { cancelled = true; };
  }, [view, adminToken, apiBase, browserDrawerOpen, workspaceId]);
  useEffect(() => {
    if (view !== "articles" || !adminToken.trim()) { setClientOptions([]); setBrandOptions([]); return; }
    let cancelled = false;
    const headers = { authorization: `Bearer ${adminToken}` };
    Promise.all([
      fetch(`${apiBase}/api/v1/workspaces/${encodeURIComponent(workspaceId)}/clients`, { headers }).then(async response => { const payload=await response.json(); if(!response.ok) throw new Error(payload.error||"Unable to load clients"); return payload.clients||[]; }),
      fetch(`${apiBase}/api/v1/workspaces/${encodeURIComponent(workspaceId)}/brands`, { headers }).then(async response => { const payload=await response.json(); if(!response.ok) throw new Error(payload.error||"Unable to load brands"); return payload.brands||[]; })
    ]).then(([clients,brands])=>{ if(cancelled)return; setClientOptions(clients); setBrandOptions(brands); }).catch(()=>{ if(!cancelled){setClientOptions([]);setBrandOptions([]);} });
    return ()=>{cancelled=true;};
  }, [view, adminToken, apiBase, workspaceId]);

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

  function openWorkspaceCreation() {
    if (!adminToken.trim()) { setView("research-settings"); return; }
    setNewWorkspaceName("");
    setWorkspaceNotice("");
    setWorkspaceCreateOpen(true);
  }

  async function createWorkspace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!adminToken.trim() || workspaceBusy) return;
    workspaceListRequestRef.current += 1;
    setWorkspaceBusy(true); setWorkspaceNotice("");
    try {
      const response = await fetch(`${apiBase}/api/v1/workspaces`, {
        method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ name: newWorkspaceName })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not create workspace");
      const created = payload.workspace as ChatWorkspace;
      setWorkspaces(current => [...current.filter(item => item.id !== created.id), created]);
      setWorkspaceId(created.id);
      setPendingConversationId(null);
      setArticles([]); setEvidenceArticleId(null); setDraftArticleId(null); setReviewArticleId(null); setClientName(""); setBrandName("");
      setBrowserChatDraft(null); setBrowserDrawerOpen(false); setView("chat"); setMobileNav(false);
      setWorkspaceCreateOpen(false); setNewWorkspaceName("");
    } catch (error) {
      setWorkspaceNotice(error instanceof Error ? error.message : (locale === "ar" ? "تعذر إنشاء مساحة العمل." : "Could not create workspace."));
    } finally { setWorkspaceBusy(false); }
  }

  function switchWorkspace(nextWorkspaceId: string) {
    if (nextWorkspaceId === workspaceId) return;
    setWorkspaceId(nextWorkspaceId);
    setPendingConversationId(null);
    setArticles([]); setEvidenceArticleId(null); setDraftArticleId(null); setReviewArticleId(null); setClientName(""); setBrandName("");
    setBrowserChatDraft(null); setBrowserDrawerOpen(false);
  }

  async function createArticle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!topic.trim() || !adminToken.trim()) {
      setArticleNotice(locale === "ar" ? "أدخل موضوع المقالة، وأضف رمز الوصول من الإعدادات للمتابعة." : "Enter the article topic and add the workspace access key in Settings to continue.");
      return;
    }
    setBusy(true); setArticleNotice("");
    try {
      const response = await fetch(`${apiBase}/api/v1/workspaces/${encodeURIComponent(workspaceId)}/articles`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ topic, language, objective, clientName: clientName.trim(), brandName: brandName.trim() })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "تعذر إنشاء المهمة");
      setArticles(current => [payload.article, ...current]);
      if (payload.article.clientId && payload.article.clientName) setClientOptions(current => current.some(item=>item.id===payload.article.clientId)?current:[...current,{id:payload.article.clientId,name:payload.article.clientName}]);
      if (payload.article.brandId && payload.article.brandName) setBrandOptions(current => current.some(item=>item.id===payload.article.brandId)?current:[...current,{id:payload.article.brandId,name:payload.article.brandName,clientId:payload.article.clientId||null}]);
      setTopic("");
      setArticleNotice(locale === "ar" ? "تم إنشاء المهمة في مرحلة الاستلام." : "Task created in the intake stage.");
    } catch (error) { setArticleNotice(error instanceof Error ? error.message : "تعذر الاتصال بالخدمة الخلفية."); }
    finally { setBusy(false); }
  }

  async function advanceArticle(article: Article) {
    const nextStage = NEXT_STAGE[article.stage];
    if (!nextStage || !adminToken.trim()) return;
    setAdvancingId(article.id); setArticleNotice("");
    try {
      const response = await fetch(`${apiBase}/api/v1/workspaces/${encodeURIComponent(workspaceId)}/articles/${encodeURIComponent(article.id)}/stage`, {
        method: "PUT",
        headers: { "content-type": "application/json", authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ nextStage })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "تعذر تحديث مرحلة المقالة");
      setArticles(current => current.map(item => item.id === article.id ? { ...item, ...payload.article } : item));
      setArticleNotice(locale === "ar" ? "تم الانتقال إلى المرحلة التالية." : "Article advanced to the next stage.");
    } catch (error) { setArticleNotice(error instanceof Error ? error.message : "تعذر تحديث المرحلة."); }
    finally { setAdvancingId(null); }
  }

  const navItems = [
    { id: "chat" as const, label: copy.chat, icon: MessageSquare },
    { id: "home" as const, label: copy.overview, icon: LayoutDashboard },
    { id: "articles" as const, label: copy.articles, icon: FileText },
    { id: "library" as const, label: copy.library, icon: Library },
    { id: "magazine-submissions" as const, label: locale === "ar" ? "تقديمات المجلات" : "Magazine submissions", icon: BookOpenText },
    { id: "registry" as const, label: copy.registry, icon: Globe2 },
    { id: "research-settings" as const, label: copy.settings, icon: SlidersHorizontal },
    { id: "ai-visibility" as const, label: copy.visibility, icon: Activity }
  ];
  const navGroups = [
    { label: locale === "ar" ? "الإنتاج التحريري" : "EDITORIAL", items: navItems.filter(item => ["chat", "home", "articles", "library", "magazine-submissions"].includes(item.id)) },
    { label: locale === "ar" ? "الاستكشاف والأدلة" : "DISCOVERY & EVIDENCE", items: navItems.filter(item => ["registry", "ai-visibility"].includes(item.id)) },
    { label: locale === "ar" ? "الإدارة" : "MANAGEMENT", items: navItems.filter(item => ["research-settings"].includes(item.id)) }
  ];
  const destinationCount = platforms.filter(p => p.category === "editorial").length;

  return <div className={`app-shell ${theme === "dark" ? "theme-dark" : "theme-light"} ${browserDrawerOpen ? "browser-drawer-open" : ""} ${view === "chat" ? "chat-mode" : ""} ${mobileNav ? "navigation-open" : ""}`} dir={locale === "ar" ? "rtl" : "ltr"} lang={locale}>
    <aside className={`sidebar ${mobileNav ? "sidebar-open" : ""}`}>
      <button className="brand" onClick={() => { setView("chat"); setMobileNav(false); }} aria-label={locale==="ar"?"المحادثة التحريرية":"Editorial conversation"}>
        <span className="brand-mark"><BrandMark /></span>
        <span className="brand-copy"><strong>MAAROOF</strong><small>EDITORIAL AGENT</small></span>
        <span className="brand-version">BETA</span>
      </button>
        <div className="workspace-switch" aria-label={copy.workspace}><span className="workspace-avatar">W</span><span><b>{workspaceName}</b><small>{locale === "ar" ? "مساحة تحرير مستقلة" : "Independent editorial workspace"}</small></span></div>
      {navGroups.map(group => <section className="nav-group" key={group.label}>
        <div className="side-label">{group.label}</div>
        <nav className="side-nav">
          {group.items.map(item => <button key={item.id} className={view === item.id ? "nav-item active" : "nav-item"} onClick={() => { setView(item.id); setMobileNav(false); setBrowserDrawerOpen(false); }}>
            <item.icon size={17} strokeWidth={1.8}/><span>{item.label}</span>{item.id === "articles" && articles.length > 0 && <i>{articles.length}</i>}
          </button>)}
        </nav>
      </section>)}
      <div className="sidebar-bottom">
        <div className="sidebar-help"><span className="help-icon"><CircleHelp size={16}/></span><span><b>{copy.help}</b><small>{locale === "ar" ? "دليل استخدام المنصة" : "Product documentation"}</small></span><ArrowUpLeft size={14}/></div>
        <div className="profile-row"><div className="profile-avatar">M</div><div><b>{locale==="ar"?"مساحة معروف":"MAAROOF workspace"}</b><small>{locale === "ar" ? "مساحة تحرير" : "Editorial workspace"}</small></div><MoreHorizontal size={17}/></div>
      </div>
    </aside>
    {mobileNav&&<button className="sidebar-backdrop" aria-label={locale==="ar"?"إغلاق قائمة التنقل":"Close navigation menu"} onClick={()=>setMobileNav(false)}/>}

    <main className="main-area">
      <header className="topbar">
        <div className="topbar-start">
          <button className="mobile-menu" onClick={() => setMobileNav(!mobileNav)} aria-label={locale === "ar" ? "فتح التنقل" : "Open navigation"}><Menu size={19}/></button>
          <div className="breadcrumbs"><span>MAAROOF</span><span className="crumb-slash">/</span><b>{navItems.find(item => item.id === view)?.label}</b></div>
        </div>
        <div className="topbar-actions">
          <label className="global-search"><Search size={15}/><input value={globalQuery} onChange={e=>setGlobalQuery(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"){setQuery(globalQuery);setCategory("all");setView("registry");}}} placeholder={copy.search} aria-label={copy.search}/></label>
          {view !== "chat" && <button ref={browserOpenButtonRef} className={`browser-open-button ${browserDrawerOpen ? "active" : ""}`} onClick={() => { setBrowserChatDraft(null); setBrowserDrawerOpen(true); }} aria-expanded={browserDrawerOpen} aria-controls="browser-agent-panel" aria-label={locale === "ar" ? "فتح مساعد النشر في لوحة جانبية" : "Open publishing assistant side panel"} title={locale === "ar" ? "فتح جلسة المتصفح بجانب مساحة العمل" : "Open the browser beside your workspace"}><Globe2 size={16}/><span>{locale === "ar" ? "المتصفح" : "Browser"}</span><i/></button>}
          <button className="top-icon" onClick={() => setLocale(locale === "ar" ? "en" : "ar")} title={copy.langToggle}><span className="language-code">{locale === "ar" ? "EN" : "ع"}</span></button>
          <button className="top-icon" onClick={() => setTheme(theme === "light" ? "dark" : "light")} title={theme === "light" ? copy.dark : copy.light}>{theme === "light" ? <Moon size={17}/> : <Sun size={17}/>}</button>
          <div className="top-avatar">M</div>
        </div>
      </header>

      <div className={`page-content ${view === "chat" ? "chat-page" : ""}`}>
        {view === "chat" && <EditorialChatWorkspace key={workspaceId} apiBase={apiBase} token={adminToken} workspaceId={workspaceId} workspaceName={workspaceName} workspaces={workspaces} workspaceBusy={workspaceBusy} workspaceNotice={workspaceNotice} onWorkspaceChange={switchWorkspace} onCreateWorkspace={openWorkspaceCreation} locale={locale} targets={chatTargets} onOpenSettings={() => setView("research-settings")} openConversationId={pendingConversationId} onConversationOpened={()=>setPendingConversationId(null)} onPrepareBrowser={draft=>{setBrowserChatDraft(draft);setBrowserDrawerOpen(true);}}/>}
        {view === "library" && <LibraryView apiBase={apiBase} token={adminToken} workspaceId={workspaceId} locale={locale} copy={copy} onOpenConversation={id=>{setPendingConversationId(id);setView("chat");}}/>}
        {view === "home" && <HomeView copy={copy} articles={articles} onCreate={() => setView("articles")} onRegistry={() => setView("registry")} onViewAll={() => setView("articles")} locale={locale} theme={theme}/>}
        {view === "articles" && <section className="page-section">
          <PageHeading eyebrow={locale === "ar" ? "مسار العمل التحريري" : "EDITORIAL WORKFLOW"} title={copy.newTitle} subtitle={copy.newSub} action={<span className="status-chip"><span className="status-dot"/>{locale==="ar"?"قرار النشر بيدك":"You control publishing"}</span>}/>
          <div className="article-layout">
            <SpotlightCard theme={theme} className="surface-card create-card" spotlightColor="#F2C21A" intensity={0.12} spotlightSize={360} borderGlow={0.2}>
              <div className="card-topline"><span className="section-icon"><FilePlus2 size={17}/></span><span className="tiny-overline">{locale === "ar" ? "مهمة تحريرية جديدة" : "NEW EDITORIAL TASK"}</span></div>
              <h2>{copy.newTitle}</h2><p className="muted">{copy.newSub}</p>
              <form className="article-form" onSubmit={createArticle}>
                <label>{copy.topic}<textarea value={topic} onChange={e=>setTopic(e.target.value)} placeholder={copy.topicPlaceholder} rows={4} required minLength={3}/></label>
                <div className="form-pair">
                  <label>{copy.client}<input list="editorial-client-options" value={clientName} onChange={e=>setClientName(e.target.value)} placeholder={copy.clientHint}/><datalist id="editorial-client-options">{clientSuggestions.map(name=><option key={name} value={name}/>)}</datalist></label>
                  <label>{copy.brand}<input list="editorial-brand-options" value={brandName} onChange={e=>setBrandName(e.target.value)} placeholder={copy.brandHint}/><datalist id="editorial-brand-options">{brandSuggestions.map(name=><option key={name} value={name}/>)}</datalist></label>
                </div>
                <div className="form-pair">
                  <label>{copy.language}<select value={language} onChange={e=>setLanguage(e.target.value as "ar"|"en")}><option value="ar">{copy.arabic}</option><option value="en">{copy.english}</option></select></label>
                  <label>{copy.objective}<select value={objective} onChange={e=>setObjective(e.target.value)}><option value="analysis">{copy.analysis}</option><option value="thought-leadership">{copy.thought}</option><option value="news">{copy.news}</option><option value="educational">{copy.education}</option><option value="research-summary">{copy.researchSummary}</option></select></label>
                </div>
                <div className="form-note"><LockKeyhole size={14}/>{copy.sourceNotice}</div>
                <button className="primary-button" type="submit" disabled={busy||!adminToken.trim()}><Plus size={16}/>{busy ? copy.loading : copy.createTask}<ArrowLeft size={15}/></button>
                {articleNotice && <p className="inline-feedback">{articleNotice}</p>}
              </form>
            </SpotlightCard>
            <div className="side-stack">
              <div className={`surface-card token-card workspace-access-card ${adminToken.trim()?"connected":"needs-connection"}`}><div className="card-topline"><span className="section-icon">{adminToken.trim()?<CheckCircle2 size={17}/>:<ShieldCheck size={17}/>}</span><span className="tiny-overline">{locale==="ar"?"مساحة العمل":"WORKSPACE"}</span><span className="access-state"><i/>{adminToken.trim()?(locale==="ar"?"الرمز مُدخل":"Key entered"):(locale==="ar"?"لم يُدخل بعد":"Not entered")}</span></div><h3>{locale==="ar"?"الوصول إلى مساحة العمل":"Workspace access"}</h3><p className="muted">{adminToken.trim()?(locale==="ar"?"الرمز محفوظ في ذاكرة هذه الجلسة؛ يُتحقق منه عند أول طلب.":"The key stays in session memory and is verified on the first request."):(locale==="ar"?"أدخل رمز الوصول من الإعدادات للمتابعة.":"Add the workspace access key in Settings to continue.")}</p><button className="secondary-button" type="button" onClick={()=>setView("research-settings")}>{adminToken.trim()?(locale==="ar"?"إدارة رمز الوصول":"Manage access key"):(locale==="ar"?"فتح الإعدادات":"Open settings")}<ArrowUpLeft size={14}/></button></div>
              <div className="surface-card workflow-mini"><div className="card-title-row"><div><span className="tiny-overline">PIPELINE</span><h3>{copy.workflow}</h3></div><Workflow size={18}/></div><div className="mini-pipeline"><span className="pipeline-node current">01</span><i/><span className="pipeline-node">02</span><i/><span className="pipeline-node">03</span><i/><span className="pipeline-node">04</span></div><div className="pipeline-captions"><span>{locale==="ar"?"استلام":"Intake"}</span><span>{locale==="ar"?"بحث":"Research"}</span><span>{locale==="ar"?"كتابة":"Draft"}</span><span>{locale==="ar"?"مراجعة":"Review"}</span></div></div>
            </div>
          </div>
          <section className="surface-card article-list-card"><div className="section-heading"><div><span className="tiny-overline">{locale==="ar"?"قائمة العمل":"WORK QUEUE"}</span><h2>{copy.recent}</h2></div><span className="count-badge">{articles.length}</span></div>
            {articles.length === 0 ? <EmptyArticles copy={copy}/> : <div className="article-table">{articles.map(article=><div className="article-row" key={article.id}><div className="article-file-icon"><FileText size={17}/></div><div className="article-row-main"><b>{article.topic}</b><small>{article.language.toUpperCase()} · {new Date(article.createdAt).toLocaleDateString(locale === "ar" ? "ar-IQ" : "en-US")}{article.clientName?` · ${article.clientName}`:""}{article.brandName?` / ${article.brandName}`:""}</small></div><span className="stage-pill">{(locale==="ar"?stageLabels:enStageLabels)[article.stage] || article.stage}</span><button className="secondary-button evidence-open-button" onClick={()=>setEvidenceArticleId(evidenceArticleId===article.id?null:article.id)}>{evidenceArticleId===article.id?(locale==="ar"?"إغلاق الأدلة":"Close evidence"):(locale==="ar"?"الأدلة":"Evidence")}</button><button className="secondary-button evidence-open-button" onClick={()=>setDraftArticleId(draftArticleId===article.id?null:article.id)}>{draftArticleId===article.id?(locale==="ar"?"إغلاق المسودة":"Close draft"):(locale==="ar"?"المخطط والمسودة":"Outline / Draft")}</button><button className="secondary-button evidence-open-button" onClick={()=>setReviewArticleId(reviewArticleId===article.id?null:article.id)}>{reviewArticleId===article.id?(locale==="ar"?"إغلاق المراجعة":"Close review"):(locale==="ar"?"المراجعة والاعتماد":"Review / Approve")}</button><button className="advance-button" disabled={!NEXT_STAGE[article.stage]||advancingId===article.id||!adminToken.trim()} onClick={()=>advanceArticle(article)}>{advancingId===article.id?copy.loading:(locale==="ar"?"التالي":"Advance")} <ArrowUpLeft size={12}/></button></div>)}</div>}{articleNotice&&<p className="inline-feedback">{articleNotice}</p>}
          </section>
          {evidenceArticleId && articles.some(article => article.id === evidenceArticleId) && <EditorialEvidencePanel apiBase={apiBase} token={adminToken} workspaceId={workspaceId} article={articles.find(article => article.id === evidenceArticleId)!} locale={locale}/>}
          {draftArticleId && articles.some(article => article.id === draftArticleId) && <EditorialDraftPanel apiBase={apiBase} token={adminToken} workspaceId={workspaceId} taskId={draftArticleId} stage={articles.find(article => article.id === draftArticleId)!.stage} locale={locale}/>}
          {reviewArticleId && articles.some(article => article.id === reviewArticleId) && <EditorialReviewPanel apiBase={apiBase} token={adminToken} workspaceId={workspaceId} taskId={reviewArticleId} stage={articles.find(article => article.id === reviewArticleId)!.stage} locale={locale} onStageChange={(stage)=>setArticles(current=>current.map(item=>item.id===reviewArticleId?{...item,stage}:item))}/>}
        </section>}
        {view === "registry" && <section className="page-section">
          <PageHeading eyebrow={locale==="ar"?"وجهات النشر":"PUBLISHING DESTINATIONS"} title={copy.registryTitle} subtitle={copy.registrySub} action={<span className="status-chip"><Globe2 size={14}/>{platforms.length} {copy.platforms}</span>}/>
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
        {view === "ai-visibility" && <AIVisibilityPanel apiBase={apiBase} token={adminToken} workspaceId={workspaceId} locale={locale}/>}
        {view === "magazine-submissions" && <MagazineSubmissionsPanel apiBase={apiBase} token={adminToken} workspaceId={workspaceId} articles={articles} publications={magazinePublications} locale={locale}/> }
        {view === "research-settings" && <section className="page-section">
          <PageHeading eyebrow={locale==="ar"?"إعدادات النظام":"SYSTEM CONFIGURATION"} title={copy.settingsTitle} subtitle={copy.settingsSub}/>
          <SpotlightCard theme={theme} className="surface-card budget-panel" spotlightColor="#F2C21A" intensity={0.09} spotlightSize={340}>
            <div className="card-topline"><span className="section-icon"><SlidersHorizontal size={17}/></span><span className="tiny-overline">{locale==="ar"?"إدارة البحث والمصادر":"RESEARCH GOVERNANCE"}</span></div>
            <div className="budget-intro"><div><h2>{copy.settingsTitle}</h2><p className="muted">{copy.sourceNotice}</p></div><span className="status-chip"><LockKeyhole size={13}/> {locale==="ar"?"للمسؤول":"Admin only"}</span></div>
            <label className="budget-field token-field"><span>{copy.apiKey}</span><small>{copy.apiKeyHint}</small><input type="password" autoComplete="off" value={adminToken} onChange={e=>setAdminToken(e.target.value)} placeholder={locale==="ar"?"أدخل رمز الوصول":"Enter access key"}/></label>
            <div className="budget-grid">
              <BudgetField label={copy.sourceLimit} hint={copy.sourceHint} value={budget.sourceUrlsPerArticle} onChange={v=>setBudget(old=>({...old,sourceUrlsPerArticle:v}))}/>
              <BudgetField label={copy.scrapeLimit} hint={copy.scrapeHint} value={budget.scrapesPerArticle} onChange={v=>setBudget(old=>({...old,scrapesPerArticle:v}))}/>
              <BudgetField label={copy.searchLimit} hint={copy.searchHint} value={budget.searchesPerArticle} onChange={v=>setBudget(old=>({...old,searchesPerArticle:v}))}/>
              <BudgetField label={copy.inspectLimit} hint={copy.inspectHint} value={budget.inspectionsPerArticle} onChange={v=>setBudget(old=>({...old,inspectionsPerArticle:v}))}/>
            </div>
            {!budgetValidation.valid&&<p className="budget-error">{budgetValidation.errors.join(" · ")}</p>}
            <div className="budget-actions"><button className="secondary-button" onClick={()=>{setBudget({...DEFAULT_RESEARCH_BUDGET});setBudgetNotice(locale==="ar"?"استُعيدت القيم محلياً. احفظ لتثبيتها.":"Defaults restored locally. Save to persist.");}}><ArrowLeft size={14}/>{copy.reset}</button><div><button className="secondary-button" disabled={!adminToken.trim()||busy} onClick={loadBudget}>{copy.load}</button><button className="primary-button" disabled={!budgetValidation.valid||!adminToken.trim()||busy} onClick={saveBudget}><Check size={15}/>{busy?copy.loading:copy.save}</button></div></div>
            {budgetNotice&&<p className="inline-feedback">{budgetNotice}</p>}
            <div className="budget-footnote"><LockKeyhole size={15}/><span>{copy.sourceNotice} {locale==="ar"?"تُطبّق الحصص من الخادم. يلزم إعداد مفتاح Firecrawl للبحث بالكشط؛ ولا تُرسل المفاتيح إلى الواجهة.":"Quotas are enforced server-side. Configure Firecrawl credentials on the server; never expose provider keys to the frontend."}</span></div>
          </SpotlightCard>
        </section>}
      </div>
    </main>
    {workspaceCreateOpen && <div className="workspace-modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget && !workspaceBusy) setWorkspaceCreateOpen(false); }}>
      <form className="workspace-create-modal" role="dialog" aria-modal="true" aria-labelledby="workspace-create-title" onSubmit={createWorkspace}>
        <div className="workspace-modal-top"><span className="workspace-modal-mark"><Layers3 size={18}/></span><button type="button" className="top-icon" onClick={() => setWorkspaceCreateOpen(false)} disabled={workspaceBusy} aria-label={locale === "ar" ? "إغلاق" : "Close"}><X size={17}/></button></div>
        <span className="tiny-overline">{locale === "ar" ? "مساحة مستقلة جديدة" : "NEW INDEPENDENT SPACE"}</span>
        <h2 id="workspace-create-title">{locale === "ar" ? "إنشاء مساحة عمل" : "Create a workspace"}</h2>
        <p>{locale === "ar" ? "تُحفظ محادثاتها ومقالاتها وعلاماتها وملفاتها ضمن مساحة منفصلة." : "Its conversations, articles, brands, and files stay in a separate workspace scope."}</p>
        <label>{locale === "ar" ? "اسم مساحة العمل" : "Workspace name"}<input autoFocus value={newWorkspaceName} onChange={event => setNewWorkspaceName(event.target.value)} minLength={2} maxLength={80} required placeholder={locale === "ar" ? "مثال: علامة الشركة" : "e.g. Acme Brand"}/></label>
        {workspaceNotice && <p className="workspace-modal-error" role="alert">{workspaceNotice}</p>}
        <div className="workspace-modal-actions"><button type="button" className="secondary-button" onClick={() => setWorkspaceCreateOpen(false)} disabled={workspaceBusy}>{locale === "ar" ? "إلغاء" : "Cancel"}</button><button type="submit" className="primary-button" disabled={workspaceBusy || newWorkspaceName.trim().length < 2}>{workspaceBusy ? <LoaderCircle className="editorial-chat-spinner" size={15}/> : <Plus size={15} />}{workspaceBusy ? (locale === "ar" ? "جارٍ الإنشاء" : "Creating") : (locale === "ar" ? "إنشاء وفتح" : "Create & open")}</button></div>
      </form>
    </div>}
    {browserDrawerOpen&&<button className="agent-drawer-backdrop" aria-label={locale==="ar"?"إغلاق لوحة المتصفح":"Close browser panel"} onClick={()=>setBrowserDrawerOpen(false)}/>}
    {browserDrawerOpen&&<aside id="browser-agent-panel" className="agent-drawer" role="complementary" aria-labelledby="browser-drawer-title">
        <header className="agent-drawer-header">
          <div className="agent-drawer-brand"><span className="agent-drawer-mark"><BrandMark/></span><div><span className="tiny-overline">{locale==="ar"?"جلسة تفاعلية":"INTERACTIVE SESSION"}</span><h2 id="browser-drawer-title">{locale==="ar"?"مساعد المتصفح":"Browser assistant"}</h2><p>{locale==="ar"?"افتح الوجهة، سجّل الدخول بنفسك، وراجع قبل المتابعة.":"Open a destination, sign in yourself, and review before continuing."}</p></div></div>
          <button ref={browserCloseButtonRef} className="top-icon agent-drawer-close" onClick={()=>setBrowserDrawerOpen(false)} aria-label={locale==="ar"?"إغلاق اللوحة":"Close panel"}><X size={17}/></button>
        </header>
        <div className="agent-drawer-content"><BrowserPublishingPanel apiBase={apiBase} token={adminToken} workspaceId={workspaceId} articles={articles} locale={locale} chatDraft={browserChatDraft} onOpenSettings={()=>{setBrowserDrawerOpen(false);setView("research-settings");}}/></div>
    </aside>}
  </div>;
}

function PageHeading({eyebrow,title,subtitle,action}:{eyebrow:string;title:string;subtitle:string;action?:ReactNode}) {
  return <div className="page-heading"><div><span className="tiny-overline">{eyebrow}</span><h1>{title}</h1><p>{subtitle}</p></div>{action}</div>;
}

function HomeView({copy,articles,onCreate,onRegistry,onViewAll,locale,theme}:{copy:typeof t.ar;articles:Article[];onCreate:()=>void;onRegistry:()=>void;onViewAll:()=>void;locale:Locale;theme:"light"|"dark"}) {
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
      <SpotlightCard theme={theme} className="hero-card" spotlightColor="#F2C21A" intensity={0.12} spotlightSize={390} softness={0.75} borderGlow={0.2}>
        <div className="hero-copy"><div className="hero-kicker"><span className="hero-kicker-dot"/>{locale==="ar"?"مساحة عمل تحريرية":"EDITORIAL WORKSPACE"}</div><h2>{locale==="ar"?<>حوّل الفكرة إلى<br/><em>مسودة واضحة.</em></>:<>Turn ideas into<br/><em>clear drafts.</em></>}</h2><p>{locale==="ar"?"خطوات تحريرية مرتبة من الفكرة إلى المراجعة، مع بقاء قرار المتابعة والنشر بيدك.":"A clear path from idea to review, with every decision to continue or publish in your hands."}</p><div className="hero-actions"><button className="primary-button" onClick={onCreate}><Plus size={16}/>{copy.create}<ArrowLeft size={15}/></button><button className="secondary-button" onClick={onRegistry}>{copy.explore}<ArrowUpLeft size={14}/></button></div><div className="hero-trust"><span><CheckCircle2 size={14}/>{locale==="ar"?"مراجعة بشرية":"Human review"}</span><span><ShieldCheck size={14}/>{locale==="ar"?"قرار النشر بيدك":"You control publishing"}</span></div></div>
        <div className="hero-visual"><EditorialVector locale={locale}/></div>
        <div className="hero-bottomline"><span>MAAROOF / EDITORIAL OS</span><span>01 — 11 / WORKFLOW</span></div>
      </SpotlightCard>
      <div className="hero-side">
        <div className="side-status-card surface-card"><div className="status-card-top"><span className="status-live"><i/> {copy.active}</span><MoreHorizontal size={17}/></div><div className="status-illustration" aria-hidden="true"><div className="status-orbit orbit-a"/><div className="status-orbit orbit-b"/><div className="status-core"><Sparkles size={23}/></div><span className="orbit-dot dot-one"/><span className="orbit-dot dot-two"/><span className="orbit-dot dot-three"/></div><h3>{locale==="ar"?"النشر":"Publishing"}</h3><p>{locale==="ar"?"هذه نسخة أولية. راجع المقال بنفسك؛ النشر التلقائي غير مفعّل.":"This is a prototype. Review articles yourself; automated publishing is not enabled."}</p><div className="status-progress"><span/><b>{locale==="ar"?"الموائمات":"ADAPTERS"}</b><strong>{locale==="ar"?"غير مفعلة":"OFF"}</strong></div></div>
        <div className="quick-action-card surface-card"><span className="tiny-overline">{copy.quick}</span><button onClick={onCreate}><span className="quick-icon"><FilePlus2 size={16}/></span><span><b>{copy.newArticle}</b><small>{locale==="ar"?"ابدأ مهمة تحريرية جديدة":"Start an editorial task"}</small></span><ArrowUpLeft size={15}/></button><button onClick={onRegistry}><span className="quick-icon"><Library size={16}/></span><span><b>{copy.platformRegistry}</b><small>{locale==="ar"?"راجع وجهات النشر":"Review publishing destinations"}</small></span><ArrowUpLeft size={15}/></button></div>
      </div>
    </div>
    <div className="metrics-grid">{metrics.map((item,i)=><SpotlightCard key={item.label} theme={theme} className="metric-card" spotlightColor="#F2C21A" intensity={0.09} spotlightSize={200} borderGlow={0.1}><div className="metric-top"><span>{item.label}</span><item.icon size={17}/></div><strong>{item.value}</strong><small>{item.note}</small><span className="metric-index">0{i+1}</span></SpotlightCard>)}</div>
    <div className="home-lower-grid">
      <section className="surface-card pipeline-card"><div className="section-heading"><div><span className="tiny-overline">{locale==="ar"?"مراحل التحرير":"EDITORIAL PIPELINE"}</span><h2>{copy.workflow}</h2><p>{copy.workflowSub}</p></div><span className="pipeline-count">11 {locale==="ar"?"مرحلة":"stages"}</span></div><div className="pipeline-rail">{stages.map((stage,i)=><div className={i===0?"pipeline-step active":"pipeline-step"} key={stage}><span className="pipeline-step-dot">{i===0?"01":String(i+1).padStart(2,"0")}</span><small>{stage}</small>{i!==stages.length-1&&<i/>}</div>)}</div><div className="pipeline-caption"><span><i className="legend-dot active-dot"/> {locale==="ar"?"المرحلة المهيأة":"Defined stage"}</span><span><i className="legend-dot"/> {locale==="ar"?"محركات قيد التنفيذ":"Engines pending"}</span></div></section>
      <section className="surface-card recent-card"><div className="section-heading"><div><span className="tiny-overline">{locale==="ar"?"قائمة العمل":"WORK QUEUE"}</span><h2>{copy.recent}</h2></div><button className="text-action" onClick={onViewAll}>{copy.viewAll}<ArrowUpLeft size={14}/></button></div>{articles.length===0?<EmptyArticles copy={copy}/>:<div className="recent-list">{articles.slice(0,4).map(article=><div className="recent-item" key={article.id}><span className="recent-file"><FileText size={16}/></span><span><b>{article.topic}</b><small>{(locale==="ar"?stageLabels:enStageLabels)[article.stage]||article.stage}</small></span><ArrowUpLeft size={14}/></div>)}</div>}</section>
    </div>
    <div className="home-footnote"><span><LockKeyhole size={14}/>{copy.sourceNotice}</span><span>{locale==="ar"?"مراجعة بشرية · النشر بقرارك":"HUMAN REVIEW · YOUR CALL"}</span></div>
  </section>;
}


type LibraryDraft = {
  id: string; conversationId: string; messageId: string; title: string; targetId: string; targetName: string;
  clientName?: string | null; brandName?: string | null; language: "ar" | "en"; request: string; format?: string;
  hook?: string; body?: string; callToAction?: string; hashtags?: string[]; videoScript?: string; onScreenText?: string;
  geo?: { intent?: string; primaryPhrase?: string; supportingTerms?: string[]; questions?: string[]; entities?: string[] };
  mediaNotes?: string; factCheckNotes?: string[]; createdAt: string;
};
function LibraryView({apiBase,token,workspaceId,locale,copy,onOpenConversation}:{apiBase:string;token:string;workspaceId:string;locale:Locale;copy:typeof t.ar;onOpenConversation:(id:string)=>void}) {
  const [items,setItems]=useState<LibraryDraft[]>([]);
  const [selectedId,setSelectedId]=useState("");
  const [loading,setLoading]=useState(false);
  const [notice,setNotice]=useState("");
  const selected=items.find(item=>item.id===selectedId)||items[0];
  useEffect(()=>{
    if(!token.trim()){setItems([]);return;}
    let cancelled=false;
    setLoading(true);setNotice("");
    fetch(`${apiBase}/api/v1/workspaces/${encodeURIComponent(workspaceId)}/library`,{headers:{authorization:`Bearer ${token}`}})
      .then(async response=>{const payload=await response.json();if(!response.ok)throw new Error(payload.error||copy.libraryLoadError);return payload.items||[];})
      .then(data=>{if(!cancelled){setItems(data);setSelectedId(current=>data.some((item:LibraryDraft)=>item.id===current)?current:(data[0]?.id||""));}})
      .catch(error=>{if(!cancelled)setNotice(error instanceof Error?error.message:copy.libraryLoadError);})
      .finally(()=>{if(!cancelled)setLoading(false);});
    return ()=>{cancelled=true;};
  },[apiBase,token,workspaceId,copy.libraryLoadError]);
  function download(item:LibraryDraft){
    const lines=[`# ${item.title}`,`\n**${item.targetName}** · ${item.format||"Draft"} · ${new Date(item.createdAt).toLocaleString(locale==="ar"?"ar-IQ":"en-US")}`,item.clientName?`\nClient: ${item.clientName}`:"",item.brandName?`\nBrand: ${item.brandName}`:"",`\n## ${copy.libraryRequest}`,item.request||"",item.hook?`\n## Hook\n${item.hook}`:"",`\n## ${copy.libraryOutput}`,item.body||"",item.callToAction?`\n## CTA\n${item.callToAction}`:"",item.videoScript?`\n## Video script\n${item.videoScript}`:"",item.onScreenText?`\n## On-screen text\n${item.onScreenText}`:"",item.hashtags?.length?`\n## Hashtags\n${item.hashtags.map(tag=>tag.startsWith("#")?tag:`#${tag}`).join(" ")}`:"",item.geo?.primaryPhrase?`\n## GEO brief\n- Intent: ${item.geo.intent||"—"}\n- Primary phrase: ${item.geo.primaryPhrase}\n- Related terms: ${(item.geo.supportingTerms||[]).join(", ")}\n- Questions: ${(item.geo.questions||[]).join("; ")}\n- Entities: ${(item.geo.entities||[]).join(", ")}`:"",item.factCheckNotes?.length?`\n## Fact-check notes\n${item.factCheckNotes.map(note=>`- ${note}`).join("\n")}`:"",item.mediaNotes?`\n## Media notes\n${item.mediaNotes}`:""].filter(Boolean);
    const blob=new Blob([lines.join("\n\n")],{type:"text/markdown;charset=utf-8"});
    const url=URL.createObjectURL(blob);const anchor=document.createElement("a");anchor.href=url;anchor.download=`${(item.title||"editorial-draft").replace(/[^a-z0-9\u0600-\u06ff-]+/gi,"-").slice(0,70)||"editorial-draft"}.md`;document.body.appendChild(anchor);anchor.click();anchor.remove();window.setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  return <section className="page-section library-view">
    <PageHeading eyebrow="EDITORIAL LIBRARY" title={copy.libraryTitle} subtitle={copy.librarySub} action={<span className="status-chip"><Library size={14}/>{items.length} {locale==="ar"?"مسودة":"drafts"}</span>}/>
    {!token.trim()?<div className="surface-card library-empty"><LockKeyhole size={22}/><b>{copy.apiKey}</b><p>{copy.apiKeyHint}</p></div>:loading?<div className="surface-card library-empty"><span className="loading-dot"/>{copy.loading}</div>:items.length===0?<div className="surface-card library-empty"><div className="empty-art"><div className="empty-sheet"><span/><span/><span/></div></div><b>{copy.libraryEmpty}</b><p>{copy.libraryEmptySub}</p></div>:<div className="library-layout">
      <div className="surface-card library-list"><div className="section-heading"><div><span className="tiny-overline">{locale==="ar"?"المخرجات المحفوظة":"SAVED OUTPUTS"}</span><h2>{copy.libraryTitle}</h2></div><span className="count-badge">{items.length}</span></div>
        {items.map(item=><button type="button" key={item.id} className={`library-item${selected?.id===item.id?" is-active":""}`} onClick={()=>setSelectedId(item.id)}><span className="library-item-icon"><FileText size={17}/></span><span className="library-item-main"><b>{item.title}</b><small>{item.targetName} · {item.format||"Draft"}</small><small>{item.clientName||(locale==="ar"?"غير محدد":"Not specified")}{item.brandName?` / ${item.brandName}`:""}</small></span><small className="library-item-date">{new Date(item.createdAt).toLocaleDateString(locale==="ar"?"ar-IQ":"en-US")}</small></button>)}
      </div>
      {selected&&<article className="surface-card library-detail"><div className="library-detail-top"><div><span className="tiny-overline">{copy.libraryOutput}</span><h2>{selected.title}</h2><p>{selected.targetName} · {selected.format||"Draft"} · {new Date(selected.createdAt).toLocaleString(locale==="ar"?"ar-IQ":"en-US")}</p></div><span className="status-chip">{selected.language.toUpperCase()}</span></div>
        <div className="library-context"><span>{selected.clientName||(locale==="ar"?"غير محدد":"Not specified")}</span>{selected.brandName&&<span>{selected.brandName}</span>}</div>
        <section className="library-section"><h3>{copy.libraryRequest}</h3><p>{selected.request||"—"}</p></section>
        {selected.hook&&<section className="library-section"><h3>{locale==="ar"?"الافتتاحية":"Hook"}</h3><p>{selected.hook}</p></section>}
        <section className="library-section"><h3>{copy.libraryOutput}</h3><div className="library-body">{selected.body||"—"}</div></section>
        {selected.callToAction&&<section className="library-section"><h3>{locale==="ar"?"دعوة للتفاعل":"Call to action"}</h3><p>{selected.callToAction}</p></section>}
        {selected.videoScript&&<section className="library-section"><h3>{locale==="ar"?"سيناريو الفيديو":"Video script"}</h3><p>{selected.videoScript}</p></section>}
        {selected.geo?.primaryPhrase&&<section className="library-section"><h3>GEO</h3><p>{selected.geo.primaryPhrase}</p><small>{(selected.geo.supportingTerms||[]).join(" · ")}</small></section>}
        {!!selected.factCheckNotes?.length&&<section className="library-warning"><AlertTriangle size={15}/><div><b>{locale==="ar"?"نقاط تحتاج إلى تحقق":"Needs verification"}</b><ul>{selected.factCheckNotes.map((note,index)=><li key={index}>{note}</li>)}</ul></div></section>}
        <p className="library-truth-note"><ShieldCheck size={14}/>{copy.libraryNoPublish}</p>
        <div className="library-actions"><button type="button" className="primary-button" onClick={()=>download(selected)}><Download size={15}/>{copy.libraryDownload}</button><button type="button" className="secondary-button" onClick={()=>onOpenConversation(selected.conversationId)}><MessageSquare size={15}/>{copy.libraryOpen}</button></div>
      </article>}
    </div>}
    {notice&&<p className="inline-feedback" role="status">{notice}</p>}
  </section>;
}

function EditorialVector({locale}:{locale:Locale}) {
  return <svg className="editorial-vector" viewBox="0 0 520 390" role="img" aria-label={locale==="ar"?"رسم خطي لمسار تحرير المقال":"Linear illustration of an editorial workflow"}>
    <path d="M61 284V138l32-32M447 105l25 25v160" fill="none" stroke="var(--line-strong)" strokeWidth="1.4" strokeDasharray="2 7" strokeLinecap="round"/>
    <path d="M62 283h43M447 290h-41" fill="none" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round"/>
    <g transform="translate(151 38) rotate(-3 108 148)">
      <path d="M0 0h163l47 47v245H0z" fill="var(--surface)" stroke="var(--text-strong)" strokeWidth="1.6" strokeLinejoin="round"/>
      <path d="M163 0v48h47" fill="var(--surface-soft)" stroke="var(--text-strong)" strokeWidth="1.4" strokeLinejoin="round"/>
      <path d="M18 23h33" stroke="var(--accent)" strokeWidth="5" strokeLinecap="round"/>
      <text x="18" y="48" fontFamily="Inter" fontSize="7" fontWeight="700" letterSpacing="1.1" fill="var(--muted-strong)">EDITORIAL NOTE / 01</text>
      <path d="M18 69h137M18 82h116" fill="none" stroke="var(--text-strong)" strokeWidth="4.2" strokeLinecap="round"/>
      <path d="M18 98h158" fill="none" stroke="var(--line-strong)" strokeWidth="1.2"/>
      <rect x="18" y="114" width="174" height="69" rx="4" fill="var(--surface-soft)" stroke="var(--line-strong)" strokeWidth="1"/>
      <path d="M29 132h39m-39 10h115m-115 10h84" fill="none" stroke="var(--text-strong)" strokeWidth="2.4" strokeLinecap="round"/>
      <path d="M29 166h127" fill="none" stroke="var(--accent)" strokeWidth="3.3" strokeLinecap="round"/>
      <path d="M18 202h42m12 0h19m12 0h69" fill="none" stroke="var(--line-strong)" strokeWidth="2" strokeLinecap="round"/>
      <rect x="18" y="221" width="174" height="1" fill="var(--line-strong)"/>
      <text x="18" y="242" fontFamily="Inter" fontSize="7" fontWeight="700" letterSpacing=".9" fill="var(--muted-strong)">SOURCE</text>
      <text x="98" y="242" fontFamily="Inter" fontSize="7" fontWeight="700" letterSpacing=".9" fill="var(--muted-strong)">REVIEW</text>
      <path d="M18 251h58m22 0h73" stroke="var(--text-strong)" strokeWidth="2.4" strokeLinecap="round"/>
      <rect x="18" y="267" width="51" height="16" rx="3" fill="var(--accent)"/>
      <text x="43.5" y="278" textAnchor="middle" fontFamily="Inter" fontSize="6.5" fontWeight="800" letterSpacing=".6" fill="#171717">DRAFT</text>
    </g>
    <g transform="translate(33 122)">
      <path d="M8 0h94v62H8z" fill="var(--surface)" stroke="var(--text-strong)" strokeWidth="1.4"/>
      <path d="M8 0h19v6H8z" fill="var(--accent)"/>
      <circle cx="24" cy="25" r="7" fill="var(--accent)"/>
      <path d="M41 22h42M18 43h64M18 53h38" fill="none" stroke="var(--line-strong)" strokeWidth="2.4" strokeLinecap="round"/>
      <text x="18" y="17" fontFamily="Inter" fontSize="5.5" fontWeight="700" fill="var(--muted-strong)">SOURCE / 02</text>
    </g>
    <g transform="translate(373 237)">
      <path d="M0 11h105v66H0z" fill="var(--surface)" stroke="var(--text-strong)" strokeWidth="1.4"/>
      <path d="M17 34l7 7 15-17" fill="none" stroke="var(--accent)" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M51 31h37M17 56h71M17 67h43" fill="none" stroke="var(--line-strong)" strokeWidth="2.6" strokeLinecap="round"/>
      <text x="17" y="17" fontFamily="Inter" fontSize="5.5" fontWeight="700" fill="var(--muted-strong)">HUMAN REVIEW</text>
    </g>
    <path d="M113 287l25-22m269-166l-18 20" fill="none" stroke="var(--text-strong)" strokeWidth="1.5" strokeLinecap="round"/>
    <circle cx="113" cy="287" r="4" fill="var(--accent)"/><circle cx="389" cy="119" r="4" fill="var(--text-strong)"/>
    <g transform="translate(324 308) rotate(-43)">
      <path d="M0 0h66v10H0z" fill="var(--text-strong)"/>
      <path d="M66 0l12 5-12 5z" fill="var(--accent)" stroke="var(--text-strong)" strokeWidth="1" strokeLinejoin="round"/>
      <path d="M10 0v10" stroke="var(--accent)" strokeWidth="2"/>
    </g>
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
  return <svg viewBox="0 0 40 40" aria-hidden="true">
    <path d="M10 5.5h14l7 7V34H10z" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round"/>
    <path d="M24 5.5V13h7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round"/>
    <path d="M15 18h11M15 23h11M15 28h7" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round"/>
    <path d="M28 26.5l3.5 3.5-5.5 4.5-3.5.5.5-3.5z" fill="#F2C21A" stroke="#171717" strokeWidth="1.1" strokeLinejoin="round"/>
  </svg>;
}
