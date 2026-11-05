import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { ArrowUp, Check, ChevronDown, Download, File, FileText, Globe2, Image, LoaderCircle, Mail, MessageSquare, MessagesSquare, Newspaper, Plus, Search, Settings, Upload, Video, X, AlertTriangle, Sparkles } from "lucide-react";
import type { EditorialChatBrowserDraft } from "../types/editorial-chat";

export type ChatTarget = {
  id: string; name: string; type: "social" | "magazine"; description: string; scope: string;
  styleSummary: string; formats: string[]; selectable: boolean;
};
type Attachment = { id: string; originalName?: string; name?: string; kind?: string; mimeType?: string; sizeBytes?: number };
type DraftResult = {
  kind?: string; targetId?: string; targetName?: string; needsReview?: boolean; limitations?: string[];
  similarity?: { exactMatches?: unknown[]; nearMatches?: Array<{ title?: string; similarity?: number }> };
  usage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number } | null;
  draft?: { title?: string; hook?: string; body?: string; callToAction?: string; hashtags?: string[]; videoScript?: string; onScreenText?: string; format?: string; geo?: { intent?: string; primaryPhrase?: string; supportingTerms?: string[]; questions?: string[]; entities?: string[] }; mediaNotes?: string; factCheckNotes?: string[] };
};
type ChatMessage = { id: string; role?: string; content?: string; createdAt?: string; targetId?: string; result?: DraftResult; attachments?: Attachment[] };
type RunStep = { id: string; label: string; status: "pending" | "running" | "completed" | "skipped" | "needs-review" | "failed"; note?: string };
type ActiveRun = { id: string; status: "queued" | "running" | "completed" | "failed" | "cancelled"; metadata?: { steps?: RunStep[]; totalSteps?: number; completedSteps?: number } };
type Conversation = { id: string; title?: string; updatedAt?: string; createdAt?: string; messages?: ChatMessage[]; targetId?: string; clientName?: string; brandName?: string; activeRun?: ActiveRun | null };
type PendingFile = { file: File; preview: string };

const ACCEPTED_TYPES = new Set([
  "image/jpeg", "image/png", "image/webp", "video/mp4", "video/webm", "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "text/plain"
]);
const ACCEPTED_EXTENSIONS = /\.(jpe?g|png|webp|mp4|webm|pdf|docx|txt|md)$/i;

export default function EditorialChatWorkspace({ apiBase, token, workspaceId, locale, targets, onOpenSettings, onPrepareBrowser }: {
  apiBase: string; token: string; workspaceId: string; locale: "ar" | "en"; targets: ChatTarget[]; onOpenSettings: () => void; onPrepareBrowser?: (draft: EditorialChatBrowserDraft) => void;
}) {
  const ar = locale === "ar";
  const t = ar ? {
    history: "سجل المحادثات", newChat: "محادثة جديدة", search: "ابحث في الوجهات...", choose: "اختر منصة أو مجلة",
    emptyTitle: "ما الذي تريد إنجازه؟", emptySub: "ابدأ بطلبك مباشرة أو اختر مثالاً جاهزاً وعدّله. حدّد الوجهة وأرفق الملفات عند الحاجة.", startersTitle: "ابدأ من مثال", starterArticle: "كتابة مقال", starterArticleHint: "مقال منظم قابل للمراجعة", starterPost: "منشور مهني", starterPostHint: "فكرة واضحة لجمهور LinkedIn", starterVideo: "سيناريو فيديو", starterVideoHint: "خطاف ومشاهد ونص شاشة", starterNewsletter: "نشرة تحريرية", starterNewsletterHint: "مقدمة ومحتوى موجّه للقراء",
    placeholder: "اكتب ما تريد صياغته أو تطويره...", send: "إرسال", attach: "إرفاق ملفات", noHistory: "لا توجد محادثات بعد.",
    settings: "أدخل رمز الوصول من الإعدادات لاستخدام المحادثات.", goSettings: "فتح الإعدادات", loading: "جارٍ التحميل...",
    social: "منصات اجتماعية", magazine: "مجلات ومواقع نشر", target: "الوجهة التحريرية", noTargets: "لا توجد وجهات مطابقة.",
    error: "تعذّر إكمال الطلب. حاول مجدداً.", scope: "النطاق", style: "الأسلوب", formats: "الصيغ", identity: "سياق العميل والعلامة",
    client: "العميل (اختياري)", brand: "العلامة (اختياري)", identityHint: "يُستخدم هذا السياق لفحص التكرار داخل مساحة العمل.",
    removeFile: "حذف الملف", invalidFile: "نوع الملف غير مدعوم. استخدم صورة أو فيديو MP4/WebM أو PDF أو DOCX أو TXT.", fileLimit: "الحد الأعلى 10 مرفقات في الرسالة الواحدة.", download: "تنزيل المرفق",
    uploading: "جارٍ رفع الملفات...", run: "مسار التحرير", queued: "قيد الانتظار", running: "جارٍ العمل", completed: "اكتمل",
    failed: "تعذر الإكمال", cancelled: "أُلغي", pending: "بانتظار التنفيذ", skipped: "لم يُنفّذ", needsReview: "يتطلب مراجعة",
    draft: "المسودة", geo: "موجز GEO", intent: "نية البحث", primary: "العبارة الأساسية", related: "عبارات داعمة", questions: "أسئلة متوقعة", entities: "كيانات ذات صلة",
    cta: "دعوة للتفاعل", hashtags: "وسوم", mediaNotes: "ملاحظات الوسائط", factChecks: "نقاط تحتاج إلى تحقق", limitations: "حدود هذه المسودة",
    similarity: "تنبيه التشابه: راجع المسودات المشابهة قبل الاستخدام.", providerFailed: "لم يتم النشر. أعد إعداد مزود النموذج المستقل على الخادم ثم حاول مجدداً.",
    wait: "انتظر اكتمال المسار الحالي قبل إرسال طلب آخر.", noTarget: "اختر منصة أو مجلة أولاً.", noClient: "غير محدد", openSettings: "إعداد النموذج يتم على الخادم، لا في هذه الشاشة.",
    note: "المسودة لا تُنشر تلقائياً. البحث والكشط الخارجي غير منفّذين في هذه المرحلة.", start: "ابدأ التحرير", runningNote: "تظهر الخطوات المنفذة والمتخطاة بوضوح؛ لا يتم النشر من هنا.", browserHandoff: "المتابعة في المتصفح", browserHandoffHint: "تسجيل الدخول والإدراج اختياريان؛ لن يُضغط زر النشر."
  } : {
    history: "Conversation history", newChat: "New conversation", search: "Search destinations...", choose: "Choose a platform or magazine",
    emptyTitle: "What do you want to accomplish?", emptySub: "Start with your own request or choose an editable example. Select a destination and attach files when useful.", startersTitle: "Start from an example", starterArticle: "Write an article", starterArticleHint: "A structured, review-ready article", starterPost: "Professional post", starterPostHint: "A focused idea for LinkedIn", starterVideo: "Video script", starterVideoHint: "Hook, scenes and on-screen text", starterNewsletter: "Editorial newsletter", starterNewsletterHint: "A reader-focused opening and body",
    placeholder: "Describe what you want to create or adapt...", send: "Send", attach: "Attach files", noHistory: "No conversations yet.",
    settings: "Add the workspace access key in Settings to use conversations.", goSettings: "Open settings", loading: "Loading...",
    social: "Social platforms", magazine: "Magazines & publishers", target: "Editorial destination", noTargets: "No matching destinations.",
    error: "The request failed. Please try again.", scope: "Scope", style: "Style", formats: "Formats", identity: "Client and brand context",
    client: "Client (optional)", brand: "Brand (optional)", identityHint: "This context scopes duplicate checks within the workspace.",
    removeFile: "Remove file", invalidFile: "Unsupported file type. Use an image, MP4/WebM video, PDF, DOCX, or TXT.", fileLimit: "A message can contain at most 10 attachments.", download: "Download attachment",
    uploading: "Uploading files...", run: "Editorial workflow", queued: "Queued", running: "Working", completed: "Completed",
    failed: "Could not complete", cancelled: "Cancelled", pending: "Pending", skipped: "Not run", needsReview: "Needs review",
    draft: "Draft", geo: "GEO brief", intent: "Search intent", primary: "Primary phrase", related: "Related terms", questions: "Likely questions", entities: "Related entities",
    cta: "Call to action", hashtags: "Hashtags", mediaNotes: "Media notes", factChecks: "Fact-check notes", limitations: "Draft limitations",
    similarity: "Similarity alert: review matching drafts before use.", providerFailed: "Nothing was published. Configure the independent model provider on the server, then try again.",
    wait: "Wait for the current workflow to finish before sending another request.", noTarget: "Choose a platform or magazine first.", noClient: "Not specified", openSettings: "Model setup is server-side, not on this screen.",
    note: "Drafts are not published automatically. External search and crawling are not run at this stage.", start: "Start editing", runningNote: "Completed and skipped steps are clearly marked; nothing is published here.", browserHandoff: "Continue in browser", browserHandoffHint: "Sign-in and insertion are optional; Publish will not be clicked."
  };
  const errorText = ar ? "تعذّر إكمال الطلب. حاول مجدداً." : "The request failed. Please try again.";
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [targetId, setTargetId] = useState("");
  const [clientName, setClientName] = useState("");
  const [brandName, setBrandName] = useState("");
  const [identityOpen, setIdentityOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [content, setContent] = useState("");
  const [files, setFiles] = useState<PendingFile[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const filesRef = useRef<PendingFile[]>([]);
  const base = `${apiBase.replace(/\/$/, "")}/api/v1/workspaces/${encodeURIComponent(workspaceId)}/conversations`;
  const selectedTarget = targets.find(item => item.id === targetId);
  const visibleTargets = useMemo(() => targets.filter(item => item.selectable && `${item.name} ${item.description} ${item.scope} ${item.styleSummary} ${item.formats.join(" ")}`.toLocaleLowerCase().includes(query.toLocaleLowerCase())), [targets, query]);

  const request = useCallback(async (url: string, init: RequestInit = {}) => {
    const response = await fetch(url, { ...init, headers: { authorization: `Bearer ${token}`, ...(init.headers || {}) } });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(typeof payload.error === "string" ? payload.error : errorText);
    return payload;
  }, [token, errorText]);

  const loadList = useCallback(async () => {
    if (!token.trim()) return;
    try {
      const data = await request(base);
      setConversations(Array.isArray(data.conversations) ? data.conversations : []);
    } catch (error) { setNotice(error instanceof Error ? error.message : errorText); }
  }, [base, request, token, errorText]);

  useEffect(() => { void loadList(); }, [loadList]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, conversation?.activeRun?.metadata?.steps]);
  useEffect(() => { filesRef.current = files; }, [files]);
  useEffect(() => () => filesRef.current.forEach(item => { if (item.preview) URL.revokeObjectURL(item.preview); }), []);

  useEffect(() => {
    if (!conversation?.id || !conversation.activeRun || !["queued", "running"].includes(conversation.activeRun.status)) return;
    let cancelled = false;
    const refresh = async () => {
      try {
        const data = await request(`${base}/${encodeURIComponent(conversation.id)}`);
        if (cancelled) return;
        const value = data.conversation || data;
        setConversation(value);
        setMessages(Array.isArray(value.messages) ? value.messages : []);
        void loadList();
      } catch (error) { if (!cancelled) setNotice(error instanceof Error ? error.message : errorText); }
    };
    const timer = window.setInterval(() => { void refresh(); }, 1200);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [base, conversation?.id, conversation?.activeRun?.id, conversation?.activeRun?.status, loadList, request, errorText]);

  async function openConversation(item: Conversation) {
    setLoading(true); setNotice(""); setIdentityOpen(false);
    try {
      const data = await request(`${base}/${encodeURIComponent(item.id)}`);
      const value = data.conversation || data;
      setConversation(value); setMessages(Array.isArray(value.messages) ? value.messages : []);
      setTargetId(value.targetId || ""); setClientName(value.clientName || ""); setBrandName(value.brandName || "");
    } catch (error) { setNotice(error instanceof Error ? error.message : errorText); }
    finally { setLoading(false); }
  }

  function startNew() {
    setConversation(null); setMessages([]); setTargetId(""); setClientName(""); setBrandName(""); setIdentityOpen(false); setContent(""); setNotice("");
    setFiles(current => { current.forEach(item => { if (item.preview) URL.revokeObjectURL(item.preview); }); return []; });
  }

  function useStarter(target: string, prompt: string) {\n    setTargetId(target);\n    setContent(prompt);\n    setNotice("");\n    setPickerOpen(false);\n  }\n\n  function addFiles(list: FileList | null) {
    if (!list) return;
    const remaining = Math.max(0, 10 - files.length);
    if (remaining === 0) { setNotice(t.fileLimit); return; }
    const valid: PendingFile[] = [];
    for (const file of Array.from(list)) {
      const supported = ACCEPTED_TYPES.has(file.type) || ACCEPTED_EXTENSIONS.test(file.name);
      if (!supported) { setNotice(t.invalidFile); continue; }
      valid.push({ file, preview: file.type.startsWith("image/") ? URL.createObjectURL(file) : "" });
    }
    if (valid.length > remaining) setNotice(t.fileLimit);
    if (valid.length) setFiles(current => [...current, ...valid.slice(0, remaining)]);
    if (fileRef.current) fileRef.current.value = "";
  }
  function removeFile(index: number) {
    setFiles(current => { if (current[index]?.preview) URL.revokeObjectURL(current[index].preview); return current.filter((_, i) => i !== index); });
  }

  async function downloadAttachment(attachment: Attachment) {
    if (!conversation?.id) return;
    try {
      const response = await fetch(`${base}/${encodeURIComponent(conversation.id)}/attachments/${encodeURIComponent(attachment.id)}/file`, { headers: { authorization: `Bearer ${token}` } });
      if (!response.ok) throw new Error(errorText);
      const objectUrl = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = objectUrl; link.download = attachment.originalName || "attachment";
      document.body.appendChild(link); link.click(); link.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 5000);
    } catch (error) { setNotice(error instanceof Error ? error.message : errorText); }
  }

  async function sendMessage(event: FormEvent) {
    event.preventDefault();
    if (busy || (!content.trim() && files.length === 0) || !token.trim()) return;
    if (!targetId) { setNotice(t.noTarget); setPickerOpen(true); return; }
    if (conversation?.activeRun && ["queued", "running"].includes(conversation.activeRun.status)) { setNotice(t.wait); return; }
    setBusy(true); setNotice("");
    try {
      let active = conversation;
      if (!active) {
        const created = await request(base, {
          method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ targetId, language: locale, clientName: clientName.trim() || undefined, brandName: brandName.trim() || undefined })
        });
        active = created.conversation || created;
        if (!active?.id) throw new Error(errorText);
        setConversation(active);
      }
      const attachmentIds: string[] = [];
      for (const item of files) {
        const extension = item.file.name.split(".").pop()?.toLowerCase();
        const contentType = item.file.type || (extension === "txt" || extension === "md" ? "text/plain" : "application/octet-stream");
        const response = await request(`${base}/${encodeURIComponent(active.id)}/attachments`, {
          method: "POST", headers: { "content-type": contentType, "x-file-name": encodeURIComponent(item.file.name) }, body: item.file
        });
        const attachment = response.attachment || response;
        if (attachment.id) attachmentIds.push(attachment.id);
      }
      const clientMessageId = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const payload = await request(`${base}/${encodeURIComponent(active.id)}/messages`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ content: content.trim() || (ar ? "استخدم المرفقات المضافة لإعداد المحتوى المناسب للوجهة." : "Use the attached files to prepare content for this destination."), targetId, attachmentIds, clientMessageId, language: locale })
      });
      const latest = payload.conversation;
      if (latest) { setConversation(latest); setMessages(Array.isArray(latest.messages) ? latest.messages : []); }
      else if (payload.message) setMessages(current => [...current, payload.message]);
      setContent("");
      setFiles(current => { current.forEach(item => { if (item.preview) URL.revokeObjectURL(item.preview); }); return []; });
      setIdentityOpen(false);
      await loadList();
    } catch (error) { setNotice(error instanceof Error ? error.message : errorText); }
    finally { setBusy(false); }
  }

  const currentRun = conversation?.activeRun;
  const steps = currentRun?.metadata?.steps || [];
  const completedSteps = currentRun?.metadata?.completedSteps ?? steps.filter(step => ["completed", "skipped", "needs-review"].includes(step.status)).length;
  const totalSteps = currentRun?.metadata?.totalSteps || 10;
  const runLabel = currentRun ? (currentRun.status === "queued" ? t.queued : currentRun.status === "running" ? t.running : currentRun.status === "completed" ? t.completed : currentRun.status === "cancelled" ? t.cancelled : t.failed) : "";

  if (!token.trim()) return <section className="editorial-chat-workspace" dir={ar ? "rtl" : "ltr"}>
    <div className="editorial-chat-token-prompt"><MessageSquare aria-hidden="true"/><p>{t.settings}</p><button type="button" onClick={onOpenSettings}><Settings size={16}/>{t.goSettings}</button></div>
  </section>;

  return <section className="editorial-chat-workspace" dir={ar ? "rtl" : "ltr"}>
    <aside className="editorial-chat-history">
      <div className="editorial-chat-history-heading"><h2>{t.history}</h2><button type="button" onClick={startNew} disabled={busy || loading} aria-label={t.newChat}><Plus size={18}/></button></div>
      <button className="editorial-chat-new-button" type="button" onClick={startNew} disabled={busy || loading}><Plus size={16}/>{t.newChat}</button>
      <nav className="editorial-chat-conversation-list" aria-label={t.history}>
        {conversations.length ? conversations.map(item => <button className={`editorial-chat-conversation-item${conversation?.id === item.id ? " is-active" : ""}`} type="button" key={item.id} onClick={() => void openConversation(item)} disabled={busy || loading}><MessageSquare size={16}/><span>{item.title || (ar ? "محادثة جديدة" : "New conversation")}</span></button>) : <p className="editorial-chat-muted">{t.noHistory}</p>}
      </nav>
      <button type="button" className="editorial-chat-settings-button" onClick={onOpenSettings} disabled={busy || loading}><Settings size={16}/>{ar ? "الإعدادات" : "Settings"}</button>
    </aside>
    <main className="editorial-chat-main">
      <header className="editorial-chat-toolbar">
        <label className="editorial-chat-target-label">{t.target}</label>
        <div className="editorial-chat-target-picker">
          <button type="button" aria-expanded={pickerOpen} disabled={busy || loading} onClick={() => setPickerOpen(value => !value)}><span>{selectedTarget?.name || t.choose}</span><ChevronDown size={16}/></button>
          {pickerOpen && <div className="editorial-chat-target-menu"><div className="editorial-chat-target-search"><Search size={15}/><input value={query} onChange={event => setQuery(event.target.value)} placeholder={t.search} disabled={busy || loading}/></div>
            {visibleTargets.length ? (["social", "magazine"] as const).map(type => {
              const group = visibleTargets.filter(target => target.type === type);
              if (!group.length) return null;
              return <div className="editorial-chat-target-group" key={type}><h3>{type === "social" ? t.social : t.magazine}</h3>{group.map(target => <button type="button" key={target.id} className="editorial-chat-target-option" disabled={busy || loading} onClick={() => { setTargetId(target.id); setPickerOpen(false); }}><span className="editorial-chat-target-option-heading">{target.name}{targetId === target.id && <Check size={14}/>}</span><span>{target.description}</span><small>{t.scope}: {target.scope}</small><small>{t.style}: {target.styleSummary}</small>{target.formats.length > 0 && <small>{t.formats}: {target.formats.join(" · ")}</small>}</button>)}</div>;
            }) : <p className="editorial-chat-muted">{t.noTargets}</p>}
          </div>}
        </div>
        <button type="button" className={`editorial-chat-identity-toggle${identityOpen ? " is-open" : ""}`} onClick={() => setIdentityOpen(value => !value)} disabled={busy || loading}><Sparkles size={15}/>{t.identity}<ChevronDown size={14}/></button>
        {identityOpen && <div className="editorial-chat-identity-panel"><label>{t.client}<input value={clientName} disabled={Boolean(conversation)} onChange={event => setClientName(event.target.value)} maxLength={120}/></label><label>{t.brand}<input value={brandName} disabled={Boolean(conversation)} onChange={event => setBrandName(event.target.value)} maxLength={120}/></label><small>{t.identityHint}{conversation ? (ar ? " لبدء سياق مختلف، أنشئ محادثة جديدة." : " Start a new conversation to use a different identity.") : ""}</small></div>}
      </header>
      <div className="editorial-chat-message-area">
        {loading && <p className="editorial-chat-loading"><LoaderCircle size={16}/>{t.loading}</p>}
        {!loading && messages.length === 0 && <div className="editorial-chat-empty"><div className="editorial-chat-empty-icon"><Sparkles size={24}/></div><h1>{t.emptyTitle}</h1><p>{t.emptySub}</p>{!selectedTarget && <button type="button" className="editorial-chat-empty-select" onClick={() => setPickerOpen(true)}>{t.choose}<ChevronDown size={15}/></button>}<section className="editorial-chat-starters" aria-label={t.startersTitle}><div className="editorial-chat-starters-heading">{t.startersTitle}</div><div className="editorial-chat-starter-grid"><button type="button" className="editorial-chat-starter" onClick={() => useStarter("wordpress", ar ? "اكتب مقالاً تحريرياً منظماً حول [الموضوع]. ابدأ بعنوان ومقدمة واضحة، ثم أقسام مترابطة وخاتمة. ميّز الحقائق التي تحتاج إلى مصادر، ولا تخترع أرقاماً أو اقتباسات." : "Write a structured editorial article about [topic]. Include a clear title, introduction, connected sections and conclusion. Flag facts that need sources; do not invent figures or quotes.")}><span><Newspaper size={18}/></span><b>{t.starterArticle}</b><small>{t.starterArticleHint}</small></button><button type="button" className="editorial-chat-starter" onClick={() => useStarter("linkedin", ar ? "أنشئ منشوراً مهنياً على LinkedIn حول [الفكرة] لجمهور [الجمهور]. افتتح برؤية محددة، اشرحها بإيجاز، واختم بسؤال نقاش طبيعي." : "Create a professional LinkedIn post about [idea] for [audience]. Open with a specific insight, explain it concisely, and end with a natural discussion question.")}><span><MessagesSquare size={18}/></span><b>{t.starterPost}</b><small>{t.starterPostHint}</small></button><button type="button" className="editorial-chat-starter" onClick={() => useStarter("tiktok", ar ? "اكتب سيناريو فيديو قصير عن [الموضوع] لجمهور [الجمهور]. قدّم خطافاً لأول 3 ثوانٍ، ثم مشاهد متسلسلة مع نص الشاشة والتعليق الصوتي ودعوة واحدة للتفاعل." : "Write a short-video script about [topic] for [audience]. Provide a hook for the first 3 seconds, then sequenced scenes with on-screen text, voiceover and one call to action.")}><span><Video size={18}/></span><b>{t.starterVideo}</b><small>{t.starterVideoHint}</small></button><button type="button" className="editorial-chat-starter" onClick={() => useStarter("substack", ar ? "اكتب مسودة نشرة تحريرية حول [الموضوع] موجّهة إلى [الجمهور]. اقترح عنواناً واضحاً، ومقدمة مباشرة، ومحتوى مفيداً منظماً، وخاتمة تدعو إلى متابعة النقاش." : "Draft an editorial newsletter about [topic] for [audience]. Suggest a clear subject, direct opening, useful structured body and a closing that invites further discussion.")}><span><Mail size={18}/></span><b>{t.starterNewsletter}</b><small>{t.starterNewsletterHint}</small></button></div></section></div>}
        {messages.map((message, index) => {
          const result = message.result;
          const draft = result?.draft;
          return <article className={`editorial-chat-message editorial-chat-message-${message.role === "assistant" ? "assistant" : "user"}`} key={message.id || index}>
            {message.role === "assistant" && <div className="editorial-chat-message-mark"><Sparkles size={15}/></div>}
            {draft ? <div className="editorial-chat-draft-card"><div className="editorial-chat-draft-header"><span className="editorial-chat-draft-kicker">{t.draft} · {result?.targetName || selectedTarget?.name || ""}</span><span className="editorial-chat-format-chip">{draft.format}</span></div>{draft.title && <h3>{draft.title}</h3>}{draft.hook && <p className="editorial-chat-draft-hook">{draft.hook}</p>}<div className="editorial-chat-draft-body">{draft.body || message.content}</div>{draft.callToAction && <p className="editorial-chat-draft-extra"><b>{t.cta}: </b>{draft.callToAction}</p>}{draft.hashtags?.length ? <p className="editorial-chat-draft-tags"><b>{t.hashtags}: </b>{draft.hashtags.map(tag => tag.startsWith("#") ? tag : `#${tag}`).join("  ")}</p> : null}
              {draft.videoScript && <details className="editorial-chat-result-details"><summary>{ar ? "سيناريو الفيديو" : "Video script"}</summary><div>{draft.videoScript}</div></details>}
              {draft.onScreenText && <details className="editorial-chat-result-details"><summary>{ar ? "نص الشاشة" : "On-screen text"}</summary><div>{draft.onScreenText}</div></details>}
              <details className="editorial-chat-result-details" open><summary>{t.geo}</summary><div className="editorial-chat-geo-grid"><p><b>{t.intent}:</b> {draft.geo?.intent || "—"}</p><p><b>{t.primary}:</b> {draft.geo?.primaryPhrase || "—"}</p><p><b>{t.related}:</b> {draft.geo?.supportingTerms?.join(" · ") || "—"}</p><p><b>{t.questions}:</b> {draft.geo?.questions?.join(" · ") || "—"}</p><p><b>{t.entities}:</b> {draft.geo?.entities?.join(" · ") || "—"}</p></div></details>
              {draft.mediaNotes && <p className="editorial-chat-draft-extra"><b>{t.mediaNotes}: </b>{draft.mediaNotes}</p>}
              {draft.factCheckNotes?.length ? <div className="editorial-chat-review-notes"><AlertTriangle size={15}/><div><b>{t.factChecks}</b><ul>{draft.factCheckNotes.map((item, i) => <li key={i}>{item}</li>)}</ul></div></div> : null}
              {result?.needsReview && <p className="editorial-chat-similarity"><AlertTriangle size={14}/>{t.similarity}</p>}
              {result?.limitations?.length ? <details className="editorial-chat-result-details"><summary>{t.limitations}</summary><ul>{result.limitations.map((item, i) => <li key={i}>{item}</li>)}</ul></details> : null}
              {onPrepareBrowser && conversation?.id && message.id && <div className="editorial-chat-browser-handoff"><button type="button" onClick={() => onPrepareBrowser({conversationId:conversation.id,messageId:message.id,targetId:result?.targetId||message.targetId||targetId,targetName:result?.targetName||selectedTarget?.name||"",title:draft.title||"",body:[draft.hook,draft.body||draft.videoScript||draft.onScreenText,draft.callToAction,draft.hashtags?.length?draft.hashtags.map(tag=>tag.startsWith("#")?tag:`#${tag}`).join(" "):""].filter(Boolean).join("\n\n")})}><Globe2 size={15}/>{t.browserHandoff}</button><small>{t.browserHandoffHint}</small></div>}
              {result?.usage && <small className="editorial-chat-usage">{result.usage.totalTokens ? `${result.usage.totalTokens.toLocaleString()} tokens` : ""}</small>}
            </div> : <div className="editorial-chat-message-content">{message.content || ""}</div>}
            {message.attachments?.length ? <div className="editorial-chat-message-attachments">{message.attachments.map(attachment => <button type="button" key={attachment.id} title={t.download} onClick={() => void downloadAttachment(attachment)}><File size={14}/>{attachment.originalName || attachment.name || attachment.id}<Download size={13}/></button>)}</div> : null}
          </article>;
        })}
        {currentRun && <section className={`editorial-chat-progress editorial-chat-progress-${currentRun.status}`} aria-live="polite"><div className="editorial-chat-progress-heading"><div><span className="editorial-chat-draft-kicker">{t.run}</span><b>{runLabel}</b></div>{currentRun.status === "running" || currentRun.status === "queued" ? <LoaderCircle size={17} className="editorial-chat-spinner"/> : currentRun.status === "failed" ? <AlertTriangle size={17}/> : <Check size={17}/>}</div><div className="editorial-chat-progress-track"><span style={{ width: `${Math.min(100, Math.round(completedSteps / totalSteps * 100))}%` }}/></div><p>{t.runningNote} · {completedSteps}/{totalSteps}</p>{steps.length > 0 && <ol className="editorial-chat-progress-steps">{steps.map((step, index) => <li key={step.id} className={`step-${step.status}`}><span className="editorial-chat-step-icon">{step.status === "completed" ? <Check size={13}/> : step.status === "running" ? <LoaderCircle size={13} className="editorial-chat-spinner"/> : step.status === "failed" || step.status === "needs-review" ? <AlertTriangle size={13}/> : <span>{String(index + 1).padStart(2, "0")}</span>}</span><span className="editorial-chat-step-text"><b>{step.label}</b>{step.note && <small>{step.note}</small>}</span><small className="editorial-chat-step-status">{step.status === "completed" ? t.completed : step.status === "running" ? t.running : step.status === "failed" ? t.failed : step.status === "needs-review" ? t.needsReview : step.status === "skipped" ? t.skipped : t.pending}</small></li>)}</ol>}{currentRun.status === "failed" && <p className="editorial-chat-progress-note"><AlertTriangle size={14}/>{t.providerFailed}</p>}</section>}
        <div ref={messagesEndRef}/>
      </div>
      {notice && <p className="editorial-chat-notice" role="status">{notice}</p>}
      <form className="editorial-chat-composer" onSubmit={sendMessage}>
        {files.length > 0 && <div className="editorial-chat-file-previews">{files.map((item, index) => <div className="editorial-chat-file-preview" key={`${item.file.name}-${index}`}>{item.preview ? <img src={item.preview} alt={item.file.name}/> : <File size={20}/>}<span title={item.file.name}>{item.file.name}</span><button type="button" aria-label={t.removeFile} onClick={() => removeFile(index)}><X size={15}/></button></div>)}</div>}
        <div className="editorial-chat-composer-row"><button className="editorial-chat-attach-button" type="button" aria-label={t.attach} title={t.attach} disabled={busy} onClick={() => fileRef.current?.click()}><Upload size={18}/></button><input ref={fileRef} className="editorial-chat-file-input" type="file" multiple disabled={busy} accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,.txt,.md" onChange={event => addFiles(event.target.files)}/>
          <textarea value={content} onChange={event => setContent(event.target.value)} placeholder={t.placeholder} rows={1} disabled={busy} onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }}/>
          <button className="editorial-chat-send-button" type="submit" aria-label={t.send} disabled={busy || (!content.trim() && files.length === 0) || !targetId || (currentRun != null && ["queued", "running"].includes(currentRun.status))}>{busy ? <LoaderCircle size={18} className="editorial-chat-spinner"/> : <ArrowUp size={18}/>}</button>
        </div><p className="editorial-chat-composer-note"><Image size={13}/>{busy ? t.uploading : t.note}</p>
      </form>
    </main>
  </section>;
}
