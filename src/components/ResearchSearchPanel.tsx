import { useState, type FormEvent } from "react";
import { Globe2, LoaderCircle, Plus, Search } from "lucide-react";
type Result={url:string;title:string;snippet:string;publisher:string;publishedAt:string|null;provider:string;verificationState:string};
type Props={apiBase:string;token:string;workspaceId:string;taskId:string;language:"ar"|"en";locale:"ar"|"en"};
export default function ResearchSearchPanel({apiBase,token,workspaceId,taskId,language,locale}:Props){
 const ar=locale==="ar";const [query,setQuery]=useState("");const [country,setCountry]=useState("IQ");
 const [results,setResults]=useState<Result[]>([]);const [registered,setRegistered]=useState<string[]>([]);
 const [busy,setBusy]=useState(false);const [adding,setAdding]=useState<string|null>(null);const [notice,setNotice]=useState("");const [provider,setProvider]=useState("");
 async function request(path:string,init:RequestInit={}){
  const response=await fetch(apiBase+path,{...init,headers:{authorization:`Bearer ${token}`,...(init.body?{"content-type":"application/json"}:{}),...init.headers}});
  const payload=await response.json();if(!response.ok)throw new Error(payload.error||"Request failed");return payload;
 }
 async function search(event:FormEvent){
  event.preventDefault();if(!query.trim())return;setBusy(true);setNotice("");setResults([]);setRegistered([]);
  try{const payload=await request(`/api/v1/workspaces/${encodeURIComponent(workspaceId)}/tasks/${encodeURIComponent(taskId)}/research/searches`,{method:"POST",body:JSON.stringify({query,language,country,limit:10})});
   setResults(payload.result.results||[]);setProvider(payload.result.provider||"");setNotice(ar?"نتائج البحث مؤشرات أولية فقط؛ لم يتم فتح الصفحات أو التحقق من محتواها.":"Search results are discovery leads only; pages were not opened or verified.");
  }catch(e){setNotice(e instanceof Error?e.message:"Search failed");}finally{setBusy(false);}
 }
 async function addSource(item:Result){
  setAdding(item.url);setNotice("");
  try{await request("/api/v1/sources",{method:"POST",body:JSON.stringify({workspaceId,taskId,url:item.url,title:item.title,notes:[item.publisher,item.publishedAt||"",item.snippet,"Search discovery result; not opened or verified."].filter(Boolean).join("\n")})});
   setRegistered(old=>[...old,item.url]);setNotice(ar?"أضيف المرجع إلى مصادر المقالة، دون جلب محتواه.":"Reference added to article sources; its content was not fetched.");
  }catch(e){setNotice(e instanceof Error?e.message:"Unable to register source");}finally{setAdding(null);}
 }
 return <section className="surface-card evidence-panel" style={{marginTop:16}}>
  <div className="section-heading"><div><span className="tiny-overline">LIVE RESEARCH</span><h2>{ar?"البحث عن مصادر للمقالة":"Find article sources"}</h2><p>{ar?"بحث حي اختياري بمزود خارجي مضبوط في الخادم":"Optional live search through a server-configured provider"}</p></div><Globe2 size={18}/></div>
  <form className="evidence-form" onSubmit={search}>
   <textarea required minLength={2} maxLength={500} rows={2} value={query} onChange={e=>setQuery(e.target.value)} placeholder={ar?"اكتب سؤال البحث أو الكلمات المفتاحية...":"Enter a research question or keywords..."}/>
   <div className="form-pair"><label>{ar?"لغة النتائج":"Result language"}<select value={language} disabled><option value="ar">العربية</option><option value="en">English</option></select></label><label>{ar?"السوق / الدولة":"Market / country"}<select value={country} onChange={e=>setCountry(e.target.value)}>{[["IQ","العراق / Iraq"],["AE","الإمارات / UAE"],["SA","السعودية / Saudi Arabia"],["US","United States"],["GB","United Kingdom"],["TR","Türkiye"],["JO","Jordan"],["EG","Egypt"]].map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label></div>
   <button className="primary-button" disabled={busy||!token.trim()}>{busy?<LoaderCircle size={15} className="spin"/>:<Search size={15}/>}{ar?"تنفيذ البحث":"Run search"}</button>
  </form>
  {provider&&<p className="form-note">{ar?"مزود البحث: ":"Search provider: "}{provider}</p>}
  {results.map((item,index)=><article key={item.url} className="evidence-record">
   <b>{index+1}. {item.title}</b><small>{item.publisher}{item.publishedAt?" · "+new Date(item.publishedAt).toLocaleDateString():""}</small>
   <a href={item.url} target="_blank" rel="noreferrer">{item.url}</a><p>{item.snippet}</p>
   <small>{ar?"نتيجة بحث غير متحققة":"Unverified search result"}</small>
   <button className="secondary-button" disabled={adding===item.url||registered.includes(item.url)} onClick={()=>addSource(item)}><Plus size={14}/>{registered.includes(item.url)?(ar?"أُضيف للمصادر":"Added to sources"):(ar?"إضافة إلى مصادر المقالة":"Add to article sources")}</button>
  </article>)}
  {notice&&<p className="inline-feedback">{notice}</p>}
 </section>;
}
