import { useEffect, useState, type FormEvent } from "react";
import { Network, Plus, ScanSearch } from "lucide-react";

type Entity = { id: string; canonicalName: string; type: string; aliases: string[]; disambiguationNote: string; claimIds: string[] };
type Claim = { id: string; text: string };
type Relationship = { id: string; fromEntityId: string; toEntityId: string; relation: string; claimIds: string[]; evidenceState: string };
type Props = { apiBase: string; token: string; workspaceId: string; taskId: string; locale: "ar" | "en" };

const types = ["person", "organization", "place", "product", "event", "concept", "unknown"];

export default function EditorialEntityPanel({ apiBase, token, workspaceId, taskId, locale }: Props) {
  const ar = locale === "ar";
  const [entities, setEntities] = useState<Entity[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [canonicalName, setCanonicalName] = useState("");
  const [type, setType] = useState("organization");
  const [aliases, setAliases] = useState("");
  const [disambiguationNote, setDisambiguationNote] = useState("");
  const [fromEntityId, setFromEntityId] = useState("");
  const [toEntityId, setToEntityId] = useState("");
  const [relation, setRelation] = useState("");
  const [claimId, setClaimId] = useState("");
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
    const [entityPayload, claimPayload, relationPayload] = await Promise.all([
      request(root + "/entities"), request(root + "/claims"), request(root + "/entity-relationships")
    ]);
    setEntities(entityPayload.entities || []);
    setClaims(claimPayload.claims || []);
    setRelationships(relationPayload.relationships || []);
  }

  useEffect(() => {
    let active = true;
    if (!token.trim()) return;
    const root = `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/tasks/${encodeURIComponent(taskId)}`;
    Promise.all([request(root + "/entities"), request(root + "/claims"), request(root + "/entity-relationships")])
      .then(([entityPayload, claimPayload, relationPayload]) => {
        if (!active) return;
        setEntities(entityPayload.entities || []);
        setClaims(claimPayload.claims || []);
        setRelationships(relationPayload.relationships || []);
      }).catch(error => { if (active) setNotice(error instanceof Error ? error.message : "Unable to load entities"); });
    return () => { active = false; };
  }, [apiBase, token, workspaceId, taskId]);

  async function addEntity(event: FormEvent) {
    event.preventDefault(); setBusy(true); setNotice("");
    try {
      await request("/api/v1/entities", { method: "POST", body: JSON.stringify({
        workspaceId, taskId, canonicalName, type,
        aliases: aliases.split(",").map(item => item.trim()).filter(Boolean),
        disambiguationNote
      }) });
      setCanonicalName(""); setAliases(""); setDisambiguationNote("");
      await refresh();
      setNotice(ar ? "تم تسجيل الكيان." : "Entity registered.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Unable to register entity"); }
    finally { setBusy(false); }
  }

  async function scanEntities() {
    setBusy(true); setNotice("");
    try {
      const payload = await request("/api/v1/entities/scan", { method: "POST", body: JSON.stringify({ workspaceId, taskId }) });
      await refresh();
      setNotice(ar ? `اكتمل الفحص: ${payload.result.matches.length} تطابقات مع الأسماء المسجلة.` : `Scan complete: ${payload.result.matches.length} matches against registered names.`);
    } catch (error) { setNotice(error instanceof Error ? error.message : "Unable to scan claims"); }
    finally { setBusy(false); }
  }

  async function addRelationship(event: FormEvent) {
    event.preventDefault(); setBusy(true); setNotice("");
    try {
      await request("/api/v1/entity-relationships", { method: "POST", body: JSON.stringify({
        workspaceId, taskId, fromEntityId, toEntityId, relation, claimIds: claimId ? [claimId] : []
      }) });
      setRelation(""); setClaimId("");
      await refresh();
      setNotice(ar ? "تم حفظ العلاقة. إسنادها ما زال غير متحقق." : "Relationship saved. Its supporting claim remains unverified.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Unable to save relationship"); }
    finally { setBusy(false); }
  }

  const entityName = (id: string) => entities.find(entity => entity.id === id)?.canonicalName || id;
  return <section className="entity-intelligence">
    <div className="section-heading"><div><span className="tiny-overline">ENTITY INTELLIGENCE</span><h2>{ar ? "ذكاء الكيانات والعلاقات" : "Entities & relationships"}</h2><p>{ar ? "سجل كيانات مضبوط وربط قائم على الادعاءات" : "A controlled entity registry with claim-linked relationships"}</p></div><span className="count-badge">{entities.length}</span></div>
    <form className="evidence-form" onSubmit={addEntity}>
      <h3><Plus size={15}/>{ar ? "تسجيل كيان" : "Register entity"}</h3>
      <div className="form-pair">
        <input required minLength={2} maxLength={180} value={canonicalName} onChange={e=>setCanonicalName(e.target.value)} placeholder={ar ? "الاسم المعتمد" : "Canonical name"}/>
        <select value={type} onChange={e=>setType(e.target.value)}>{types.map(item=><option key={item} value={item}>{item}</option>)}</select>
      </div>
      <input value={aliases} onChange={e=>setAliases(e.target.value)} placeholder={ar ? "الأسماء البديلة، مفصولة بفواصل" : "Aliases, comma separated"}/>
      <textarea required minLength={8} maxLength={500} rows={2} value={disambiguationNote} onChange={e=>setDisambiguationNote(e.target.value)} placeholder={ar ? "ملاحظة تمييز: ما الذي يحدد هذا الكيان في سياق المقالة؟" : "Disambiguation note: what identifies this entity in this article context?"}/>
      <button className="secondary-button" disabled={busy}><Plus size={14}/>{ar ? "حفظ الكيان" : "Save entity"}</button>
    </form>
    <div className="entity-toolbar"><span className="muted">{ar ? "الفحص يطابق الأسماء المسجلة فقط، ولا يستخرج كيانات جديدة." : "Scanning matches registered aliases only; it does not discover new entities."}</span><button className="secondary-button" disabled={busy||!entities.length||!claims.length} onClick={scanEntities}><ScanSearch size={14}/>{ar ? "مطابقة الادعاءات" : "Scan claims"}</button></div>
    <div className="entity-list">
      {entities.length ? entities.map(entity=><div className="evidence-record" key={entity.id}>
        <div className="entity-title-row"><b>{entity.canonicalName}</b><span className="stage-pill">{entity.type}</span></div>
        {entity.aliases.length>0&&<small>{ar?"الأسماء البديلة: ":"Aliases: "}{entity.aliases.join(" · ")}</small>}
        <small>{entity.disambiguationNote}</small>
        <small>{entity.claimIds.length} {ar?"ادعاءات مرتبطة":"linked claims"}</small>
      </div>) : <p className="muted">{ar ? "لم تسجل كيانات بعد." : "No entities registered yet."}</p>}
    </div>
    <form className="evidence-form" onSubmit={addRelationship}>
      <h3><Network size={15}/>{ar ? "تسجيل علاقة بين كيانين" : "Register an entity relationship"}</h3>
      <div className="form-pair">
        <select required value={fromEntityId} onChange={e=>setFromEntityId(e.target.value)}><option value="">{ar?"الكيان الأول":"First entity"}</option>{entities.map(entity=><option key={entity.id} value={entity.id}>{entity.canonicalName}</option>)}</select>
        <select required value={toEntityId} onChange={e=>setToEntityId(e.target.value)}><option value="">{ar?"الكيان الثاني":"Second entity"}</option>{entities.filter(entity=>entity.id!==fromEntityId).map(entity=><option key={entity.id} value={entity.id}>{entity.canonicalName}</option>)}</select>
      </div>
      <input required minLength={2} maxLength={120} value={relation} onChange={e=>setRelation(e.target.value)} placeholder={ar?"وصف العلاقة، مثل: شريك لـ":"Relation label, e.g. partnered with"}/>
      <select value={claimId} onChange={e=>setClaimId(e.target.value)}><option value="">{ar?"دون ادعاء داعم":"No supporting claim"}</option>{claims.map(claim=><option key={claim.id} value={claim.id}>{claim.text.slice(0,100)}</option>)}</select>
      <button className="secondary-button" disabled={busy||entities.length<2}><Plus size={14}/>{ar?"حفظ العلاقة":"Save relationship"}</button>
    </form>
    <div className="entity-list">
      <h3>{ar?"العلاقات المسجلة":"Registered relationships"}</h3>
      {relationships.length ? relationships.map(item=><div className="evidence-record" key={item.id}><b>{entityName(item.fromEntityId)} — {item.relation} — {entityName(item.toEntityId)}</b><small>{item.evidenceState} · {item.claimIds.length} {ar?"ادعاءات داعمة":"supporting claims"}</small></div>) : <p className="muted">{ar?"لا توجد علاقات مسجلة.":"No relationships registered."}</p>}
    </div>
    {notice&&<p className="inline-feedback">{notice}</p>}
    <p className="evidence-disclaimer">{ar?"تنبيه: المطابقة تتم مع الأسماء والمرادفات التي أدخلها المستخدم فقط. لا يوجد حالياً تعرف آلي على الكيانات أو إزالة التباس عالمي أو استنتاج علاقات من النص.":"Important: matching uses only user-registered names and aliases. There is no automatic NER, global entity resolution, or relationship inference yet."}</p>
  </section>;
}
