import { useEffect, useState, type FormEvent } from "react";
import { CheckCircle2, ClipboardCheck, Image, ShieldAlert, ShieldCheck, ScanSearch } from "lucide-react";
type Approval={readyForApproval:boolean;blockers:string[];warnings:string[];approvedForCurrentDraft:boolean;latestReview?:{decision:string;reviewerName:string;rationale:string;current:boolean}|null;originality:{checked:boolean;outcome:string|null};evidence:{sourceCount:number;claimCount:number;evidenceExcerptCount:number;conflictingClaimCount:number}};
type MediaState={reviewCurrent:boolean;approvedForCurrentDraft:boolean;review:{decision:string;reviewerName:string;rationale:string;assets:Array<{url:string;creator:string;license:string;attribution:string;altText:string;rightsConfirmed:boolean}>}|null};
type Props={apiBase:string;token:string;workspaceId:string;taskId:string;stage:string;locale:"ar"|"en"};
export default function EditorialReviewPanel({apiBase,token,workspaceId,taskId,stage,locale}:Props){
 const ar=locale==="ar";const [approval,setApproval]=useState<Approval|null>(null);const [media,setMedia]=useState<MediaState|null>(null);
 const [reviewer,setReviewer]=useState("");const [rationale,setRationale]=useState("");const [decision,setDecision]=useState<"approved"|"changes-requested"|"rejected">("approved");
 const [mediaDecision,setMediaDecision]=useState<"approved"|"not-required"|"changes-requested">("not-required");
 const [assetUrl,setAssetUrl]=useState("");const [creator,setCreator]=useState("");const [license,setLicense]=useState("");const [attribution,setAttribution]=useState("");const [altText,setAltText]=useState("");const [rightsConfirmed,setRightsConfirmed]=useState(false);
 const [busy,setBusy]=useState(false);const [notice,setNotice]=useState("");
 async function request(path:string,init:RequestInit={}){
  const r=await fetch(apiBase+path,{...init,headers:{authorization:`Bearer ${token}`,...(init.body?{"content-type":"application/json"}:{}),...init.headers}});
  const p=await r.json();if(!r.ok){const details=Array.isArray(p.details)?": "+p.details.join(", "):"";throw new Error((p.error||"Request failed")+details);}return p;
 }
 const root=`/api/v1/workspaces/${encodeURIComponent(workspaceId)}/tasks/${encodeURIComponent(taskId)}`;
 async function refresh(){const [a,m]=await Promise.all([request(root+"/approval"),request(root+"/media-review")]);setApproval(a.approval);setMedia(m.mediaReview);}
 useEffect(()=>{let active=true;if(!token.trim())return;Promise.all([request(root+"/approval"),request(root+"/media-review")]).then(([a,m])=>{if(!active)return;setApproval(a.approval);setMedia(m.mediaReview);}).catch(e=>{if(active)setNotice(e instanceof Error?e.message:"Unable to load editorial review");});return()=>{active=false}},[apiBase,token,workspaceId,taskId,stage]);
 async function checkOriginality(){setBusy(true);setNotice("");try{await request(root+"/originality/check-draft",{method:"POST",body:"{}"});await refresh();setNotice(ar?"اكتمل فحص النسخة الحالية محلياً.":"Current draft originality check completed locally.");}catch(e){setNotice(e instanceof Error?e.message:"Originality check failed");}finally{setBusy(false)}}
 async function saveMedia(event:FormEvent){event.preventDefault();setBusy(true);setNotice("");try{
  const assets=mediaDecision==="approved"?[{url:assetUrl,creator,license,attribution,altText,rightsConfirmed}]:[];
  await request(root+"/media-review",{method:"POST",body:JSON.stringify({decision:mediaDecision,reviewerName:reviewer,rationale,assets})});
  await refresh();setNotice(ar?"تم تسجيل مراجعة الوسائط وحقوق الاستخدام.":"Media and usage-rights review recorded.");
 }catch(e){setNotice(e instanceof Error?e.message:"Media review failed");}finally{setBusy(false)}}
 async function saveEditorialReview(event:FormEvent){event.preventDefault();setBusy(true);setNotice("");try{
  await request(root+"/approval",{method:"POST",body:JSON.stringify({decision,reviewerName:reviewer,rationale})});
  await refresh();setNotice(ar?"تم تسجيل القرار التحريري على نسخة المقال الحالية.":"Editorial decision recorded against the current draft version.");
 }catch(e){setNotice(e instanceof Error?e.message:"Editorial review failed");}finally{setBusy(false)}}
 const label=(key:string)=>({ "draft-missing":"المسودة غير موجودة","title-missing":"عنوان المقال مطلوب","insufficient-sections":"عدد الأقسام غير كافٍ","incomplete-sections":"توجد أقسام بلا نص","meta-title-missing":"Meta Title غير موجود","meta-description-missing":"Meta Description غير موجود","no-registered-sources":"لا توجد مصادر مسجلة","claims-without-sources":"ادعاءات بلا مصادر مرتبطة","claims-without-evidence-excerpts":"ادعاءات بلا مقتطفات أدلة","current-draft-originality-check-missing":"يلزم فحص أصالة النسخة الحالية","claims-missing":"لا توجد ادعاءات مسجلة","source-assessment-missing":"توجد مصادر بلا تقييم"} as Record<string,string>)[key]||key;
 return <section className="surface-card evidence-panel" style={{marginTop:16}}>
  <div className="section-heading"><div><span className="tiny-overline">EDITORIAL QUALITY GATES</span><h2>{ar?"المراجعة التحريرية والاعتماد":"Editorial review & approval"}</h2><p>{ar?"القرار مرتبط ببصمة نسخة المقال الحالية":"Decisions are bound to the current article version"}</p></div><ShieldCheck size={18}/></div>
  {!token.trim()?<p className="evidence-notice"><ShieldAlert size={15}/>{ar?"أدخل مفتاح الإدارة لعرض المراجعة.":"Enter the admin token to load reviews."}</p>:<>
   <div className="evidence-summary"><div><b>{approval?.evidence.sourceCount??0}</b><span>{ar?"مصادر":"Sources"}</span></div><div><b>{approval?.evidence.claimCount??0}</b><span>{ar?"ادعاءات":"Claims"}</span></div><div><b>{approval?.evidence.evidenceExcerptCount??0}</b><span>{ar?"مقتطفات الأدلة":"Evidence excerpts"}</span></div><div><b>{approval?.evidence.conflictingClaimCount??0}</b><span>{ar?"تعارضات":"Conflicts"}</span></div></div>
   <div className="evidence-form">
    <h3><ScanSearch size={15}/>{ar?"فحص أصالة المسودة":"Current draft originality"}</h3>
    <p className="form-note">{ar?"مقارنة محلية فقط مع النصوص السابقة داخل مساحة العمل؛ لا تشمل الويب أو إعادة الصياغة الدلالية أو الترجمة.":"Local workspace comparison only; no external web corpus, semantic paraphrase, or translation analysis."}</p>
    <p className="form-note">{ar?"الحالة: ":"Status: "}{approval?.originality.checked?(approval.originality.outcome||"checked"):(ar?"لم يُفحص":"Not checked")}</p>
    <button className="secondary-button" disabled={busy||!token.trim()} onClick={checkOriginality}><ScanSearch size={14}/>{ar?"فحص النسخة الحالية":"Check current draft"}</button>
   </div>
   <form className="evidence-form" onSubmit={saveMedia} style={{marginTop:14}}>
    <h3><Image size={15}/>{ar?"مراجعة الوسائط والحقوق":"Media and rights review"}</h3>
    <label>{ar?"قرار الوسائط":"Media decision"}<select value={mediaDecision} onChange={e=>setMediaDecision(e.target.value as typeof mediaDecision)}><option value="not-required">{ar?"لا تحتاج المقالة إلى وسائط":"No media required"}</option><option value="approved">{ar?"اعتماد وسائط مسجلة":"Approve listed media"}</option><option value="changes-requested">{ar?"تعديلات مطلوبة":"Changes requested"}</option></select></label>
    {mediaDecision==="approved"&&<><input required type="url" value={assetUrl} onChange={e=>setAssetUrl(e.target.value)} placeholder="https://... media URL"/><input required value={creator} onChange={e=>setCreator(e.target.value)} placeholder={ar?"المبدع / المصور":"Creator / photographer"}/><input required value={license} onChange={e=>setLicense(e.target.value)} placeholder={ar?"الترخيص":"License"} /><input required value={attribution} onChange={e=>setAttribution(e.target.value)} placeholder={ar?"نص الإسناد":"Attribution text"}/><input required value={altText} onChange={e=>setAltText(e.target.value)} placeholder="Alt text"/><label><input type="checkbox" checked={rightsConfirmed} onChange={e=>setRightsConfirmed(e.target.checked)}/>{ar?"أؤكد امتلاك حق الاستخدام أو وجود ترخيص يسمح به":"I confirm usage rights or an applicable license"}</label></>}
    <input required value={reviewer} onChange={e=>setReviewer(e.target.value)} placeholder={ar?"اسم المراجع":"Reviewer name"}/>
    <textarea required minLength={10} rows={2} value={rationale} onChange={e=>setRationale(e.target.value)} placeholder={ar?"سبب القرار وملاحظات المراجعة":"Decision rationale and review notes"}/>
    <button className="secondary-button" disabled={busy}>{ar?"تسجيل مراجعة الوسائط":"Record media review"}</button>
    {media?.review&&<p className="form-note">{ar?"آخر مراجعة: ":"Latest review: "}{media.review.decision} · {media.reviewCurrent?(ar?"صالحة للنسخة الحالية":"Current version"):(ar?"قديمة — يلزم إعادة المراجعة":"Stale — review again")}</p>}
    <p className="form-note">{ar?"هذه مراجعة لروابط وسائط مسجلة وليست رفع ملفات أو فحصاً آلياً للحقوق.":"This reviews externally hosted media references; it does not upload files or independently verify rights."}</p>
   </form>
   <form className="evidence-form" onSubmit={saveEditorialReview} style={{marginTop:14}}>
    <h3><ClipboardCheck size={15}/>{ar?"قرار الاعتماد التحريري":"Editorial decision"}</h3>
    <p className="form-note">{ar?"العوائق تمنع الاعتماد، والموافقة تسري على بصمة المسودة الحالية فقط.":"Blockers prevent approval; approval is valid only for the current draft fingerprint."}</p>
    {approval?.blockers?.length?<ul>{approval.blockers.map(x=><li key={x}>{label(x)}</li>)}</ul>:<p className="form-note">{ar?"لا توجد عوائق بنيوية معلقة.":"No structural blockers are pending."}</p>}
    {approval?.warnings?.map(x=><p key={x} className="form-note">{x}</p>)}
    <label>{ar?"القرار":"Decision"}<select value={decision} onChange={e=>setDecision(e.target.value as typeof decision)}><option value="approved">{ar?"موافقة":"Approved"}</option><option value="changes-requested">{ar?"تعديلات مطلوبة":"Changes requested"}</option><option value="rejected">{ar?"مرفوض":"Rejected"}</option></select></label>
    <input required value={reviewer} onChange={e=>setReviewer(e.target.value)} placeholder={ar?"اسم المراجع":"Reviewer name"}/>
    <textarea required minLength={10} rows={3} value={rationale} onChange={e=>setRationale(e.target.value)} placeholder={ar?"اكتب مبررات القرار التحريري...":"Enter the editorial decision rationale..."}/>
    <button className="primary-button" disabled={busy||stage!=="editorial-approval"||!approval?.readyForApproval}>{ar?"تسجيل القرار التحريري":"Record editorial decision"}</button>
    {stage!=="editorial-approval"&&<p className="form-note">{ar?"تُسجل الموافقة فقط عندما تصل المقالة إلى مرحلة الموافقة التحريرية.":"The decision can be recorded only during the editorial-approval stage."}</p>}
    {approval?.latestReview&&<p className="form-note">{ar?"آخر قرار: ":"Latest decision: "}{approval.latestReview.decision} · {approval.latestReview.reviewerName} · {approval.latestReview.current?(ar?"للنسخة الحالية":"Current version"):(ar?"نسخة قديمة":"Stale version")}</p>}
    <p className="form-note">{ar?"تسجيل الموافقة لا ينشر المقالة. النشر الفعلي يحتاج موصلاً وحساباً مصرحاً به وموافقة مستقلة.":"Recording approval does not publish. Publishing requires an authorized connector, account, and separate approval."}</p>
   </form>
  </>}
  {notice&&<p className="inline-feedback">{notice}</p>}
 </section>;
}
