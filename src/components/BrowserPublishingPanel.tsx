import { useEffect, useState, type FormEvent, type MouseEvent } from "react";
import { AlertTriangle, ArrowUpLeft, Check, ExternalLink, Globe2, LogIn, MonitorPlay, MousePointer2, ShieldCheck, Upload, X } from "lucide-react";
import type { EditorialChatBrowserDraft } from "../types/editorial-chat";

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
const keys=["Enter","Tab","Escape","Backspace","Delete","ArrowUp","ArrowDown","ArrowLeft","ArrowRight","Home","End","Space"] as const;
type BrowserKey = typeof keys[number];
const browserKeySet = new Set<string>(keys);
function isBrowserKey(value:string):value is BrowserKey{return browserKeySet.has(value);}
type BrowserAction =
  | {type:"click";x:number;y:number}
  | {type:"type"|"paste";text:string}
  | {type:"press";key:BrowserKey}
  | {type:"scroll";deltaY:number}
  | {type:"navigate";url:string}
  | {type:"fill";selector:string;value:string};
type JsonRecord = Record<string,unknown>;
function isRecord(value:unknown):value is JsonRecord{return typeof value==="object"&&value!==null&&!Array.isArray(value);}
function record(value:unknown,label:string):JsonRecord{if(!isRecord(value))throw new Error(`Invalid ${label} response`);return value;}
function stringField(value:JsonRecord,key:string,label:string):string{const field=value[key];if(typeof field!=="string")throw new Error(`Invalid ${label} response`);return field;}
function parseDestination(value:unknown):Destination{
  const item=record(value,"destination"),selectors=record(item.selectors,"destination selectors");
  if(!Array.isArray(item.approvedHosts)||!item.approvedHosts.every(host=>typeof host==="string")||!Array.isArray(item.limitations)||!item.limitations.every(note=>typeof note==="string"))throw new Error("Invalid destination lists");
  if(typeof item.automaticPublishEnabled!=="boolean"||typeof item.authorityConfirmed!=="boolean"||typeof item.policyReviewed!=="boolean")throw new Error("Invalid destination flags");
  return {id:stringField(item,"id","destination"),name:stringField(item,"name","destination"),homepage:stringField(item,"homepage","destination"),editorUrl:stringField(item,"editorUrl","destination"),approvedHosts:item.approvedHosts,status:stringField(item,"status","destination"),automaticPublishEnabled:item.automaticPublishEnabled,authorityConfirmed:item.authorityConfirmed,policyReviewed:item.policyReviewed,limitations:item.limitations,selectors:{title:stringField(selectors,"title","destination selectors"),body:stringField(selectors,"body","destination selectors"),imageUpload:stringField(selectors,"imageUpload","destination selectors")}};
}
function parseSession(value:unknown):BrowserSession{
  const item=record(value,"browser session");
  const updatedAt=item.updatedAt,lastError=item.lastError;
  if(updatedAt!==undefined&&typeof updatedAt!=="string")throw new Error("Invalid browser session response");
  if(lastError!==undefined&&lastError!==null&&typeof lastError!=="string")throw new Error("Invalid browser session response");
  return {id:stringField(item,"id","browser session"),workspaceId:stringField(item,"workspaceId","browser session"),destinationId:stringField(item,"destinationId","browser session"),state:stringField(item,"state","browser session"),currentUrl:stringField(item,"currentUrl","browser session"),title:stringField(item,"title","browser session"),createdAt:stringField(item,"createdAt","browser session"),expiresAt:stringField(item,"expiresAt","browser session"),...(typeof updatedAt==="string"?{updatedAt}:{}),...(typeof lastError==="string"||lastError===null?{lastError}:{})};
}
function parseScreenshot(value:unknown):Screenshot{
  const item=record(value,"browser screenshot"),contentType=stringField(item,"contentType","browser screenshot"),base64=stringField(item,"base64","browser screenshot");
  if(!["image/jpeg","image/png"].includes(contentType)||base64.length>16_000_000||!/^[A-Za-z0-9+/]*={0,2}$/.test(base64))throw new Error("Invalid browser screenshot response");
  return {contentType,base64};
}
function parseArray<T>(value:unknown,key:string,parse:(item:unknown)=>T):T[]{const item=record(value,"API");if(!Array.isArray(item[key]))throw new Error(`Invalid ${key} response`);return item[key].map(parse);}
function parseSessionEnvelope(value:unknown):BrowserSession{return parseSession(record(value,"API").session);}
function apiError(value:unknown,fallback:string):string{return isRecord(value)&&typeof value.error==="string"?value.error:fallback;}
function sessionStateLabel(state:string,ar:boolean){
  const labels:Record<string,[string,string]>={
    "waiting-for-user":["بانتظار تسجيل الدخول","Waiting for sign-in"],
    "user-controlled":["المتصفح مفتوح","Browser open"],
    "ready":["جاهزة","Ready"],"starting":["جارٍ الفتح","Starting"],
    "expired":["انتهت الجلسة","Session expired"],"closed":["أُغلقت الجلسة","Session closed"],
    "error":["تعذر تشغيل الجلسة","Session error"]
  };
  const label=labels[state];
  return label?(ar?label[0]:label[1]):(ar?"حالة الجلسة":"Session status");
}

export default function BrowserPublishingPanel({apiBase,token,workspaceId,articles,locale,onOpenSettings,chatDraft=null}:{apiBase:string;token:string;workspaceId:string;articles:Article[];locale:"ar"|"en";onOpenSettings:()=>void;chatDraft?:EditorialChatBrowserDraft|null}){
  const ar=locale==="ar";
  const [destinations,setDestinations]=useState<Destination[]>([]);
  const [sessions,setSessions]=useState<BrowserSession[]>([]);
  const [step,setStep]=useState<"destination"|"session">("destination");
  const [destinationId,setDestinationId]=useState("");
  const [session,setSession]=useState<BrowserSession|null>(null);
  const [screenshot,setScreenshot]=useState<Screenshot|null>(null);
  const [taskId,setTaskId]=useState("");
  const [name,setName]=useState("");const [homepage,setHomepage]=useState("");const [editorUrl,setEditorUrl]=useState("");
  const [approvedHosts,setApprovedHosts]=useState("");
  const [authorityConfirmed,setAuthorityConfirmed]=useState(false);const [policyReviewed,setPolicyReviewed]=useState(false);
  const [typingText,setTypingText]=useState("");const [key,setKey]=useState<BrowserKey>("Tab");
  const [busy,setBusy]=useState(false);const [notice,setNotice]=useState("");
  const readyArticles=articles.filter(article=>article.stage==="ready-to-publish");
  const selectedDestination=destinations.find(item=>item.id===destinationId);
  const sessionDestination=destinations.find(item=>item.id===session?.destinationId);
  const canInsertArticle=Boolean(selectedDestination?.selectors?.title&&selectedDestination?.selectors?.body);

  async function request(path:string,init:RequestInit={}):Promise<unknown>{
    const response=await fetch(apiBase+path,{...init,headers:{authorization:`Bearer ${token}`,...(init.body?{"content-type":"application/json"}:{}),...init.headers}});
    let payload:unknown=null;try{payload=await response.json() as unknown;}catch{payload=null;}
    if(!response.ok)throw new Error(apiError(payload,`HTTP ${response.status}`));
    return payload;
  }
  const destinationsPath=`/api/v1/workspaces/${encodeURIComponent(workspaceId)}/browser-destinations`;
  const sessionsPath=`/api/v1/workspaces/${encodeURIComponent(workspaceId)}/browser-sessions`;
  async function refreshLists(){
    if(!token.trim())return;
    try{
      const [destinationResult,sessionResult]=await Promise.all([request(destinationsPath),request(sessionsPath)]);
      const nextDestinations=parseArray(destinationResult,"destinations",parseDestination);
      const nextSessions=parseArray(sessionResult,"sessions",parseSession);
      setDestinations(nextDestinations);setSessions(nextSessions);
      setDestinationId(current=>{
        const targetName=chatDraft?.targetName.trim().toLocaleLowerCase();
        const preferred=targetName?nextDestinations.find(item=>item.name.trim().toLocaleLowerCase()===targetName):null;
        return chatDraft?(preferred?.id||""):(current||nextDestinations[0]?.id||"");
      });
      if(nextDestinations.length)setStep(current=>current==="destination"?"session":current);
      setSession(current=>current||nextSessions.find(item=>Date.parse(item.expiresAt)>Date.now())||null);
    }catch(error){setNotice(error instanceof Error?error.message:(ar?"تعذر تحميل الوجهات والجلسات":"Could not load destinations and sessions"));}
  }
  useEffect(()=>{void refreshLists();},[apiBase,token,workspaceId,chatDraft?.targetName]);

  async function refreshFrame(sessionId:string){
    const root=`${sessionsPath}/${encodeURIComponent(sessionId)}`;
    const [statusResult,frameResult]=await Promise.all([request(root),request(`${root}/screenshot`)]);
    const nextSession=parseSessionEnvelope(statusResult),nextScreenshot=parseScreenshot(frameResult);
    setSession(nextSession);setScreenshot(nextScreenshot);
    setSessions(current=>current.map(item=>item.id===sessionId?nextSession:item));
  }
  useEffect(()=>{
    if(!session?.id||!token.trim())return;
    let active=true;
    const update=async()=>{try{const root=`${sessionsPath}/${encodeURIComponent(session.id)}`;const [s,f]=await Promise.all([request(root),request(`${root}/screenshot`)]);if(active){const nextSession=parseSessionEnvelope(s),nextScreenshot=parseScreenshot(f);setSession(nextSession);setScreenshot(nextScreenshot);setSessions(current=>current.map(item=>item.id===session.id?nextSession:item));}}catch(error){if(active)setNotice(error instanceof Error?error.message:(ar?"انتهت جلسة المتصفح أو تعذر الاتصال":"Browser session expired or unavailable"));}};
    void update();const timer=window.setInterval(()=>void update(),3500);
    return()=>{active=false;window.clearInterval(timer);};
  },[apiBase,token,workspaceId,session?.id]);

  async function saveDestination(event:FormEvent){
    event.preventDefault();setBusy(true);setNotice("");
    try{
      const payload=await request(destinationsPath,{method:"POST",body:JSON.stringify({name,homepage,editorUrl,approvedHosts:approvedHosts.split(/[\\s,]+/).map(value=>value.trim()).filter(Boolean),authorityConfirmed,policyReviewed})});
      const item=parseDestination(record(payload,"API").destination);
      setDestinations(current=>[item,...current.filter(existing=>existing.id!==item.id)]);setDestinationId(item.id);
      setStep("session");
      setNotice(ar?"حُفظت الوجهة كإعداد غير متحقق؛ لم تُنشر أي مادة.":"Destination saved as operator-declared and unverified; nothing was published.");
    }catch(error){setNotice(error instanceof Error?error.message:(ar?"تعذر حفظ الوجهة":"Could not save destination"));}
    finally{setBusy(false);}
  }
  async function startSession(){
    if(!destinationId)return;setBusy(true);setNotice("");setScreenshot(null);
    try{
      const payload=await request(sessionsPath,{method:"POST",body:JSON.stringify({destinationId})});
      const nextSession=parseSessionEnvelope(payload);
      setSession(nextSession);setSessions(current=>[nextSession,...current.filter(item=>item.id!==nextSession.id)]);
      setNotice(ar?"فتحت جلسة المتصفح. سجّل الدخول بنفسك؛ لا تُحفظ كلمة المرور ولا يتجاوز النظام MFA أو CAPTCHA.":"Browser session opened. Sign in yourself; passwords are not saved and MFA/CAPTCHA are not bypassed.");
      await refreshFrame(nextSession.id);
    }catch(error){setNotice(error instanceof Error?error.message:(ar?"تعذر فتح جلسة المتصفح":"Could not open browser session"));}
    finally{setBusy(false);}
  }
  async function act(action:BrowserAction){
    if(!session)return false;setBusy(true);setNotice("");
    try{
      const root=`${sessionsPath}/${encodeURIComponent(session.id)}`;
      const payload=await request(`${root}/actions`,{method:"POST",body:JSON.stringify(action)});
      const nextSession=parseSessionEnvelope(payload);
      setSession(nextSession);setSessions(current=>current.map(item=>item.id===session.id?nextSession:item));
      await refreshFrame(session.id);
      return true;
    }catch(error){setNotice(error instanceof Error?error.message:(ar?"تعذر تنفيذ الإجراء":"Browser action failed"));}
    finally{setBusy(false);}
    return false;
  }
  async function clickRemote(event:MouseEvent<HTMLButtonElement>){
    if(!screenshot||!session)return;
    const rect=event.currentTarget.getBoundingClientRect();if(!rect.width||!rect.height)return;
    await act({type:"click",x:Math.round((event.clientX-rect.left)*1440/rect.width),y:Math.round((event.clientY-rect.top)*1000/rect.height)});
  }
  async function typeText(){
    const text=typingText;setTypingText("");if(text)await act({type:"type",text});
  }
  async function insertChatText(text:string,label:string){
    if(!text.trim())return;
    const inserted=await act({type:"paste",text});
    if(inserted)setNotice(ar?`أُدرج ${label} في الحقل المركّز. راجع الصفحة؛ لم يُضغط زر الحفظ أو النشر.`:`${label} inserted into the focused field. Review the page; Save/Publish was not clicked.`);
  }
  async function fillApprovedArticle(){
    if(!session||!taskId)return;setBusy(true);setNotice("");
    try{
      const payload=await request(`${sessionsPath}/${encodeURIComponent(session.id)}/fill-article`,{method:"POST",body:JSON.stringify({taskId})});
      const result=record(payload,"fill article"),nextSession=parseSession(result.session);
      setSession(nextSession);setSessions(current=>current.map(item=>item.id===session.id?nextSession:item));
      setNotice((typeof result.note==="string"&&result.note)|| (ar?"أُدرج نص المقال المعتمد؛ راجع الصفحة وأكمل الإرسال بنفسك إن رغبت.":"Approved article text inserted; review the page and submit manually if desired."));
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
    <div className="page-heading"><div><span className="tiny-overline">{ar?"مساعدة المتصفح بموافقتك":"USER-CONTROLLED BROWSER"}</span><h1>{ar?"النشر عبر المتصفح":"Browser handoff"}</h1><p>{ar?"افتح وجهة تملكها أو لديك تفويض لها، سجّل الدخول بنفسك، وراجع المقال قبل المتابعة.":"Open a destination you own or are authorized to use, sign in yourself, and review the article before continuing."}</p></div><span className="status-chip"><MonitorPlay size={14}/>{ar?"مراجعة بشرية":"Human review"}</span></div>
    {!token.trim()&&<div className="form-note workspace-token-note"><ShieldCheck size={15}/><span>{ar?"اربط مساحة العمل من الإعدادات مرة واحدة للمتابعة.":"Connect this workspace from Settings once to continue."}</span><button className="secondary-button" type="button" onClick={onOpenSettings}>{ar?"فتح الإعدادات":"Open Settings"}<ArrowUpLeft size={14}/></button></div>}
    <div className="browser-safety-note"><AlertTriangle size={17}/><div><b>{ar?"لا تُدخل بيانات الدخول في إعدادات الوجهة":"Never put login credentials in destination settings"}</b><p>{ar?"استخدم لقطة المتصفح التفاعلية لتسجيل الدخول. لا يحفظ التطبيق كلمات المرور، ولا يتجاوز MFA أو CAPTCHA. راجع النص والوجهة في الموقع قبل أن تضغط أي زر إرسال بنفسك.":"Use the interactive browser screenshot to sign in. The app does not store passwords or bypass MFA/CAPTCHA. Review the text and destination on the site before you personally press any submit button."}</p></div></div>
    <div className="browser-stepper" role="group" aria-label={ar?"خطوات جلسة المتصفح":"Browser session steps"}>
      <button type="button" className={step==="destination"?"browser-step active":"browser-step"} aria-current={step==="destination"?"step":undefined} onClick={()=>setStep("destination")}><b>01</b><span>{ar?"الوجهة":"Destination"}</span></button><i aria-hidden="true"/>
      <button type="button" className={step==="session"?"browser-step active":"browser-step"} aria-current={step==="session"?"step":undefined} disabled={!destinationId} onClick={()=>setStep("session")}><b>02</b><span>{ar?"الدخول والمراجعة":"Sign in & review"}</span></button>
    </div>
    <div className="browser-layout">
      {step==="destination"&&<section className="surface-card create-card browser-setup-card">
        <div className="section-heading"><div><span className="tiny-overline">{ar?"الخطوة الأولى":"STEP 01"}</span><h2>{ar?"اختر وجهة النشر":"Choose a destination"}</h2><p>{ar?"أدخل اسم الموقع ورابط المحرر. أضف نطاقاً آخر من الإعدادات المتقدمة فقط إذا احتاج تسجيل الدخول إليه.":"Enter the site and editor URL. Add another domain in advanced settings only if sign-in redirects there."}</p></div><Globe2 size={18}/></div>
        <form className="article-form" onSubmit={saveDestination}>
          <label>{ar?"اسم الوجهة":"Destination name"}<input required minLength={2} maxLength={120} value={name} onChange={event=>setName(event.target.value)} placeholder={ar?"مثال: مدونة الشركة":"e.g. Company blog"}/></label>
          <label>{ar?"رابط الموقع (HTTPS)":"Homepage URL (HTTPS)"}<input required type="url" value={homepage} onChange={event=>setHomepage(event.target.value)} placeholder="https://example.com"/></label>
          <label>{ar?"رابط صفحة المحرر أو الدخول":"Editor or login URL"}<input type="url" value={editorUrl} onChange={event=>setEditorUrl(event.target.value)} placeholder="https://example.com/editor"/></label>
          <details className="browser-advanced-fields"><summary>{ar?"إعدادات متقدمة (اختيارية)":"Advanced setup (optional)"}</summary><p>{ar?"أضف نطاقات تسجيل الدخول الإضافية فقط إذا كان الموقع يحوّلك إليها.":"Add extra sign-in domains only if the site redirects there."}</p>
            <label>{ar?"نطاقات إضافية مسموح بها":"Additional allowed domains"}<textarea rows={2} value={approvedHosts} onChange={event=>setApprovedHosts(event.target.value)} placeholder="accounts.example.com"/></label>
          </details>
          <label className="browser-confirm"><input type="checkbox" required checked={authorityConfirmed} onChange={event=>setAuthorityConfirmed(event.target.checked)}/>{ar?"أؤكد أنني أملك هذه الوجهة أو مفوض بالنشر فيها.":"I confirm I own this destination or am authorized to publish there."}</label>
          <label className="browser-confirm"><input type="checkbox" required checked={policyReviewed} onChange={event=>setPolicyReviewed(event.target.checked)}/>{ar?"راجعت سياسة الموقع وقواعد النشر المناسبة.":"I reviewed the site's terms and applicable publishing rules."}</label>
          <button className="secondary-button" disabled={busy||!token.trim()}><Check size={14}/>{ar?"حفظ الوجهة":"Save destination"}</button>
        </form>
        {!!destinations.length&&<div className="browser-destination-list"><h3>{ar?"الوجهات المحفوظة":"Saved destinations"}</h3>{destinations.map(item=><label key={item.id} className="browser-destination-row"><input type="radio" name="browser-destination" checked={destinationId===item.id} onChange={()=>setDestinationId(item.id)}/><span><b>{item.name}</b><small>{item.homepage} · {item.status==="operator-declared-unverified"?(ar?"غير متحقق":"Unverified"):item.status}</small></span></label>)}</div>}
      </section>}
      {step==="session"&&<section className="surface-card create-card browser-session-card">
        <div className="section-heading"><div><span className="tiny-overline">{ar?"الخطوة الثانية":"STEP 02"}</span><h2>{ar?"افتح المتصفح وسجّل الدخول":"Open the browser and sign in"}</h2><p>{ar?"ستظهر صفحة الموقع هنا. أدخل بياناتك بنفسك؛ لا تُحفظ كلمة المرور.":"The website will appear here. Sign in yourself; your password is not saved."}</p></div><LogIn size={18}/></div>
        {destinations.length>0&&<label className="browser-session-select">{ar?"الوجهة":"Destination"}<select value={destinationId} onChange={event=>setDestinationId(event.target.value)}>{destinations.map(item=><option key={item.id} value={item.id}>{item.name} · {item.status==="operator-declared-unverified"?(ar?"غير متحقق":"Unverified"):item.status}</option>)}</select></label>}
        <button className="browser-manage-destination" type="button" onClick={()=>setStep("destination")}>{ar?"إدارة الوجهات":"Manage destinations"}</button>
        <div className="browser-session-controls"><button className="primary-button" disabled={busy||!token.trim()||!destinationId} onClick={startSession}><LogIn size={14}/>{ar?"فتح جلسة المتصفح":"Open browser session"}</button>{session&&<button className="secondary-button" disabled={busy} onClick={closeSession}><X size={14}/>{ar?"إغلاق الجلسة":"Close session"}</button>}</div>
        {sessions.length>0&&<label className="browser-session-select">{ar?"جلسة نشطة":"Active session"}<select value={session?.id||""} onChange={event=>{setSession(sessions.find(item=>item.id===event.target.value)||null);setScreenshot(null);}}>{sessions.map((item,index)=><option key={item.id} value={item.id}>{item.title||`${ar?"جلسة":"Session"} ${index+1}`} · {sessionStateLabel(item.state,ar)}</option>)}</select></label>}
        {session&&<div className="browser-session-meta"><b>{session.title||sessionStateLabel(session.state,ar)}</b><small>{session.currentUrl}</small><small>{ar?"تنتهي:":"Expires:"} {new Date(session.expiresAt).toLocaleString(ar?"ar-IQ":"en-US")}</small></div>}
        {session&&screenshot&&<div className="browser-remote-frame"><button className="browser-screenshot" type="button" onClick={clickRemote} aria-label={ar?"انقر داخل لقطة المتصفح":"Click inside browser screenshot"}><img src={`data:${screenshot.contentType};base64,${screenshot.base64}`} alt={ar?"لقطة شاشة تفاعلية للمتصفح البعيد":"Interactive remote browser screenshot"}/><span><MousePointer2 size={13}/>{ar?"انقر داخل الصفحة لإدخال المؤشر":"Click the page to focus an element"}</span></button></div>}
        {session&&chatDraft&&<div className="browser-chat-draft"><span className="tiny-overline">{ar?"مسودة المحادثة":"CHAT DRAFT"} · {chatDraft.targetName}</span><p>{ar?`تحقق أن الجلسة المفتوحة «${sessionDestination?.name||"وجهة غير محددة"}» هي ${chatDraft.targetName}. انقر على حقل العنوان أو النص في المعاينة، ثم أدرج الجزء المناسب. لا يحفظ التطبيق ولا ينشر.`:`Confirm the open session “${sessionDestination?.name||"unspecified destination"}” matches ${chatDraft.targetName}. Click the title or body field in the preview, then insert the matching part. Nothing is saved or published.`}</p><div><button className="secondary-button" type="button" disabled={busy||!chatDraft.title.trim()} onClick={()=>void insertChatText(chatDraft.title,ar?"العنوان":"Title")}><Upload size={14}/>{ar?"إدراج العنوان في الحقل المركّز":"Insert title into focused field"}</button><button className="secondary-button" type="button" disabled={busy||!chatDraft.body.trim()} onClick={()=>void insertChatText(chatDraft.body,ar?"المحتوى":"Body")}><Upload size={14}/>{ar?"إدراج المحتوى في الحقل المركّز":"Insert body into focused field"}</button></div></div>}
        {session&&<div className="browser-control-group"><div className="browser-interaction-controls"><label>{ar?"اكتب في الحقل المحدد (لا يُحفظ النص)":"Type into the focused field (text is not saved)"}<input type="password" autoComplete="off" value={typingText} onChange={event=>setTypingText(event.target.value)} onKeyDown={event=>{if(event.key==="Enter"){event.preventDefault();void typeText();}}}/></label><button className="secondary-button" disabled={busy||!typingText} onClick={()=>void typeText()}>{ar?"كتابة":"Type"}</button></div><details className="browser-advanced-fields browser-key-controls"><summary>{ar?"عناصر تحكم إضافية":"More browser controls"}</summary><div className="browser-key-actions"><label>{ar?"المفتاح":"Key"}<select value={key} onChange={event=>{if(isBrowserKey(event.target.value))setKey(event.target.value);}}>{keys.map(item=><option key={item}>{item}</option>)}</select></label><button className="secondary-button" disabled={busy} onClick={()=>void act({type:"press",key})}>{ar?"ضغط المفتاح":"Press key"}</button><button className="secondary-button" disabled={busy} onClick={()=>void act({type:"scroll",deltaY:500})}>{ar?"تمرير لأسفل":"Scroll down"}</button><button className="secondary-button" disabled={busy} onClick={()=>void act({type:"scroll",deltaY:-500})}>{ar?"تمرير لأعلى":"Scroll up"}</button></div></details></div>}
        {session&&canInsertArticle&&!chatDraft&&<div className="browser-fill-article"><label>{ar?"مقالة معتمدة لإدراجها":"Approved article to insert"}<select value={taskId} onChange={event=>setTaskId(event.target.value)}><option value="">{ar?"اختر مقالة جاهزة ومعتمدة":"Select a ready, approved article"}</option>{readyArticles.map(article=><option key={article.id} value={article.id}>{article.topic}</option>)}</select></label><button className="secondary-button" disabled={busy||!taskId||!readyArticles.some(article=>article.id===taskId)} onClick={()=>void fillApprovedArticle()}><Upload size={14}/>{ar?"إدراج النص في المحرر":"Insert text into editor"}</button><p className="form-note">{ar?"لا تُرفق ملفات الوسائط في هذه الدفعة. لا يضغط التطبيق زر الحفظ أو النشر؛ راجع الصفحة وأكمل يدوياً.":"Media files are not attached in this phase. The app does not click Save or Publish; review the page and continue manually."}</p></div>}
        {session&&!canInsertArticle&&!chatDraft&&<div className="browser-manual-insert"><p>{ar?"يمكنك تسجيل الدخول والتفاعل مع المتصفح. لإدراج مسودة محادثة، ارجع إلى الرسالة واختر «المتابعة في المتصفح»، ثم انقر الحقل المطلوب من المعاينة. لن يحفظ التطبيق أو ينشر.":"You can sign in and interact with the browser. To insert a chat draft, return to its message and choose “Continue in browser,” then click the desired field in the preview. The app will not save or publish."}</p></div>}
        {!session&&<div className="browser-empty"><MonitorPlay size={23}/><p>{ar?"احفظ وجهة مفوضاً بها ثم افتح جلسة لتسجيل الدخول. سيظهر المتصفح هنا.":"Save an authorized destination and open a session to sign in. The browser will appear here."}</p></div>}
      </section>}
    </div>
    {notice&&<p className="inline-feedback">{notice}</p>}
    <div className="browser-footer-note"><ExternalLink size={14}/>{ar?"هذه جلسة وسيطة للتعبئة والمراجعة فقط؛ حالة الوجهة غير متحققة، والنشر الفعلي والتحقق من الرابط غير متاحين بعد.":"This is a fill-and-review handoff only; the destination remains unverified, and external publishing/link verification are not implemented."}</div>
  </section>;
}
