import { useEffect, useState, type FormEvent } from "react";
import { AlertTriangle, BookOpenCheck, ClipboardCheck, Plus } from "lucide-react";

type Source = { id: string; url: string; title: string };
type Claim = { id: string; text: string };
type ResearchClaim = { claimId: string; text: string; evidenceCount: number; conflictState: string; evidence: Array<{id:string;sourceId:string;excerpt:string;stance:string;locator:string;verificationState:string}> };
type Props = { apiBase: string; token: string; workspaceId: string; taskId: string; locale: "ar" | "en" };

export default function EditorialResearchPanel({ apiBase, token, workspaceId, taskId, locale }: Props) {
  const ar = locale === "ar";
  const [sources, setSources] = useState<Source[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [researchClaims, setResearchClaims] = useState<ResearchClaim[]>([]);
  const [summary, setSummary] = useState({ sourceCount: 0, assessedSourceCount: 0, claimCount: 0, evidenceRecordCount: 0, claimsWithConflictingEvidence: 0, claimsWithoutEvidence: 0 });
  const [sourceId, setSourceId] = useState("");
  const [author, setAuthor] = useState("");
  const [publisher, setPublisher] = useState("");
  const [sourceType, setSourceType] = useState("unspecified");
  const [publishedAt, setPublishedAt] = useState("");
  const [updatedAt, setUpdatedAt] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState("");
  const [effectiveTo, setEffectiveTo] = useState("");
  const [jurisdiction, setJurisdiction] = useState("");
  const [methodology, setMethodology] = useState("");
  const [qualityRating, setQualityRating] = useState("unassessed");
  const [qualityRationale, setQualityRationale] = useState("");
  const [claimId, setClaimId] = useState("");
  const [evidenceSourceId, setEvidenceSourceId] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [locator, setLocator] = useState("");
  const [stance, setStance] = useState("unclear");
  const [note, setNote] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  async function request(path: string, init: RequestInit = {}) {
    const response = await fetch(apiBase + path, {
      ...init,
      headers: { authorization: `Bearer ${token}`, ...(init.body ? { "content-type": "application/json" } : {}), ...init.headers }
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Request failed");
    return payload;
  }
  async function refresh() {
    const root = `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/tasks/${encodeURIComponent(taskId)}`;
    const [sourcePayload, claimPayload, researchPayload] = await Promise.all([
      request(root + "/sources"), request(root + "/claims"), request(root + "/research")
    ]);
    setSources(sourcePayload.sources || []);
    setClaims(claimPayload.claims || []);
    setResearchClaims(researchPayload.claims || []);
    setSummary(researchPayload.summary || summary);
  }
  useEffect(() => {
    let active = true;
    if (!token.trim()) return;
    const root = `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/tasks/${encodeURIComponent(taskId)}`;
    Promise.all([request(root + "/sources"), request(root + "/claims"), request(root + "/research")])
      .then(([s, c, r]) => {
        if (!active) return;
        setSources(s.sources || []); setClaims(c.claims || []);
        setResearchClaims(r.claims || []); setSummary(r.summary || summary);
      }).catch(error => { if (active) setNotice(error instanceof Error ? error.message : "Unable to load research"); });
    return () => { active = false; };
  }, [apiBase, token, workspaceId, taskId]);

  async function saveAssessment(event: FormEvent) {
    event.preventDefault(); setBusy(true); setNotice("");
    try {
      await request("/api/v1/sources/assessment", { method: "PUT", body: JSON.stringify({
        workspaceId, taskId, sourceId, author, publisher, sourceType,
        publishedAt: publishedAt || null, updatedAt: updatedAt || null,
        effectiveFrom: effectiveFrom || null, effectiveTo: effectiveTo || null,
        jurisdiction, methodology, qualityRating, qualityRationale
      }) });
      await refresh();
      setNotice(ar ? "تم حفظ بيانات التقييم التحريري للمصدر." : "Source editorial assessment saved.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Unable to assess source"); }
    finally { setBusy(false); }
  }

  async function saveEvidence(event: FormEvent) {
    event.preventDefault(); setBusy(true); setNotice("");
    try {
      await request("/api/v1/research/evidence", { method: "POST", body: JSON.stringify({
        workspaceId, taskId, sourceId: evidenceSourceId, claimId, excerpt, locator, stance, note
      }) });
      setExcerpt(""); setLocator(""); setNote("");
      await refresh();
      setNotice(ar ? "تم تسجيل مقتطف الدليل. لم يتم التحقق المستقل منه." : "Evidence excerpt recorded. It has not been independently verified.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Unable to record evidence"); }
    finally { setBusy(false); }
  }

  const sourceLabel = (id: string) => sources.find(item => item.id === id)?.title || sources.find(item => item.id === id)?.url || id;
  const conflictLabel: Record<string,string> = {
    "conflicting-evidence": ar ? "أدلة متعارضة" : "Conflicting evidence",
    "contradicting-evidence-recorded": ar ? "دليل معارض مسجل" : "Contradicting evidence recorded",
    "supporting-evidence-recorded": ar ? "دليل مؤيد مسجل" : "Supporting evidence recorded",
    "no-evidence-recorded": ar ? "لا توجد أدلة مسجلة" : "No evidence recorded"
  };
  return <section className="research-workspace">
    <div className="section-heading"><div><span className="tiny-overline">EDITORIAL RESEARCH</span><h2>{ar ? "تقييم المصادر والأدلة" : "Source assessment & evidence"}</h2><p>{ar ? "تسجيل بيانات المصدر ومقتطفات الأدلة والتعارضات" : "Record source metadata, evidence excerpts, and conflicts"}</p></div><span className="count-badge">{summary.evidenceRecordCount}</span></div>
    <div className="research-metrics">
      <div><b>{summary.assessedSourceCount}/{summary.sourceCount}</b><span>{ar?"مصادر مقيمة":"Assessed sources"}</span></div>
      <div><b>{summary.evidenceRecordCount}</b><span>{ar?"سجلات أدلة":"Evidence records"}</span></div>
      <div><b>{summary.claimsWithConflictingEvidence}</b><span>{ar?"ادعاءات متعارضة":"Conflicting claims"}</span></div>
    </div>
    <form className="evidence-form" onSubmit={saveAssessment}>
      <h3><ClipboardCheck size={15}/>{ar?"تقييم بيانات المصدر":"Assess source metadata"}</h3>
      <select required value={sourceId} onChange={e=>setSourceId(e.target.value)}><option value="">{ar?"اختر مصدراً مسجلاً":"Select a registered source"}</option>{sources.map(source=><option key={source.id} value={source.id}>{source.title||source.url}</option>)}</select>
      <div className="form-pair">
        <input value={author} onChange={e=>setAuthor(e.target.value)} placeholder={ar?"المؤلف / الجهة":"Author / responsible body"}/>
        <input value={publisher} onChange={e=>setPublisher(e.target.value)} placeholder={ar?"الناشر":"Publisher"}/>
      </div>
      <div className="form-pair">
        <select value={sourceType} onChange={e=>setSourceType(e.target.value)}>{["primary","official","academic","news","industry","opinion","reference","unspecified"].map(v=><option key={v}>{v}</option>)}</select>
        <select value={qualityRating} onChange={e=>setQualityRating(e.target.value)}>{["unassessed","high","medium","low"].map(v=><option key={v}>{v}</option>)}</select>
      </div>
      <div className="form-pair">
        <label>{ar?"تاريخ النشر":"Publication date"}<input type="date" value={publishedAt.slice(0,10)} onChange={e=>setPublishedAt(e.target.value)}/></label>
        <label>{ar?"تاريخ التحديث":"Updated date"}<input type="date" value={updatedAt.slice(0,10)} onChange={e=>setUpdatedAt(e.target.value)}/></label>
      </div>
      <div className="form-pair">
        <label>{ar?"بداية صلاحية المعلومة":"Effective from"}<input type="date" value={effectiveFrom.slice(0,10)} onChange={e=>setEffectiveFrom(e.target.value)}/></label>
        <label>{ar?"نهاية صلاحية المعلومة":"Effective to"}<input type="date" value={effectiveTo.slice(0,10)} onChange={e=>setEffectiveTo(e.target.value)}/></label>
      </div>
      <input value={jurisdiction} onChange={e=>setJurisdiction(e.target.value)} placeholder={ar?"النطاق الجغرافي / القانوني":"Geographic or legal jurisdiction"}/>
      <textarea rows={2} value={methodology} onChange={e=>setMethodology(e.target.value)} placeholder={ar?"المنهجية أو طريقة جمع البيانات":"Methodology or data collection method"}/>
      <textarea rows={2} value={qualityRationale} onChange={e=>setQualityRationale(e.target.value)} placeholder={ar?"مبررات تقييم الجودة (إلزامي عند اختيار مرتفع/متوسط/منخفض)":"Quality-rating rationale (required for high/medium/low)"}/>
      <button className="secondary-button" disabled={busy||!sources.length}><Plus size={14}/>{ar?"حفظ التقييم":"Save assessment"}</button>
    </form>
    <form className="evidence-form" onSubmit={saveEvidence}>
      <h3><BookOpenCheck size={15}/>{ar?"تسجيل مقتطف دليل لادعاء":"Record source evidence for a claim"}</h3>
      <select required value={claimId} onChange={e=>setClaimId(e.target.value)}><option value="">{ar?"اختر الادعاء":"Select a claim"}</option>{claims.map(claim=><option key={claim.id} value={claim.id}>{claim.text.slice(0,120)}</option>)}</select>
      <select required value={evidenceSourceId} onChange={e=>setEvidenceSourceId(e.target.value)}><option value="">{ar?"اختر المصدر":"Select source"}</option>{sources.map(source=><option key={source.id} value={source.id}>{source.title||source.url}</option>)}</select>
      <textarea required minLength={5} maxLength={4000} rows={3} value={excerpt} onChange={e=>setExcerpt(e.target.value)} placeholder={ar?"انسخ مقتطفاً من المصدر يخص الادعاء":"Manually transcribe the relevant source excerpt"}/>
      <div className="form-pair">
        <select value={stance} onChange={e=>setStance(e.target.value)}><option value="unclear">{ar?"غير واضح":"Unclear"}</option><option value="supports">{ar?"يدعم الادعاء":"Supports claim"}</option><option value="contradicts">{ar?"يناقض الادعاء":"Contradicts claim"}</option><option value="contextualizes">{ar?"يضيف سياقاً":"Contextualizes"}</option></select>
        <input value={locator} onChange={e=>setLocator(e.target.value)} placeholder={ar?"الصفحة / الفقرة / القسم":"Page / paragraph / section"}/>
      </div>
      <textarea rows={2} value={note} onChange={e=>setNote(e.target.value)} placeholder={ar?"ملاحظة المحرر":"Editorial note"}/>
      <button className="secondary-button" disabled={busy||!sources.length||!claims.length}><Plus size={14}/>{ar?"تسجيل الدليل":"Record evidence"}</button>
    </form>
    <div className="research-claims">
      <h3>{ar?"حالة الأدلة حسب الادعاء":"Evidence status by claim"}</h3>
      {researchClaims.map(item=><article className="research-claim" key={item.claimId}>
        <div className="entity-title-row"><b>{item.text}</b><span className={item.conflictState==="conflicting-evidence"?"stage-pill conflict-pill":"stage-pill"}>{conflictLabel[item.conflictState]||item.conflictState}</span></div>
        <small>{item.evidenceCount} {ar?"سجلات دليل":"evidence records"}</small>
        {item.evidence.map(e=><div className="research-evidence" key={e.id}><span>{sourceLabel(e.sourceId)}</span><small>{e.stance} · {e.locator|| (ar?"دون موضع":"no locator")}</small><p>{e.excerpt}</p><small>{e.verificationState}</small></div>)}
      </article>)}
      {!researchClaims.length&&<p className="muted">{ar?"أضف ادعاءات ومصادر لبدء تقييم الأدلة.":"Add claims and sources to begin evidence review."}</p>}
    </div>
    <p className="evidence-disclaimer">{ar?"تقييم الجودة حكم تحريري يدوي وليس درجة علمية محسوبة. اكتمال البيانات يقيس الحقول المتوفرة فقط. المقتطفات ومواقف الدعم/التعارض مدخلة يدوياً ولا تثبت صحة الادعاء أو المصدر.":"Quality ratings are manual editorial judgments, not computed trust scores. Metadata completeness measures filled fields only. Excerpts and support/contradiction stances are manually entered and do not independently verify a source or claim."}</p>
    {notice&&<p className="inline-feedback">{notice}</p>}
  </section>;
}
