export type PlatformCategory =
  | "editorial"
  | "professional"
  | "community"
  | "knowledge"
  | "research"
  | "developer"
  | "web-data";

export type PublishingMode = "official-api" | "browser-review" | "manual-only" | "research-only" | "unknown";
export type Readiness = "not-assessed" | "policy-review-required" | "adapter-not-built" | "research-source";

export interface Platform {
  id: string;
  name: string;
  category: PlatformCategory;
  contentPurpose: string;
  mode: PublishingMode;
  readiness: Readiness;
  note: string;
}

export const platforms: Platform[] = [
  { id: "medium", name: "Medium", category: "editorial", contentPurpose: "مقالات احترافية، تجارب، تحليلات وآراء", mode: "unknown", readiness: "not-assessed", note: "يلزم التحقق من خيارات النشر الحالية وسياسات المحتوى لكل حساب." },
  { id: "substack", name: "Substack", category: "editorial", contentPurpose: "مقالات متخصصة ونشرات خبرية", mode: "unknown", readiness: "not-assessed", note: "النشر مرتبط بمنشور/نشرة وصلاحيات الحساب." },
  { id: "wordpress", name: "WordPress", category: "editorial", contentPurpose: "مدونات ومواقع معرفية", mode: "official-api", readiness: "adapter-not-built", note: "تختلف الإمكانات حسب إعداد الموقع والإضافات وصلاحيات REST API." },
  { id: "blogger", name: "Blogger", category: "editorial", contentPurpose: "مقالات ومدونات عامة", mode: "official-api", readiness: "adapter-not-built", note: "يجب إعداد OAuth وصلاحيات Blogger API قبل النشر." },
  { id: "ghost", name: "Ghost", category: "editorial", contentPurpose: "نشر مستقل ومجلات رقمية", mode: "official-api", readiness: "adapter-not-built", note: "يعتمد التكامل على إعدادات Ghost Admin API لدى الناشر." },
  { id: "devto", name: "DEV Community", category: "professional", contentPurpose: "البرمجة والهندسة التقنية", mode: "unknown", readiness: "policy-review-required", note: "مناسب للمحتوى التقني؛ يجب الالتزام بإرشادات المجتمع." },
  { id: "hashnode", name: "Hashnode", category: "professional", contentPurpose: "مقالات المطورين والتقنيات", mode: "unknown", readiness: "not-assessed", note: "يلزم تقييم واجهة التكامل الحالية ومتطلبات النشر." },
  { id: "linkedin-articles", name: "LinkedIn Articles", category: "professional", contentPurpose: "مقالات مهنية وتجارية", mode: "unknown", readiness: "policy-review-required", note: "لا يُفترض توفر نشر آلي للحسابات؛ يلزم التحقق من صلاحيات API." },
  { id: "reddit", name: "Reddit", category: "community", contentPurpose: "نقاشات وتجارب وآراء المستخدمين", mode: "unknown", readiness: "policy-review-required", note: "ليس مجلة مقالات تقليدية؛ المشاركة يجب أن تكون مفيدة وغير ترويجية ومتوافقة مع قواعد كل مجتمع." },
  { id: "quora", name: "Quora", category: "community", contentPurpose: "أسئلة وأجوبة معرفية", mode: "manual-only", readiness: "policy-review-required", note: "يُعامل كمنصة إجابات لا كقناة نشر مقالات عامة." },
  { id: "stack-exchange", name: "Stack Exchange", category: "community", contentPurpose: "إجابات تقنية وعلمية متخصصة", mode: "manual-only", readiness: "policy-review-required", note: "الإجابات يجب أن تحل السؤال مباشرة؛ يمنع استخدامه كقناة ترويجية." },
  { id: "wikipedia", name: "Wikipedia", category: "knowledge", contentPurpose: "المعرفة العامة والموسوعية", mode: "manual-only", readiness: "policy-review-required", note: "ليست منصة لنشر مقالات العلامات التجارية؛ يلزم الالتزام بالملحوظية والمصادر المحايدة وتعارض المصالح." },
  { id: "arxiv", name: "arXiv", category: "research", contentPurpose: "الأبحاث العلمية والتقنية", mode: "manual-only", readiness: "policy-review-required", note: "مخصص للأبحاث المؤهلة؛ لا تُرفع مواد تسويقية أو مقالات صحفية." },
  { id: "pubmed-central", name: "PubMed Central", category: "research", contentPurpose: "الأبحاث الطبية المنشورة", mode: "research-only", readiness: "policy-review-required", note: "مستودع للأبحاث الطبية المؤهلة، وليس منصة نشر صحفي عامة." },
  { id: "github", name: "GitHub", category: "developer", contentPurpose: "الأكواد والمشاريع والتوثيق", mode: "official-api", readiness: "not-assessed", note: "يُستخدم للتوثيق والمشاريع البرمجية، لا لنشر مقالات صحفية عامة." },
  { id: "common-crawl", name: "Common Crawl", category: "web-data", contentPurpose: "أرشيف ضخم لصفحات الويب", mode: "research-only", readiness: "research-source", note: "مصدر بيانات/أرشيف زحف وليس وجهة نشر." },
  { id: "huggingface-datasets", name: "Hugging Face Datasets", category: "developer", contentPurpose: "مجموعات بيانات تدريب النماذج", mode: "manual-only", readiness: "policy-review-required", note: "وجهة لمجموعات البيانات وبطاقاتها وتراخيصها، لا للمقالات الصحفية." }
];

export const categoryLabels: Record<PlatformCategory, string> = {
  editorial: "مجلات ومدونات",
  professional: "منصات مهنية وتقنية",
  community: "مجتمعات وأسئلة وأجوبة",
  knowledge: "موسوعات معرفية",
  research: "مستودعات أبحاث",
  developer: "منصات المطورين",
  "web-data": "مصادر بيانات الويب"
};

export const modeLabels: Record<PublishingMode, string> = {
  "official-api": "واجهة API رسمية — تحتاج إعداداً",
  "browser-review": "أتمتة متصفح بعد التحقق",
  "manual-only": "تسليم يدوي / مراجعة بشرية",
  "research-only": "مصدر بحث وليس وجهة نشر",
  unknown: "طريقة النشر غير متحققة"
};

export const readinessLabels: Record<Readiness, string> = {
  "not-assessed": "لم يُقيّم بعد",
  "policy-review-required": "مراجعة السياسات مطلوبة",
  "adapter-not-built": "موصل النشر غير مبني",
  "research-source": "مصدر بيانات فقط"
};