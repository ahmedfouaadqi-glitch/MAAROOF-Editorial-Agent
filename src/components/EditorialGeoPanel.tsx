import { useEffect, useState, type ChangeEvent } from "react";
import { BadgeCheck, CircleAlert, Plus, Save, SearchCheck, Trash2 } from "lucide-react";

type Locale = "ar" | "en";
type Section = { id: string; heading: string; body: string };
type Entity = { id: string; canonicalName: string; aliases: string[] };
type Evidence = { id: string; claimId: string; excerpt: string; stance: string; sourceId: string };
type ClaimEvidence = { claimId: string; text: string; evidence: Evidence[] };
type Question = { id: string; question: string; sectionId: string; evidenceIds: string[] };
type GeoBrief = { intent: string; primaryQuery: string; supportingTerms: string[]; targetQuestions: Question[]; targetEntityIds: string[] };
type GeoCheck = { id: string; status: "pass" | "missing" | "review"; detail: string };
type GeoReadiness = {
  status: string;
  checks: GeoCheck[];
  termCoverage: Array<{ term: string; occurrences: number }>;
  questionCoverage: Array<{ id: string; question: string; sectionHeading: string; linkedEvidenceCount: number; supportingEvidenceCount: number; contradictoryEvidenceCount: number; status: string }>;
  entityCoverage: Array<{ id: string; name: string; mentioned: boolean; linkedClaimCount: number; evidenceCount: number; status: string }>;
  limitations: string[];
};

const EMPTY_BRIEF: GeoBrief = { intent: "", primaryQuery: "", supportingTerms: [], targetQuestions: [], targetEntityIds: [] };
const INTENTS: Array<{ id: string; ar: string; en: string }> = [
  { id: "informational", ar: "معلوماتية", en: "Informational" },
  { id: "commercial", ar: "تجارية / مقارنة", en: "Commercial / comparison" },
  { id: "transactional", ar: "إجرائية / شرائية", en: "Transactional" },
  { id: "navigational", ar: "تنقلية / الوصول لجهة", en: "Navigational" },
  { id: "local", ar: "محلية", en: "Local" }
];
const CHECK_LABELS: Record<string, [string, string]> = {
  intent: ["نية البحث", "Search intent"],
  "primary-query": ["العبارة الرئيسية", "Primary phrase"],
  "supporting-terms": ["العبارات الداعمة", "Supporting phrases"],
  questions: ["الأسئلة والإجابة المسندة", "Questions and evidence-linked answers"],
  entities: ["تغطية الكيانات", "Entity coverage"],
  "editorial-angle": ["زاوية المقال", "Editorial angle"],
  "source-freshness": ["حداثة المصادر", "Source freshness"]
};

export default function EditorialGeoPanel({ apiBase, token, workspaceId, taskId, locale, sections, draftUpdatedAt }: {
  apiBase: string; token: string; workspaceId: string; taskId: string; locale: Locale; sections: Section[]; draftUpdatedAt?: string;
}) {
  const ar = locale === "ar";
  const [brief, setBrief] = useState<GeoBrief>(EMPTY_BRIEF);
  const [readiness, setReadiness] = useState<GeoReadiness | null>(null);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [claimTextById, setClaimTextById] = useState<Record<string, string>>({});
  const [termsText, setTermsText] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  const root = `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/tasks/${encodeURIComponent(taskId)}`;
  async function request(path: string, init: RequestInit = {}) {
    const response = await fetch(apiBase + path, {
      ...init,
      headers: { authorization: `Bearer ${token}`, ...(init.body ? { "content-type": "application/json" } : {}), ...init.headers }
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Request failed");
    return payload;
  }

  useEffect(() => {
    let active = true;
    if (!token.trim()) return;
    Promise.all([request(root + "/geo-brief"), request(root + "/entities"), request(root + "/research")])
      .then(([geoPayload, entityPayload, researchPayload]) => {
        if (!active) return;
        const loadedBrief = geoPayload.brief || EMPTY_BRIEF;
        setBrief(loadedBrief);
        setTermsText((loadedBrief.supportingTerms || []).join("\n"));
        setReadiness(geoPayload.readiness || null);
        setEntities(entityPayload.entities || []);
        const claims = (researchPayload.claims || []) as ClaimEvidence[];
        setEvidence(claims.flatMap(claim => claim.evidence || []));
        setClaimTextById(Object.fromEntries(claims.map(claim => [claim.claimId, claim.text])));
      }).catch(error => { if (active) setNotice(error instanceof Error ? error.message : "Unable to load GEO data"); });
    return () => { active = false; };
  }, [apiBase, token, workspaceId, taskId]);

  useEffect(() => {
    let active = true;
    if (!token.trim()) return;
    request(root + "/geo-readiness")
      .then(payload => { if (active) setReadiness(payload.readiness || null); })
      .catch(error => { if (active) setNotice(error instanceof Error ? error.message : "Unable to refresh GEO readiness"); });
    return () => { active = false; };
  }, [apiBase, token, workspaceId, taskId, draftUpdatedAt]);

  function updateQuestion(index: number, patch: Partial<Question>) {
    setBrief(current => ({ ...current, targetQuestions: current.targetQuestions.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item) }));
  }

  async function save() {
    setBusy(true); setNotice("");
    try {
      const supportingTerms = termsText.split(/\n/).map(item => item.trim()).filter(Boolean);
      const payload = await request(root + "/geo-brief", {
        method: "PUT",
        body: JSON.stringify({ ...brief, supportingTerms })
      });
      setBrief(payload.brief);
      setTermsText((payload.brief.supportingTerms || []).join("\n"));
      setReadiness(payload.readiness || null);
      setNotice(ar ? "تم حفظ موجز GEO وفحوص التغطية." : "GEO brief and coverage checks saved.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Unable to save GEO brief"); }
    finally { setBusy(false); }
  }

  function toggleEntity(id: string, checked: boolean) {
    setBrief(current => ({ ...current, targetEntityIds: checked ? [...new Set([...current.targetEntityIds, id])] : current.targetEntityIds.filter(item => item !== id) }));
  }

  function evidenceLabel(item: Evidence) {
    const claim = claimTextById[item.claimId] || item.claimId;
    return `${claim.slice(0, 75)} · ${item.stance} · ${item.excerpt.slice(0, 95)}`;
  }

  const statusText = (status: GeoCheck["status"]) => status === "pass" ? (ar ? "مكتمل" : "Set") : status === "missing" ? (ar ? "ينقصه إعداد" : "Missing") : (ar ? "يحتاج مراجعة" : "Review");

  return <section className="surface-card" style={{ marginTop: 16, padding: 18 }}>
    <div className="section-heading"><div><span className="tiny-overline">GENERATIVE ENGINE OPTIMIZATION</span><h2>{ar ? "موجز GEO للمقالة" : "Article GEO brief"}</h2><p className="muted">{ar ? "اختر نية وعبارات وأسئلة مرتبطة بالمصادر؛ هذه فحوص تحريرية وليست ضماناً للظهور." : "Choose intent, phrases, and evidence-linked questions; these are editorial checks, not a visibility guarantee."}</p></div><SearchCheck size={18}/></div>
    <div className="form-pair" style={{ marginTop: 14 }}>
      <label className="budget-field geo-field"><span>{ar ? "نية البحث الرئيسية" : "Primary search intent"}<span aria-hidden="true"> *</span></span><select value={brief.intent} onChange={event => setBrief(current => ({ ...current, intent: event.target.value }))}><option value="">{ar ? "اختر النية" : "Choose intent"}</option>{INTENTS.map(item => <option key={item.id} value={item.id}>{ar ? item.ar : item.en}</option>)}</select></label>
      <label className="budget-field geo-field"><span>{ar ? "العبارة الرئيسية المستهدفة" : "Primary target phrase"}</span><input maxLength={160} value={brief.primaryQuery} onChange={event => setBrief(current => ({ ...current, primaryQuery: event.target.value }))} placeholder={ar ? "عبارة محددة تعبّر عن حاجة القارئ" : "A specific phrase reflecting the reader's need"}/></label>
    </div>
    <label className="budget-field geo-field" style={{ marginTop: 12 }}><span>{ar ? "عبارات داعمة مرتبطة بالموضوع — عبارة واحدة في كل سطر" : "Relevant supporting phrases — one phrase per line"}</span><textarea rows={3} maxLength={2200} value={termsText} onChange={event => setTermsText(event.target.value)} placeholder={ar ? "مصطلحات متخصصة أو مرادفات حقيقية، لا كلمات عامة للحشو" : "Specific terms or genuine synonyms, not generic filler keywords"}/></label>
    <div className="geo-panel-block">
      <div className="geo-block-heading"><h3>{ar ? "الكيانات المستهدفة" : "Target entities"}</h3><span className="muted">{ar ? "اختر من سجل هذه المقالة فقط." : "Select from this article's registry only."}</span></div>
      {entities.length ? <div className="geo-entity-list">{entities.map(entity => <label key={entity.id} className="geo-entity-option"><input type="checkbox" checked={brief.targetEntityIds.includes(entity.id)} onChange={event => toggleEntity(entity.id, event.target.checked)}/><span><b>{entity.canonicalName}</b>{entity.aliases.length > 0 && <small>{entity.aliases.join(" · ")}</small>}</span></label>)}</div> : <p className="muted">{ar ? "سجّل الكيانات من لوحة الكيانات أولاً؛ لن تُستنتج تلقائياً." : "Register entities in the entity panel first; none are inferred automatically."}</p>}
    </div>
    <div className="geo-panel-block">
      <div className="geo-block-heading"><div><h3>{ar ? "الأسئلة التي ينبغي أن يجيب عنها المقال" : "Questions the article should answer"}</h3><span className="muted">{ar ? "اربط كل سؤال بقسم وبمقتطف دليل يدوي مسجل." : "Link each question to a section and a recorded manual evidence excerpt."}</span></div><button className="secondary-button" onClick={() => setBrief(current => ({ ...current, targetQuestions: [...current.targetQuestions, { id: "", question: "", sectionId: "", evidenceIds: [] }] }))}><Plus size={14}/>{ar ? "إضافة سؤال" : "Add question"}</button></div>
      {brief.targetQuestions.map((item, index) => <div className="geo-question-card" key={item.id || `new-${index}`}>
        <div className="geo-question-title"><b>{ar ? `السؤال ${index + 1}` : `Question ${index + 1}`}</b><button className="top-icon" type="button" title={ar ? "إزالة السؤال" : "Remove question"} onClick={() => setBrief(current => ({ ...current, targetQuestions: current.targetQuestions.filter((_, itemIndex) => itemIndex !== index) }))}><Trash2 size={14}/></button></div>
        <label className="budget-field"><span>{ar ? "صياغة السؤال" : "Question wording"}</span><input maxLength={300} value={item.question} onChange={event => updateQuestion(index, { question: event.target.value })}/></label>
        <div className="form-pair">
          <label className="budget-field"><span>{ar ? "القسم الذي يجيب عنه" : "Answer section"}</span><select value={item.sectionId} onChange={event => updateQuestion(index, { sectionId: event.target.value })}><option value="">{ar ? "لم يحدد" : "Not mapped"}</option>{sections.map(section => <option key={section.id} value={section.id}>{section.heading}</option>)}</select></label>
          <label className="budget-field"><span>{ar ? "الأدلة المرتبطة" : "Linked evidence"}</span><select multiple size={3} value={item.evidenceIds} onChange={(event: ChangeEvent<HTMLSelectElement>) => updateQuestion(index, { evidenceIds: [...event.target.selectedOptions].map(option => option.value) })}>{evidence.map(record => <option key={record.id} value={record.id}>{evidenceLabel(record)}</option>)}</select></label>
        </div>
        {!evidence.length && <p className="form-note">{ar ? "لا توجد مقتطفات أدلة بعد. أضف مصادر وادعاءات وأدلة أولاً." : "No evidence excerpts yet. Add sources, claims, and excerpts first."}</p>}
      </div>)}
      {!brief.targetQuestions.length && <p className="muted">{ar ? "أضف فقط الأسئلة المرتبطة فعلاً بموضوع المقالة." : "Add only questions genuinely relevant to the article."}</p>}
    </div>
    <div className="form-pair" style={{ marginTop: 14 }}><p className="form-note">{ar ? "الأدلة المسجلة يدوياً غير متحققة بشكل مستقل؛ الربط لا يثبت صحة الإجابة." : "Manually recorded excerpts are not independently verified; a link does not prove the answer is correct."}</p><button className="primary-button" disabled={busy || !token.trim()} onClick={save}><Save size={15}/>{busy ? (ar ? "جارٍ الحفظ..." : "Saving...") : (ar ? "حفظ موجز GEO" : "Save GEO brief")}</button></div>
    {readiness && <div className="geo-readiness">
      <div className="geo-readiness-heading"><h3>{ar ? "فحوص الجاهزية التحريرية" : "Editorial readiness checks"}</h3><span className="status-chip">{readiness.status === "incomplete" ? (ar ? "غير مكتمل" : "Incomplete") : (ar ? "للمراجعة التحريرية" : "For editorial review")}</span></div>
      <div className="geo-check-list">{readiness.checks.map(check => <div key={check.id} className="geo-check-row"><span className={`geo-check-icon ${check.status}`}>{check.status === "pass" ? <BadgeCheck size={15}/> : <CircleAlert size={15}/>}</span><div><b>{CHECK_LABELS[check.id]?.[ar ? 0 : 1] || check.id} · {statusText(check.status)}</b><small>{check.detail}</small></div></div>)}</div>
      {readiness.termCoverage.length > 0 && <div className="geo-coverage-list"><b>{ar ? "تكرار العبارة في النص المحفوظ (وصف فقط)" : "Phrase occurrences in saved text (descriptive only)"}</b>{readiness.termCoverage.map(item => <span key={item.term}>{item.term} · {item.occurrences}</span>)}</div>}
      {readiness.questionCoverage.length > 0 && <div className="geo-coverage-list"><b>{ar ? "تغطية الأسئلة" : "Question coverage"}</b>{readiness.questionCoverage.map(item => <span key={item.id}>{item.question} · {item.sectionHeading || (ar ? "بلا قسم" : "No section")} · {item.supportingEvidenceCount}/{item.linkedEvidenceCount} {ar ? "أدلة داعمة/مرتبطة" : "supporting/linked excerpts"}{item.contradictoryEvidenceCount > 0 ? (ar ? " · يوجد تعارض للمراجعة" : " · conflicting excerpt to review") : ""}</span>)}</div>}
      {readiness.entityCoverage.length > 0 && <div className="geo-coverage-list"><b>{ar ? "تغطية الكيانات" : "Entity coverage"}</b>{readiness.entityCoverage.map(item => <span key={item.id}>{item.name} · {item.mentioned ? (ar ? "مذكور" : "mentioned") : (ar ? "غير مذكور" : "not mentioned")} · {item.evidenceCount} {ar ? "مقتطفات مرتبطة" : "linked excerpts"}</span>)}</div>}
      <p className="form-note">{readiness.limitations.join(" ")}</p>
    </div>}
    {notice && <p className="inline-feedback">{notice}</p>}
  </section>;
}
