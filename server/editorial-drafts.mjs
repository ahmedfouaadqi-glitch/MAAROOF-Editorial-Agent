import { randomUUID } from "node:crypto";

const OBJECTIVE_SECTIONS = {
  analysis: ["السياق والمشكلة", "التحليل والأدلة", "النتائج والتوصيات"],
  news: ["ماذا حدث؟", "الخلفية والسياق", "الأثر والتطورات"],
  "thought-leadership": ["الأطروحة الرئيسية", "الحجة والأمثلة", "الآثار العملية"],
  educational: ["المفاهيم الأساسية", "الشرح خطوة بخطوة", "التطبيق والخلاصة"],
  "research-summary": ["سؤال البحث", "المنهج والنتائج", "القيود والدلالات"]
};
const EN_SECTIONS = {
  analysis: ["Context and problem", "Analysis and evidence", "Findings and recommendations"],
  news: ["What happened?", "Background and context", "Impact and developments"],
  "thought-leadership": ["Central thesis", "Argument and examples", "Practical implications"],
  educational: ["Core concepts", "Step-by-step explanation", "Application and summary"],
  "research-summary": ["Research question", "Method and findings", "Limitations and implications"]
};
function fail(message,status=400){const e=new Error(message);e.status=status;throw e;}
function ownedTask(state,workspaceId,taskId){
 const task=state.tasks?.[taskId];
 if(!task||task.workspaceId!==workspaceId||!task.article)fail("Editorial task not found",404);
 return task;
}
function clean(value,max=12000){if(typeof value!=="string")return "";return value.trim().slice(0,max);}
export function buildEditorialOutline(state,{workspaceId,taskId,angle="",audience="",keyQuestions=[]}){
 const task=ownedTask(state,workspaceId,taskId), article=task.article;
 const lang=article.language==="en"?"en":"ar", objective=article.objective;
 const sections=(lang==="en"?EN_SECTIONS:OBJECTIVE_SECTIONS)[objective]||OBJECTIVE_SECTIONS.analysis;
 const outline={
  id:randomUUID(),workspaceId,taskId,language:lang,topic:article.topic,objective,
  audience:clean(audience,500),editorialAngle:clean(angle,1000),
  sections:sections.map((heading,index)=>({id:randomUUID(),heading,brief:lang==="en"?"Develop this section using verified sources. Do not add unsupported facts. ("+(index+1)+")":"طوّر هذا القسم بالاستناد إلى مصادر متحققة، ولا تضف معلومات غير مسندة. ("+(index+1)+")",body:"",claimIds:[]})),
  keyQuestions:Array.isArray(keyQuestions)?keyQuestions.filter(x=>typeof x==="string").slice(0,12).map(x=>clean(x,300)):[],
  status:"outline",createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),
  generationMode:"deterministic-editorial-scaffold",
  limitation:"This is a structured outline, not AI-generated research or a factual article."
 };
	 state.editorialDrafts ||= [];
	 const existing=state.editorialDrafts.find(x=>x.workspaceId===workspaceId&&x.taskId===taskId);
	 if(existing){
	  const geoBrief=existing.geoBrief?{...existing.geoBrief,targetQuestions:(existing.geoBrief.targetQuestions||[]).map(item=>({...item,sectionId:""}))}:null;
	  Object.assign(existing,outline,{id:existing.id,createdAt:existing.createdAt});
	  if(geoBrief)existing.geoBrief=geoBrief;
	  return existing;
	 }
 state.editorialDrafts.push(outline);return outline;
}
export function getEditorialDraft(state,workspaceId,taskId){
 ownedTask(state,workspaceId,taskId);
 return (state.editorialDrafts||[]).find(x=>x.workspaceId===workspaceId&&x.taskId===taskId)||null;
}
export function updateEditorialDraft(state,{workspaceId,taskId,title,dek,metaTitle,metaDescription,editorialAngle,sections,disclosure}){
 const draft=getEditorialDraft(state,workspaceId,taskId);if(!draft)fail("Editorial outline not found",404);
 if(title!==undefined)draft.title=clean(title,300);
 if(dek!==undefined)draft.dek=clean(dek,600);
 if(metaTitle!==undefined)draft.metaTitle=clean(metaTitle,100);
 if(metaDescription!==undefined)draft.metaDescription=clean(metaDescription,300);
 if(editorialAngle!==undefined)draft.editorialAngle=clean(editorialAngle,1000);
 if(disclosure!==undefined)draft.disclosure=clean(disclosure,2000);
 if(Array.isArray(sections)){
  const byId=new Map(draft.sections.map(s=>[s.id,s]));
  for(const item of sections){if(!item||typeof item.id!=="string"||!byId.has(item.id))continue;
   const target=byId.get(item.id);if(item.heading!==undefined)target.heading=clean(item.heading,300);
   if(item.body!==undefined)target.body=clean(item.body,12000);
  }
 }
 draft.status=draft.sections.some(s=>s.body.trim())?"draft":"outline";
 draft.updatedAt=new Date().toISOString();return draft;
}
