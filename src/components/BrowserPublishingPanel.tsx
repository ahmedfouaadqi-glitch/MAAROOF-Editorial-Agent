import { useEffect, useState, type FormEvent, type MouseEvent } from "react";
import { AlertTriangle, Check, ExternalLink, Globe2, LogIn, MonitorPlay, MousePointer2, ShieldCheck, Upload, X } from "lucide-react";

type Article = { id:string; topic:string; stage:string };
type Destination = {
  id:string; name:string; homepage:string; editorUrl:string; approvedHosts:string[];
  selectors:{title:string;body:string;imageUpload:string}; status:string; automaticPublishEnabled:boolean;
  authorityConfirmed:boolean; policyReviewed:boolean; limitations:string[]
};
type BrowserSession = {
  id:string; workspaceId:string; destinationId:string; state:string; currentUrl:string; title:string;
  createdAt:string; expiresAt:string; updatedAt?:string; lastError?:string|null
};
type Screenshot = {contentType:string;base64:string};
const keys=["Enter","Tab","Escape","Backspace","Delete","ArrowUp","ArrowDown","ArrowLeft","ArrowRight","Home","End","Space"];

export default function BrowserPublishingPanel({apiBase,token,workspaceId,articles,locale}:{apiBase:string;token:string;workspaceId:string;articles:Article[];locale:"ar"|"en"}){
  const ar=locale==="ar";
  const [destinations,setDestinations]=useState<Destination[]>([]);
  const [sessions,setSessions]=useState<BrowserSession[]>([]);
  const [destinationId,setDestinationId]=useState("");
  const [session,setSession]=useState<BrowserSession|null>(null);
  const [screenshot,setScreenshot]=useState<Screenshot|null>(null);
  const [taskId,setTaskId]=useState("");
  const [name,setName]=useState("");const [homepage,setHomepage]=useState("");const [editorUrl,setEditorUrl]=useState("");
  const [approvedHosts,setApprovedHosts]=useState("");const [titleSelector,setTitleSelector]=useState("");const [bodySelector,setBodySelector]=useState("");
  const [authorityConfirmed,setAuthorityConfirmed]=useState(false);const [policyReviewed,setPolicyReviewed]=useState(false);
  const [typingText,setTypingText]=useState("");const [key,setKey]=useState("Tab");
  const [busy,setBusy]=useState(false);const [notice,setNotice]=useState("");
  const readyArticles=articles.filter(article=>article.stage==="ready-to-publish");

  async function request(path:string,init:RequestInit={}){
    const response=await fetch(apiBase+path,{...init,headers:{authorization:`Bearer ${token}`,...(init.body?{"content-type":"application/json"}:{}),...init.headers}});
    let payload:any={};try{payload=await response.json();}catch{payload={};}
    if(!response.ok)throw new Error(payload.error||`HTTP ${response.status}`);
    return payload;
  }
  const destinationsPath=`/api/v1/workspaces/${encodeURIComponent(workspaceId)}/browser-destinations`;
  const sessionsPath=`/api/v1/workspaces/${encodeURIComponent(workspaceId)}/browser-sessions`;
  async function refreshLists(){
    if(!token.trim())return;
    try{
      const [destinationResult,sessionResult]=await Promise.all([request(destinationsPath),request(sessionsPath)]);
      const nextDestinations:Destination[]=destinationResult.destinations||[];
      const nextSessions:BrowserSession[]=sessionResult.sessions||[];
      setDestinations(nextDestinations);setSessions(nextSessions);
      setDestinationId(current=>current||nextDestinations[0]?.id||"");
      setSession(current=>current||nextSessions.find(item=>Date.parse(item.expiresAt)>Date.now())||null);
    }catch(error){setNotice(error instanceof Error?error.message:(ar?"تعذر تحميل الوجهات والجلسات":"Could not load destinations and sessions"));}
  }
  useEffect(()=>{void refreshLists();},[apiBase,token,workspaceId]);

  async function refreshFrame(sessionId:string){
    const root=`${sessionsPath}/${encodeURIComponent(sessionId)}`;
    const [statusResult,frameResult]=await Promise.all([request(root),request(`${root}/screenshot`)]);
    setSession(statusResult.session);setScreenshot(frameResult);
    setSessions(current=>current.map(item=>item.id===sessionId?statusResult.session:item));
  }
  useEffect(()=>{
    if(!session?.id||!token.trim())return;
    let active=true;
    const update=async()=>{try{const root=`${sessionsPath}/${encodeURIComponent(session.id)}`;const [s,f]=await Promise.all([request(root),request(`${root}/screenshot`)]);if(active){setSession(s.session);setScreenshot(f);setSessions(current=>current.map(item=>item.id===session.id?s.session:item));}}catch(error){if(active)setNotice(error instanceof Error?error.message:(ar?"انتهت جلسة المتصفح أو تعذر الاتصال":"Browser session expired or unavailable"));}};
    void update();const timer=window.setInterval(()=>void update(),3500);
    return()=>{active=false;window.clearInterval(timer);};
  },[apiBase,token,workspaceId,session?.id]);

  async function saveDestination(event:FormEvent){
    event.preventDefault();setBusy(true);setNotice("");
    try{
      const payload=await request(destinationsPath,{method:"POST",body:JSON.stringify({name,homepage,editorUrl,approvedHosts:approvedHosts.split(/[\\s,]+/).map(value=>value.trim()).filter(Boolean),titleSelector,bodySelector,authorityConfirmed,policyReviewed})});
      const item:Destination=payload.destination;
      setDestinations(current=>[item,...current.filter(existing=>existing.id!==item.id)]);setDestinationId(item.id);
      setNotice(ar?"حُفظت الوجهة كإعداد غير متحقق؛ لم تُنشر أي مادة.":"Destination saved as operator-declared and unverified; nothing was published.");
    }catch(error){setNotice(error instanceof Error?error.message:(ar?"تعذر حفظ الوجهة":"Could not save destination"));}
    finally{setBusy(false);}
  }
  async function startSession(){
    if(!destinationId)return;setBusy(true);setNotice("");setScreenshot(null);
    try{
      const payload=await request(sessionsPath,{method:"POST",body:JSON.stringify({destinationId})});
      setSession(payload.session);setSessions(current=>[payload.session,...current.filter(item=>item.id!==payload.session.id)]);
      setNotice(ar?"فتحت جلسة المتصفح. سجّل الدخول بنفسك؛ لا تُحفظ كلمة المرور ولا يتجاوز النظام MFA أو CAPTCHA.":"Browser session opened. Sign in yourself; passwords are not saved and MFA/CAPTCHA are not bypassed.");
      await refreshFrame(payload.session.id);
    }catch(error){setNotice(error instanceof Error?error.message:(ar?"تعذر فتح جلسة المتصفح":"Could not open browser session"));}
    finally{setBusy(false);}
  }
  async function act(action:Record<string,unknown>){
    if(!session)return;setBusy(true);setNotice("");
    try{
      const root=`${sessionsPath}/${encodeURIComponent(session.id)}`;
      const payload=await request(`${root}/actions`,{method:"POST",body:JSON.stringify(action)});
      setSession(payload.session);setSessions(current=>current.map(item=>item.id===session.id?payload.session:item));
      await refreshFrame(session.id);
    }catch(error){setNotice(error instanceof Error?error.message:(ar?"تعذر تنفيذ الإجراء":"Browser action failed"));}
    finally{setBusy(false);}
  }
  async function clickRemote(event:MouseEvent<HTMLButtonElement>){
    if(!screenshot||!session)return;
    const rect=event.currentTarget.getBoundingClientRect();if(!rect.width||!rect.height)return;
    await act({type:"click",x:Math.round((event.clientX-rect.left)*1440/rect.width),y:Math.round((event.clientY-rect.top)*1000/rect.height)});
  }
  async function typeText(){
    const text=typingText;setTypingText("");if(text)await act({type:"type",text});
  }
  async function fillApprovedArticle(){
    if(!session||!taskId)return;setBusy(true);setNotice("");
    try{
      const payload=await request(`${sessionsPath}/${encodeURIComponent(session.id)}/fill-article`,{method:"POST",body:JSON.stringify({taskId})});
      setSession(payload.session);setSessions(current=>current.map(item=>item.id===session.id?payload.session:item));
      setNotice(payload.note|| (ar?"أُدرج نص المقال المعتمد؛ راجع الصفحة وأكمل الإرسال بنفسك إن رغبت.":"Approved article text inserted; review the page and submit manually if desired."));
      await refreshFrame(session.id);
    }catch(error){setNotice(error instanceof Error?error.message:(ar?"تعذر إدراج المقال":"Could not insert article"));}
    finally{setBusy(false);}
  }
  async function closeSession(){
    if(!session)return;setBusy(true);
    try{await request(`${sessionsPath}/${encodeURIComponent(session.id)}`,{method:"DELETE"});setSessions(current=>current.filter(item=>item.id!==session.id));setSession(null);setScreenshot(null);setNotice(ar?"أُغلقت الجلسة وأُزيلت بياناتها المؤقتة من العامل.":"Session closed and its in-memory browser state removed.");}
    catch(error){setNotice(error instanceof Error?error.message:(ar?"تعذر إغلاق الجلسة":"Could not close session"));}
    finally{setBusy(false);}
  }

  return <section className="page-section browser-publishing-page">
    <div className="page-heading"><div><span className="tiny-overline">USER-CONTROLLED BROWSER HANDOFF</span><h1>{ar?"النشر عبر المتصفح":"Browser publishing handoff"}</h1><p>{ar?"افتح وجهة تملكها أو لديك تفويض لها، سجّل الدخول بنفسك، وانقل نص المقال المعتمد للمراجعة. لا يوجد نشر آلي.":"Open a destination you own or are authorized to use, sign in yourself, and transfer approved article text for review. No automated publishing."}</p></div><span className="status-chip"><MonitorPlay size={14}/>{ar?"مراجعة بشرية":"Human-controlled"}</span></div>
    {!token.trim()&&<div className="form-note"><ShieldCheck size={15}/>{ar?"أدخل ADMIN_API_TOKEN في صفحة المقالات أولاً.":"Enter ADMIN_API_TOKEN on the Articles page first."}</div>}
    <div className="browser-safety-note"><AlertTriangle size={17}/><div><b>{ar?"لا تُدخل بيانات الدخول في إعدادات الوجهة":"Never put login credentials in destination settings"}</b><p>{ar?"استخدم لقطة المتصفح التفاعلية لتسجيل الدخول. لا يحفظ التطبيق كلمات المرور، ولا يتجاوز MFA أو CAPTCHA. راجع النص والوجهة في الموقع قبل أن تضغط أي زر إرسال بنفسك.":"Use the interactive browser screenshot to sign in. The app does not store passwords or bypass MFA/CAPTCHA. Review the text and destination on the site before you personally press any submit button."}</p></div></div>
    <div className="browser-layout">
      <section className="surface-card create-card browser-setup-card">
        <div className="section-heading"><div><span className="tiny-overline">DESTINATION PROFILE</span><h2>{ar?"تسجيل وجهة مسموح بها":"Register an allowed destination"}</h2><p>{ar?"أدخل نطاق الموقع وصفحة المحرر ومحددات الحقول المناسبة له.":"Enter the site domain, editor page, and selectors for its fields."}</p></div><Globe2 size={18}/></div>
        <form className="article-form" onSubmit={saveDestination}>
          <label>{ar?"اسم الوجهة":"Destination name"}<input required minLength={2} maxLength={120} value={name} onChange={event=>setName(event.target.value)} placeholder={ar?"مثال: مدونة الشركة":"e.g. Company blog"}/></label>
          <label>{ar?"رابط الموقع (HTTPS)":"Homepage URL (HTTPS)"}<input required type="url" value={homepage} onChange={event=>setHomepage(event.target.value)} placeholder="https://example.com"/></label>
          <label>{ar?"رابط صفحة المحرر أو الدخول":"Editor or login URL"}<input type="url" value={editorUrl} onChange={event=>setEditorUrl(event.target.value)} placeholder="https://example.com/editor"/></label>
          <label>{ar?"المضيفون المسموحون (سطر أو فاصلة لكل مضيف)":"Approved hosts (one per line or comma-separated)"}<textarea required rows={2} value={approvedHosts} onChange={event=>setApprovedHosts(event.target.value)} placeholder="example.com\naccounts.example.com"/></label>
          <label>{ar?"محدد CSS لحقل العنوان":"CSS selector for title field"}<input required maxLength={500} value={titleSelector} onChange={event=>setTitleSelector(event.target.value)} placeholder='input[name="title"]'/></label>
          <label>{ar?"محدد CSS لحقل النص":"CSS selector for article body"}<input required maxLength={500} value={bodySelector} onChange={event=>setBodySelector(event.target.value)} placeholder='[contenteditable="true"]'/></label>
          <label className="browser-confirm"><input type="checkbox" required checked={authorityConfirmed} onChange={event=>setAuthorityConfirmed(event.target.checked)}/>{ar?"أؤكد أنني أملك هذه الوجهة أو مفوض بالنشر فيها.":"I confirm I own this destination or am authorized to publish there."}</label>
          <label className="browser-confirm"><input type="checkbox" required checked={policyReviewed} onChange={event=>setPolicyReviewed(event.target.checked)}/>{ar?"راجعت سياسة الموقع وقواعد النشر المناسبة.":"I reviewed the site's terms and applicable publishing rules."}</label>
          <button className="secondary-button" disabled={busy||!token.trim()}><Check size={14}/>{ar?"حفظ الوجهة":"Save destination"}</button>
        </form>
        {!!destinations.length&&<div className="browser-destination-list"><h3>{ar?"الوجهات المحفوظة":"Saved destinations"}</h3>{destinations.map(item=><label key={item.id} className="browser-destination-row"><input type="radio" name="browser-destination" checked={destinationId===item.id} onChange={()=>setDestinationId(item.id)}/><span><b>{item.name}</b><small>{item.homepage} · {item.status}</small></span></label>)}</div>}
      </section>
      <section className="surface-card create-card browser-session-card">
        <div className="section-heading"><div><span className="tiny-overline">REMOTE BROWSER</span><h2>{ar?"جلسة الدخول والمعاينة":"Sign-in and review session"}</h2><p>{ar?"تفاعل مع الصفحة الظاهرة كما في المتصفح؛ تنتهي الجلسة بعد مدة أو عند إغلاقها.":"Interact with the visible page as in a browser; the session expires or closes on request."}</p></div><LogIn size={18}/></div>
        <div className="browser-session-controls"><button className="primary-button" disabled={busy||!token.trim()||!destinationId} onClick={startSession}><LogIn size={14}/>{ar?"فتح جلسة المتصفح":"Open browser session"}</button>{session&&<button className="secondary-button" disabled={busy} onClick={closeSession}><X size={14}/>{ar?"إغلاق الجلسة":"Close session"}</button>}</div>
        {sessions.length>0&&<label className="browser-session-select">{ar?"جلسة نشطة":"Active session"}<select value={session?.id||""} onChange={event=>{setSession(sessions.find(item=>item.id===event.target.value)||null);setScreenshot(null);}}>{sessions.map(item=><option key={item.id} value={item.id}>{item.title||item.id} · {item.state}</option>)}</select></label>}
        {session&&<div className="browser-session-meta"><b>{session.title||session.state}</b><small>{session.currentUrl}</small><small>{ar?"تنتهي:":"Expires:"} {new Date(session.expiresAt).toLocaleString(ar?"ar-IQ":"en-US")}</small></div>}
        {session&&screenshot&&<div className="browser-remote-frame"><button className="browser-screenshot" type="button" onClick={clickRemote} aria-label={ar?"انقر داخل لقطة المتصفح":"Click inside browser screenshot"}><img src={`data:${screenshot.contentType};base64,${screenshot.base64}`} alt={ar?"لقطة شاشة تفاعلية للمتصفح البعيد":"Interactive remote browser screenshot"}/><span><MousePointer2 size={13}/>{ar?"انقر داخل الصفحة لإدخال المؤشر":"Click the page to focus an element"}</span></button></div>}
        {session&&<div className="browser-interaction-controls"><label>{ar?"اكتب في الحقل المركّز (لا يُحفظ نص الإدخال)":"Type into the focused field (input is not saved)"}<input type="password" autoComplete="off" value={typingText} onChange={event=>setTypingText(event.target.value)} onKeyDown={event=>{if(event.key==="Enter"){event.preventDefault();void typeText();}}}/></label><button className="secondary-button" disabled={busy||!typingText} onClick={()=>void typeText()}>{ar?"إرسال الكتابة":"Send keystrokes"}</button><label>{ar?"مفتاح مسموح":"Allowed key"}<select value={key} onChange={event=>setKey(event.target.value)}>{keys.map(item=><option key={item}>{item}</option>)}</select></label><button className="secondary-button" disabled={busy} onClick={()=>void act({type:"press",key})}>{ar?"ضغط المفتاح":"Press key"}</button><button className="secondary-button" disabled={busy} onClick={()=>void act({type:"scroll",deltaY:500})}>{ar?"تمرير لأسفل":"Scroll down"}</button><button className="secondary-button" disabled={busy} onClick={()=>void act({type:"scroll",deltaY:-500})}>{ar?"تمرير لأعلى":"Scroll up"}</button></div>}
        {session&&<div className="browser-fill-article"><label>{ar?"مقالة معتمدة لإدراجها":"Approved article to insert"}<select value={taskId} onChange={event=>setTaskId(event.target.value)}><option value="">{ar?"اختر مقالة جاهزة ومعتمدة":"Select a ready, approved article"}</option>{readyArticles.map(article=><option key={article.id} value={article.id}>{article.topic}</option>)}</select></label><button className="secondary-button" disabled={busy||!taskId||!readyArticles.some(article=>article.id===taskId)} onClick={()=>void fillApprovedArticle()}><Upload size={14}/>{ar?"إدراج النص في المحرر":"Insert text into editor"}</button><p className="form-note">{ar?"لا تُرفق ملفات الوسائط في هذه الدفعة. لا يضغط التطبيق زر الحفظ أو النشر؛ راجع الصفحة وأكمل يدوياً.":"Media files are not attached in this phase. The app does not click Save or Publish; review the page and continue manually."}</p></div>}
        {!session&&<div className="browser-empty"><MonitorPlay size={23}/><p>{ar?"احفظ وجهة مفوضاً بها ثم افتح جلسة لتسجيل الدخول. يتطلب تشغيل العامل الخاص إعداد BROWSER_AGENT_TOKEN وتثبيت Chromium.":"Save an authorized destination, then open a session to sign in. The private worker requires BROWSER_AGENT_TOKEN and an installed Chromium browser."}</p></div>}
      </section>
    </div>
    {notice&&<p className="inline-feedback">{notice}</p>}
    <div className="browser-footer-note"><ExternalLink size={14}/>{ar?"هذه جلسة وسيطة للتعبئة والمراجعة فقط؛ حالة الوجهة غير متحققة، والنشر الفعلي والتحقق من الرابط غير متاحين بعد.":"This is a fill-and-review handoff only; the destination remains unverified, and external publishing/link verification are not implemented."}</div>
  </section>;
}
