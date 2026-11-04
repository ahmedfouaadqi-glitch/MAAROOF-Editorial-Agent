import type { Platform } from "./platforms";

export type IntegrationKind = "official-api" | "browser-agent" | "manual" | "research-only" | "not-assessed";
export type PlatformRole = "editorial-destination" | "professional-network" | "community" | "knowledge-base" | "research-repository" | "code-host" | "data-source";

export interface AdapterCapability {
  platformId: Platform["id"];
  role: PlatformRole;
  integration: IntegrationKind;
  canCreateArticle: "yes" | "limited" | "no" | "unverified";
  canUploadMedia: "yes" | "limited" | "no" | "unverified";
  canSetMetadata: "yes" | "limited" | "no" | "unverified";
  humanApproval: "required" | "recommended" | "platform-dependent";
  implementationStatus: "catalog-only" | "contract-defined" | "adapter-not-implemented" | "not-a-publishing-target" | "verified";
  officialDocsUrl?: string;
  constraints: string[];
  verificationChecklist: string[];
}

/**
 * Conservative capability registry.
 * This describes engineering candidates, not verified live account access.
 * No adapter is considered publish-ready until credentials, policy and end-to-end
 * publication verification have been tested for the target account/site.
 */
export const adapterRegistry: Record<string, AdapterCapability> = {
  medium: {
    platformId: "medium", role: "editorial-destination", integration: "not-assessed",
    canCreateArticle: "unverified", canUploadMedia: "unverified", canSetMetadata: "unverified",
    humanApproval: "required", implementationStatus: "catalog-only",
    constraints: ["يجب التحقق من خيارات التكامل المتاحة للحساب قبل اعتماد أي نشر آلي.", "لا يُسمح بتحويل المنصة إلى قناة نشر جماعي مكرر."],
    verificationChecklist: ["التحقق من وسيلة النشر المعتمدة حالياً", "فحص صلاحيات الحساب", "اختبار حفظ مسودة", "التحقق من رابط المقال المنشور"]
  },
  substack: {
    platformId: "substack", role: "editorial-destination", integration: "not-assessed",
    canCreateArticle: "unverified", canUploadMedia: "unverified", canSetMetadata: "unverified",
    humanApproval: "required", implementationStatus: "catalog-only",
    constraints: ["النشر مرتبط بمنشور ونشرة واشتراكات وجمهور خاص.", "لا يُفترض وجود API نشر عامة دون تحقق."],
    verificationChecklist: ["تحديد النشرة المستهدفة", "التحقق من صلاحية الكاتب", "فحص خيارات المسودة والنشر", "تأكيد الرابط العام"]
  },
  wordpress: {
    platformId: "wordpress", role: "editorial-destination", integration: "browser-agent",
    canCreateArticle: "unverified", canUploadMedia: "unverified", canSetMetadata: "unverified",
    humanApproval: "required", implementationStatus: "adapter-not-implemented",
    constraints: ["يُدار النشر عبر وكيل متصفح بعد تحديد نطاق الموقع وموافقة مالكه.", "لا يوجد تكامل REST API مطلوب ضمن النطاق الحالي.", "يجب احترام صلاحيات الحساب وسياسات الموقع وعدم تخطي MFA أو CAPTCHA."],
    verificationChecklist: ["تسجيل نطاق الموقع وإثبات ملكية/تفويض الحساب", "مراجعة سياسات النشر", "إنشاء جلسة متصفح يوافق عليها المستخدم", "اختبار حفظ مسودة", "التحقق خارجياً من النتيجة"]
  },
  blogger: {
    platformId: "blogger", role: "editorial-destination", integration: "browser-agent",
    canCreateArticle: "unverified", canUploadMedia: "unverified", canSetMetadata: "unverified",
    humanApproval: "required", implementationStatus: "adapter-not-implemented",
    constraints: ["يُستخدم مسار المتصفح بعد التحقق من الحساب وسياسات المنصة.", "لا يُبنى موصل Blogger API ضمن النطاق الحالي.", "يجب طلب تدخل المستخدم للمصادقة متعددة العوامل أو التحديات."],
    verificationChecklist: ["تحديد المدونة المقصودة", "تأكيد تفويض الحساب", "اختبار جلسة المتصفح", "التحقق من حفظ المسودة خارجياً"]
  },
  ghost: {
    platformId: "ghost", role: "editorial-destination", integration: "browser-agent",
    canCreateArticle: "unverified", canUploadMedia: "unverified", canSetMetadata: "unverified",
    humanApproval: "required", implementationStatus: "adapter-not-implemented",
    constraints: ["يُستخدم مسار المتصفح إلى لوحة الموقع بعد اعتماد النطاق وتفويض الحساب.", "لا يوجد Ghost Admin API adapter ضمن النطاق الحالي.", "لا يتم تجاوز أي خطوة تحقق أو صلاحية يطلبها الموقع."],
    verificationChecklist: ["تسجيل نطاق Ghost وبيانات المجلة", "تأكيد التفويض وتسجيل الدخول", "اختبار إدخال المقال والصورة", "التحقق الخارجي من المسودة أو النشر"]
  },
  devto: {
    platformId: "devto", role: "professional-network", integration: "not-assessed",
    canCreateArticle: "unverified", canUploadMedia: "unverified", canSetMetadata: "unverified",
    humanApproval: "required", implementationStatus: "catalog-only",
    officialDocsUrl: "https://developers.forem.com/api",
    constraints: ["محتوى تقني أصيل ومرتبط بالمجتمع فقط.", "يجب التحقق من شروط API وسياسة المحتوى قبل تفعيل الموصل."],
    verificationChecklist: ["مراجعة API الحالية", "التحقق من ملكية الحساب", "فحص قواعد المجتمع والوسوم", "اختبار draft إن كان متاحاً"]
  },
  hashnode: {
    platformId: "hashnode", role: "professional-network", integration: "not-assessed",
    canCreateArticle: "unverified", canUploadMedia: "unverified", canSetMetadata: "unverified",
    humanApproval: "required", implementationStatus: "catalog-only",
    officialDocsUrl: "https://apidocs.hashnode.com/",
    constraints: ["يتطلب تحديد publication المرتبطة بالحساب.", "يجب التحقق من صلاحيات GraphQL والحقول المدعومة."],
    verificationChecklist: ["تحديد publication", "التحقق من API token", "اختبار إنشاء draft", "فحص الصور والوسوم"]
  },
  "linkedin-articles": {
    platformId: "linkedin-articles", role: "professional-network", integration: "not-assessed",
    canCreateArticle: "unverified", canUploadMedia: "unverified", canSetMetadata: "unverified",
    humanApproval: "required", implementationStatus: "catalog-only",
    officialDocsUrl: "https://learn.microsoft.com/en-us/linkedin/",
    constraints: ["صلاحيات النشر تختلف حسب نوع التطبيق والحساب.", "لا يجوز افتراض أن واجهات مشاركة المنشورات تدعم مقالات LinkedIn الطويلة."],
    verificationChecklist: ["التحقق من المنتجات والصلاحيات المتاحة للتطبيق", "تحديد نوع المحتوى المدعوم", "اختبار مسودة أو handoff يدوي", "تأكيد ظهور المحتوى"]
  },
  reddit: {
    platformId: "reddit", role: "community", integration: "manual",
    canCreateArticle: "no", canUploadMedia: "limited", canSetMetadata: "no",
    humanApproval: "required", implementationStatus: "catalog-only",
    officialDocsUrl: "https://www.reddit.com/dev/api/",
    constraints: ["ليس وجهة مقالات صحفية تقليدية.", "يجب احترام قواعد كل subreddit ومكافحة spam.", "المشاركة يجب أن تضيف قيمة للنقاش."],
    verificationChecklist: ["اختيار subreddit مناسب", "مراجعة قواعد المجتمع", "مراجعة الإفصاح عن الانتماء التجاري", "موافقة بشرية قبل الإرسال"]
  },
  quora: {
    platformId: "quora", role: "community", integration: "manual",
    canCreateArticle: "no", canUploadMedia: "unverified", canSetMetadata: "no",
    humanApproval: "required", implementationStatus: "catalog-only",
    constraints: ["منصة أسئلة وأجوبة وليست مجلة مقالات عامة.", "تُكتب الإجابة لمعالجة السؤال لا لتكرار مادة تسويقية."],
    verificationChecklist: ["اختيار سؤال ذي صلة", "التحقق من قواعد المنصة", "مراجعة الإجابة يدوياً", "إضافة المصادر عند الحاجة"]
  },
  "stack-exchange": {
    platformId: "stack-exchange", role: "community", integration: "manual",
    canCreateArticle: "no", canUploadMedia: "no", canSetMetadata: "no",
    humanApproval: "required", implementationStatus: "catalog-only",
    officialDocsUrl: "https://api.stackexchange.com/",
    constraints: ["المحتوى إجابة تقنية مباشرة على سؤال محدد.", "الترويج الذاتي غير ذي صلة قد يخالف قواعد المجتمع."],
    verificationChecklist: ["تحديد السؤال المناسب", "التحقق من قواعد الموقع", "التأكد من صحة الحل تقنياً", "مراجعة بشرية قبل الإرسال"]
  },
  wikipedia: {
    platformId: "wikipedia", role: "knowledge-base", integration: "manual",
    canCreateArticle: "limited", canUploadMedia: "limited", canSetMetadata: "limited",
    humanApproval: "required", implementationStatus: "catalog-only",
    officialDocsUrl: "https://www.mediawiki.org/wiki/API:Main_page",
    constraints: ["لا تُستخدم لنشر مواد ترويجية أو بيانات صحفية.", "تتطلب الملحوظية ومصادر ثانوية مستقلة وحياداً.", "يجب الإفصاح عن تعارض المصالح."],
    verificationChecklist: ["فحص الملحوظية بمصادر مستقلة", "مراجعة سياسة تعارض المصالح", "مراجعة المصادر والحياد", "عدم النشر الآلي"]
  },
  arxiv: {
    platformId: "arxiv", role: "research-repository", integration: "manual",
    canCreateArticle: "limited", canUploadMedia: "limited", canSetMetadata: "limited",
    humanApproval: "required", implementationStatus: "not-a-publishing-target",
    officialDocsUrl: "https://info.arxiv.org/help/submit/index.html",
    constraints: ["مستودع أبحاث علمية وليس مجلة صحفية.", "الإيداع يخضع لمتطلبات المجال والتنسيق والتحكيم المجتمعي/الاعتماد."],
    verificationChecklist: ["وجود بحث علمي أصيل", "التحقق من أهلية المؤلف والمجال", "مطابقة تنسيق الإيداع", "تقديم بشري من المؤلف"]
  },
  "pubmed-central": {
    platformId: "pubmed-central", role: "research-repository", integration: "research-only",
    canCreateArticle: "no", canUploadMedia: "no", canSetMetadata: "no",
    humanApproval: "required", implementationStatus: "not-a-publishing-target",
    officialDocsUrl: "https://www.ncbi.nlm.nih.gov/pmc/",
    constraints: ["مستودع أدبيات طبية حيوية؛ الإيداع يتم عبر قنوات مؤهلة.", "ليس وجهة لإرسال مقالات صحفية أو تسويقية."],
    verificationChecklist: ["تحديد مسار الإيداع المؤهل", "التحقق من متطلبات الناشر/الممول", "عدم محاولة رفع محتوى غير بحثي"]
  },
  github: {
    platformId: "github", role: "code-host", integration: "official-api",
    canCreateArticle: "limited", canUploadMedia: "yes", canSetMetadata: "limited",
    humanApproval: "platform-dependent", implementationStatus: "adapter-not-implemented",
    officialDocsUrl: "https://docs.github.com/en/rest",
    constraints: ["مناسب للتوثيق وملفات المشروع وREADME وليس للنشر الصحفي العام.", "يتطلب صلاحيات مستودع محددة."],
    verificationChecklist: ["تحديد المستودع والفرع", "التحقق من صلاحيات الكتابة", "إنشاء commit قابل للمراجعة", "عدم الكتابة إلى main دون موافقة"]
  },
  "common-crawl": {
    platformId: "common-crawl", role: "data-source", integration: "research-only",
    canCreateArticle: "no", canUploadMedia: "no", canSetMetadata: "no",
    humanApproval: "required", implementationStatus: "not-a-publishing-target",
    officialDocsUrl: "https://commoncrawl.org/",
    constraints: ["أرشيف زحف وبيانات ويب وليس وجهة نشر."],
    verificationChecklist: ["استخدامه كمصدر بحث فقط", "التحقق من تاريخ الالتقاط والمصدر الأصلي", "عدم نسب الأرشفة إلى نشر جديد"]
  },
  "huggingface-datasets": {
    platformId: "huggingface-datasets", role: "data-source", integration: "manual",
    canCreateArticle: "no", canUploadMedia: "limited", canSetMetadata: "limited",
    humanApproval: "required", implementationStatus: "not-a-publishing-target",
    officialDocsUrl: "https://huggingface.co/docs/hub/datasets-cards",
    constraints: ["مخصص لمجموعات البيانات وبطاقاتها وتراخيصها.", "لا يُستخدم كبديل عن المجلات."],
    verificationChecklist: ["وجود مجموعة بيانات حقيقية", "مراجعة الترخيص والخصوصية", "إعداد Dataset Card", "مراجعة بشرية قبل الإتاحة"]
  }
};
