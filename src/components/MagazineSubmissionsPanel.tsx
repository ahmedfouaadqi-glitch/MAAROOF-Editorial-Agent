import { useEffect, useMemo, useState, type FormEvent } from "react";
import { BookOpenText, CheckCircle2, Clock3, Send, ShieldCheck } from "lucide-react";

type Article = { id: string; topic: string; stage: string };
type Publication = { id: string; name: string; contentPurpose: string };
type Submission = {
  id: string; publicationId: string; proposedTitle: string; pitch: string; authorName: string;
  exclusivityConfirmed: boolean; status: string; history: Array<{status:string;at:string;note:string}>;
  createdAt: string; updatedAt: string;
};
const labels: Record<string,string> = {
  draft:"مسودة", approved:"موافق عليه", submitted:"تم تسجيل الإرسال", "editor-replied":"رد المحرر",
  accepted:"مقبول", rejected:"مرفوض", published:"مسجل كمنشور", withdrawn:"مسحوب"
};
const transitions: Record<string,string[]> = {
  draft:["approved","withdrawn"], approved:["draft","submitted","withdrawn"],
  submitted:["editor-replied","accepted","rejected","withdrawn"],
  "editor-replied":["submitted","accepted","rejected","withdrawn"],
  accepted:["published","withdrawn"], rejected:[], published:[], withdrawn:[]
};
export default function MagazineSubmissionsPanel({apiBase,token,workspaceId,articles,publications,locale}:{apiBase:string;token:string;workspaceId:string;articles:Article[];publications:Publication[];locale:"ar"|"en"}) {
  const ar=locale==="ar";
  const [taskId,setTaskId]=useState(articles[0]?.id||"");
  const [items,setItems]=useState<Submission[]>([]);
  const [publicationId,setPublicationId]=useState(publications[0]?.id||"");
  const [title,setTitle]=useState(""); const [pitch,setPitch]=useState(""); const [author,setAuthor]=useState("");
  const [exclusive,setExclusive]=useState(false); const [note,setNote]=useState("");
  const [notice,setNotice]=useState(""); const [busy,setBusy]=useState(false);
  const publicationMap=useMemo(()=>new Map(publications.map(p=>[p.id,p.name])),[publications]);
  async function load(){
    if(!token.trim()||!taskId)return;
    try { const r=await fetch(`${apiBase}/api/v1/workspaces/${encodeURIComponent(workspaceId)}/tasks/${encodeURIComponent(taskId)}/magazine-submissions`,{headers:{authorization:`Bearer ${token}`}});
      const p=await r.json(); if(!r.ok)throw new Error(p.error||"تعذر تحميل التقديمات"); setItems(p.submissions||[]); setNotice("");
    } catch(e){setNotice(e instanceof Error?e.message:"تعذر الاتصال بالخدمة");}
  }
  useEffect(()=>{void load();},[taskId,token,apiBase,workspaceId]);
  async function create(e:FormEvent){e.preventDefault();if(!token.trim()||!taskId)return;setBusy(true);setNotice("");
    try{const r=await fetch(`${apiBase}/api/v1/workspaces/${encodeURIComponent(workspaceId)}/tasks/${encodeURIComponent(taskId)}/magazine-submissions`,{method:"POST",headers:{"content-type":"application/json",authorization:`Bearer ${token}`},body:JSON.stringify({publicationId,proposedTitle:title,pitch,authorName:author,exclusivityConfirmed:exclusive})});
      const p=await r.json();if(!r.ok)throw new Error(p.error||"تعذر إنشاء السجل");setItems(v=>[p.submission,...v]);setTitle("");setPitch("");setNotice(ar?"تم حفظ مسودة التقديم محلياً؛ لم يتم إرسالها.":"Draft saved locally; nothing was sent.");
    }catch(e){setNotice(e instanceof Error?e.message:"تعذر الاتصال بالخدمة");}finally{setBusy(false);}
  }
  async function transition(item:Submission,nextStatus:string){setBusy(true);setNotice("");
    try{const r=await fetch(`${apiBase}/api/v1/workspaces/${encodeURIComponent(workspaceId)}/tasks/${encodeURIComponent(taskId)}/magazine-submissions/${encodeURIComponent(item.id)}/status`,{method:"PUT",headers:{"content-type":"application/json",authorization:`Bearer ${token}`},body:JSON.stringify({nextStatus,note})});
      const p=await r.json();if(!r.ok)throw new Error(p.error||"تعذر تغيير الحالة");setItems(v=>v.map(x=>x.id===item.id?p.submission:x));setNote("");setNotice(ar?"تم تحديث السجل.":"Record updated.");
    }catch(e){setNotice(e instanceof Error?e.message:"تعذر الاتصال بالخدمة");}finally{setBusy(false);}
  }
  return <section className="page-section">
    <div className="page-heading"><div><span className="tiny-overline">EDITORIAL SUBMISSIONS</span><h1>{ar?"إدارة تقديمات المجلات":"Magazine submissions"}</h1><p>{ar?"إنشاء pitch ومتابعة الموافقات والردود. كل الحالات تسجل محلياً ولا تعني إرسالاً خارجياً.":"Create pitches and track approvals and editor responses. Statuses are local records, not external submissions."}</p></div><span className="status-chip"><BookOpenText size={14}/>{items.length} {ar?"تقديم":"records"}</span></div>
    {!token.trim()&&<div className="form-note"><ShieldCheck size={15}/>{ar?"أدخل مفتاح الإدارة من صفحة المقالات أولاً.":"Enter the backend admin token on the Articles page first."}</div>}
    <div className="article-layout">
      <section className="surface-card create-card"><div className="card-topline"><span className="section-icon"><Send size={16}/></span><span className="tiny-overline">{ar?"تقديم جديد":"NEW PITCH"}</span></div>
        <form className="article-form" onSubmit={create}>
          <label>{ar?"المقالة المرتبطة":"Related article"}<select value={taskId} onChange={e=>setTaskId(e.target.value)}><option value="">{ar?"اختر مقالة":"Select an article"}</option>{articles.map(a=><option key={a.id} value={a.id}>{a.topic}</option>)}</select></label>
          <label>{ar?"المجلة / جهة النشر":"Publication"}<select value={publicationId} onChange={e=>setPublicationId(e.target.value)}>{publications.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
          <label>{ar?"العنوان المقترح":"Proposed title"}<input value={title} onChange={e=>setTitle(e.target.value)} required maxLength={300}/></label>
          <label>{ar?"نص العرض التحريري (Pitch)":"Pitch"}<textarea value={pitch} onChange={e=>setPitch(e.target.value)} required minLength={10} maxLength={12000} rows={5}/></label>
          <label>{ar?"اسم الكاتب":"Author name"}<input value={author} onChange={e=>setAuthor(e.target.value)} maxLength={160}/></label>
          <label className="form-note"><input type="checkbox" checked={exclusive} onChange={e=>setExclusive(e.target.checked)}/>{ar?"أؤكد مراجعة شرط الحصرية لدى جهة النشر":"I confirm the publication's exclusivity terms have been reviewed"}</label>
          <button className="primary-button" type="submit" disabled={busy||!token.trim()||!taskId||!publicationId}><Send size={14}/>{ar?"حفظ المسودة":"Save draft"}</button>
        </form>
      </section>
      <section className="surface-card create-card"><div className="section-heading"><div><span className="tiny-overline">TRACKING</span><h2>{ar?"سجل التقديمات":"Submission history"}</h2></div><span className="count-badge">{items.length}</span></div>
        {!items.length?<p className="muted">{ar?"لا توجد تقديمات لهذه المقالة.":"No submissions for this article."}</p>:items.map(item=><article key={item.id} className="submission-card" style={{borderTop:"1px solid var(--line)",padding:"14px 0",display:"grid",gap:9}}>
          <div style={{display:"flex",justifyContent:"space-between",gap:8}}><b>{item.proposedTitle}</b><span className="stage-pill">{labels[item.status]||item.status}</span></div>
          <small className="muted">{publicationMap.get(item.publicationId)||item.publicationId} · {new Date(item.updatedAt).toLocaleString(ar?"ar-IQ":"en-US")}</small>
          <p className="muted">{item.pitch}</p>
          <div className="form-note"><Clock3 size={14}/>{ar?"سجل زمني":"History"}: {item.history.length} {ar?"تحديث":"events"}</div>
          {transitions[item.status]?.length>0&&<div style={{display:"flex",flexWrap:"wrap",gap:6}}>{transitions[item.status].map(next=><button key={next} className="secondary-button" disabled={busy||!token.trim()||(next==="submitted"&&!item.exclusivityConfirmed)} onClick={()=>transition(item,next)}>{next==="approved"?(ar?"موافقة":"Approve"):next==="submitted"?(ar?"تسجيل الإرسال":"Record submitted"):next==="editor-replied"?(ar?"رد المحرر":"Editor replied"):next==="accepted"?(ar?"قبول":"Accept"):next==="rejected"?(ar?"رفض":"Reject"):next==="published"?(ar?"تسجيل النشر":"Record published"):(ar?"سحب":"Withdraw")}</button>)}</div>}
        </article>)}
      </section>
    </div>
    {notice&&<p className="inline-feedback">{notice}</p>}
    <div className="form-note"><ShieldCheck size={14}/>{ar?"تنبيه: Submitted وPublished حالتان يدويتان في قاعدة البيانات. لا يوجد إرسال فعلي أو تحقق من رابط منشور.":"Important: Submitted and Published are manually recorded states. No external send or publication URL verification is implemented."}</div>
  </section>;
}
