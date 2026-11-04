import { useEffect, useState } from "react";
import { FilePenLine, Save, WandSparkles } from "lucide-react";
type Section={id:string;heading:string;brief:string;body:string};
type Draft={id:string;title?:string;dek?:string;metaTitle?:string;metaDescription?:string;editorialAngle:string;sections:Section[];status:string;generationMode:string;limitation:string};
export default function EditorialDraftPanel({apiBase,token,workspaceId,taskId,locale}:{apiBase:string;token:string;workspaceId:string;taskId:string;locale:"ar"|"en"}){
 const ar=locale==="ar";const [draft,setDraft]=useState<Draft|null>(null);const [busy,setBusy]=useState(false);const [notice,setNotice]=useState("");
 async function request(method:"GET"|"POST"|"PUT",body?:unknown){
  const r=await fetch(`${apiBase}/api/v1/workspaces/${encodeURIComponent(workspaceId)}/tasks/${encodeURIComponent(taskId)}/draft`,{method,headers:{"content-type":"application/json",authorization:`Bearer ${token}`},...(body?{body:JSON.stringify(body)}:{})});
  const p=await r.json();if(!r.ok)throw new Error(p.error||"Request failed");return p.draft as Draft|null;
 }
 useEffect(()=>{let active=true;if(!token.trim())return;request("GET").then(v=>{if(active)setDraft(v)}).catch(e=>{if(active)setNotice(e.message)});return()=>{active=false}},[apiBase,token,workspaceId,taskId]);
 async function generate(){setBusy(true);setNotice("");try{setDraft(await request("POST",{angle:"",audience:""}));setNotice(ar?"أُنشئ مخطط هيكلي. ليس مقالاً مولداً بالذكاء الاصطناعي.":"A structural outline was created. This is not AI-generated article content.");}catch(e){setNotice(e instanceof Error?e.message:"Error")}finally{setBusy(false)}}
 async function save(){if(!draft)return;setBusy(true);setNotice("");try{setDraft(await request("PUT",draft));setNotice(ar?"تم حفظ تعديلات المحرر.":"Editorial changes saved.");}catch(e){setNotice(e instanceof Error?e.message:"Error")}finally{setBusy(false)}}
 return <section className="surface-card create-card" style={{marginTop:16}}><div className="section-heading"><div><span className="tiny-overline">EDITORIAL DRAFT</span><h2>{ar?"مخطط ومسودة المقال":"Article outline & draft"}</h2></div><FilePenLine size={18}/></div>
 {!draft?<><p className="muted">{ar?"لا يوجد مخطط بعد. أنشئ هيكلاً تحريرياً منظماً للمقالة.":"No outline yet. Create a structured editorial scaffold."}</p><button className="primary-button" disabled={busy||!token.trim()} onClick={generate}><WandSparkles size={15}/>{ar?"إنشاء المخطط":"Create outline"}</button></>:<>
 <label className="budget-field"><span>{ar?"عنوان المقال":"Article title"}</span><input value={draft.title||""} onChange={e=>setDraft({...draft,title:e.target.value})}/></label>
 <label className="budget-field"><span>{ar?"زاوية المعالجة":"Editorial angle"}</span><textarea value={draft.editorialAngle||""} onChange={e=>setDraft({...draft,editorialAngle:e.target.value})}/></label>
 {draft.sections.map((section,i)=><div key={section.id} style={{display:"grid",gap:8,marginTop:14}}><label className="budget-field"><span>{ar?"عنوان القسم":"Section heading"} {i+1}</span><input value={section.heading} onChange={e=>setDraft({...draft,sections:draft.sections.map(x=>x.id===section.id?{...x,heading:e.target.value}:x)})}/></label><p className="muted">{section.brief}</p><textarea rows={5} value={section.body} placeholder={ar?"أدخل نصاً محرراً ومدعوماً بالمصادر...":"Enter human-edited, source-supported copy..."} onChange={e=>setDraft({...draft,sections:draft.sections.map(x=>x.id===section.id?{...x,body:e.target.value}:x)})}/></div>)}
 <div className="form-pair"><label className="budget-field"><span>Meta title</span><input value={draft.metaTitle||""} onChange={e=>setDraft({...draft,metaTitle:e.target.value})}/></label><label className="budget-field"><span>Meta description</span><input value={draft.metaDescription||""} onChange={e=>setDraft({...draft,metaDescription:e.target.value})}/></label></div>
 <button className="primary-button" disabled={busy} onClick={save}><Save size={15}/>{ar?"حفظ المسودة":"Save draft"}</button>
 <p className="form-note">{ar?"المخطط حتمي فقط. لا يوجد اتصال بنموذج لغوي أو بحث حي في هذه المرحلة.":"Deterministic scaffold only. No LLM provider or live search is connected in this phase."}</p>
 </>}
 {notice&&<p className="inline-feedback">{notice}</p>}</section>;
}
