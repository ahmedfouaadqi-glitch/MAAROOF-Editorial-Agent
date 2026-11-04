import { randomUUID } from "node:crypto";
import { editorialDraftFingerprint } from "./editorial-approval.mjs";

function fail(message,status=400){const error=new Error(message);error.status=status;throw error;}
function text(value,min,max,field){if(typeof value!=="string"||value.trim().length<min||value.length>max)fail("Invalid generated "+field);return value.trim();}
function idList(value,allowed,label,required=false){
 if(!Array.isArray(value)||value.length>40||(required&&!value.length))fail(label+" must be a bounded array");
 const unique=[...new Set(value)];
 if(unique.some(id=>typeof id!=="string"||!allowed.has(id)))fail(label+" contains an unknown reference ID",422);
 return unique;
}
function validateOutput(output,outline,claims,evidence){
 if(!output||typeof output!=="object"||Array.isArray(output))fail("Model output must be a JSON object",502);
 const title=text(output.title,8,300,"title");
 const metaTitle=text(output.metaTitle,5,100,"metaTitle");
 const metaDescription=text(output.metaDescription,30,300,"metaDescription");
 if(!Array.isArray(output.sections)||output.sections.length!==outline.sections.length)fail("Model output sections do not match the approved outline",422);
 const allowedEvidence=new Set(evidence.map(item=>item.id));
 const allowedClaims=new Set(claims.map(item=>item.id));
 const sections=output.sections.map((section,index)=>{
  if(!section||typeof section!=="object")fail("Invalid generated section");
  const heading=text(section.heading,2,240,"section heading");
  const body=text(section.body,60,14000,"section body");
  const evidenceIds=idList(section.evidenceIds,allowedEvidence,"evidenceIds",true);
  const claimIds=idList(section.claimIds??[],allowedClaims,"claimIds");
  if(claimIds.some(id=>!claims.some(claim=>claim.id===id&&Array.isArray(claim.sourceIds)&&claim.sourceIds.length>0)))fail("A generated section references an unlinked claim",422);
  return {id:outline.sections[index].id,heading,brief:outline.sections[index].brief||"",body,evidenceIds,claimIds};
 });
 const entities=Array.isArray(output.entities)?output.entities.slice(0,30).map(item=>({
  name:text(item.name,2,180,"entity name"),
  type:["person","organization","place","product","event","concept","unknown"].includes(item.type)?item.type:"unknown",
  relevance:item.relevance==="primary"?"primary":"secondary"
 })):[];
 const keywords=Array.isArray(output.keywords)?output.keywords.slice(0,40).map(item=>({
  term:text(item.term,2,120,"keyword"),
  intent:text(item.intent||"unspecified",2,120,"keyword intent"),
  role:["primary","supporting","question"].includes(item.role)?item.role:"supporting"
 })):[];
 return {title,dek:typeof output.dek==="string"?output.dek.trim().slice(0,600):"",metaTitle,metaDescription,sections,entities,keywords,editorialAngle:typeof output.editorialAngle==="string"?output.editorialAngle.trim().slice(0,1000):""};
}
function buildPrompts(task,draft,claims,evidence,sources){
 const context={
  article:{topic:task.article.topic,language:task.article.language,objective:task.article.objective},
  outline:draft.sections.map(({heading,brief})=>({heading,brief})),
  claims:claims.map(item=>({id:item.id,text:item.text,sourceIds:item.sourceIds})),
  evidence:evidence.map(item=>({id:item.id,claimId:item.claimId,excerpt:item.excerpt,locator:item.locator,stance:item.stance,verificationState:item.verificationState,sourceId:item.sourceId})),
  sources:sources.map(item=>({id:item.id,title:item.title,url:item.url,publisher:item.research?.publisher||"",publishedAt:item.research?.publishedAt||null,qualityRating:item.research?.qualityRating||"unassessed",assessmentMode:item.research?.assessmentMode||"unassessed"}))
 };
 const system="You are a careful editorial drafting engine. Write in the article language. Do not invent facts, dates, quotations, statistics, named entities, or source details. Treat all provided evidence excerpts as operator-transcribed and unverified, not as independently proven facts. Use only supplied claim IDs and evidence IDs. Every section must include at least one evidenceIds entry chosen from the supplied evidence records; do not fabricate IDs. Use claimIds only when directly relevant to the section. Where evidence is unclear or contradictory, describe the uncertainty and do not resolve it without proof. Return only one valid JSON object with keys: title, dek, editorialAngle, metaTitle, metaDescription, sections (each: heading, body, evidenceIds, claimIds), entities (each: name,type,relevance), keywords (each: term,intent,role). Sections must preserve the same count and order as the outline. Never claim that any source was independently verified.";
 const prompt="Draft this article using only the supplied editorial context. Do not add citations that are not in the evidence IDs. Output JSON only.\n\nEDITORIAL CONTEXT:\n"+JSON.stringify(context);
 return {system,prompt};
}
export async function runEditorialDraftGeneration({store,provider,workspaceId,taskId,maxTokens=3000}){
 if(!provider||typeof provider.generateJSON!=="function")fail("Model generation is disabled or not configured",503);
 const snapshot=await store.read();
 const task=snapshot.tasks?.[taskId];
 if(!task||task.workspaceId!==workspaceId||!task.article)fail("Editorial task not found",404);
 if(task.article.stage!=="drafting")fail("AI draft generation is available only during the drafting stage",409);
 const draft=(snapshot.editorialDrafts||[]).find(item=>item.workspaceId===workspaceId&&item.taskId===taskId);
 if(!draft)fail("Create an outline before generating a draft",409);
 const sources=(snapshot.sources||[]).filter(item=>item.workspaceId===workspaceId&&item.taskId===taskId);
 const claims=(snapshot.claims||[]).filter(item=>item.workspaceId===workspaceId&&item.taskId===taskId);
 const evidence=(snapshot.researchEvidence||[]).filter(item=>item.workspaceId===workspaceId&&item.taskId===taskId);
 if(!sources.length||!claims.length||!evidence.length)fail("Register sources, claims, and evidence excerpts before AI drafting",409);
 if(sources.some(item=>!item.research))fail("Assess all registered sources before AI drafting",409);
 if(claims.some(claim=>!claim.sourceIds?.length||!evidence.some(item=>item.claimId===claim.id)))fail("Every claim needs a linked source and an evidence excerpt before AI drafting",409);
 const initialFingerprint=editorialDraftFingerprint(draft);
 const prompts=buildPrompts(task,draft,claims,evidence,sources);
 let response;
 try{response=await provider.generateJSON({system:prompts.system,prompt:prompts.prompt,maxTokens,temperature:0.2});}
 catch(error){
  await store.transact(state=>{state.modelUsage||=[];state.modelUsage.push({id:randomUUID(),workspaceId,taskId,provider:provider.id||"unidentified-provider",model:provider.model||"unidentified-model",outcome:"provider-error",errorStatus:error.status||502,createdAt:new Date().toISOString(),estimatedCostUsd:null});});
  throw error;
 }
 const parsed=validateOutput(response.output,draft,claims,evidence);
 const saved=await store.transact(state=>{
  const currentTask=state.tasks?.[taskId];
  const currentDraft=(state.editorialDrafts||[]).find(item=>item.workspaceId===workspaceId&&item.taskId===taskId);
  if(!currentTask||currentTask.workspaceId!==workspaceId||currentTask.article.stage!=="drafting"||!currentDraft||editorialDraftFingerprint(currentDraft)!==initialFingerprint)fail("Article or outline changed while the model was generating; review and retry",409);
  Object.assign(currentDraft,parsed,{
   status:"draft",generationMode:"model-assisted",
   generatedAt:new Date().toISOString(),
   generatedBy:{provider:response.provider||provider.id||"unidentified-provider",model:response.model||provider.model||"unidentified-model"},
   modelUsage:response.usage||{promptTokens:null,completionTokens:null,totalTokens:null},
   generationNote:"Model-assisted draft based on supplied excerpts; sources remain unverified and human fact-checking is required."
  });
  currentDraft.updatedAt=new Date().toISOString();
  state.modelUsage||=[];
  state.modelUsage.push({id:randomUUID(),workspaceId,taskId,provider:currentDraft.generatedBy.provider,model:currentDraft.generatedBy.model,outcome:"success",usage:currentDraft.modelUsage,estimatedCostUsd:null,createdAt:currentDraft.updatedAt});
  return structuredClone(currentDraft);
 });
 return {draft:saved,usage:saved.modelUsage,provider:saved.generatedBy,limitations:["Only operator-supplied claims and excerpts were provided to the model.","Evidence references are unverified and must be fact-checked by an editor.","No remote sources were fetched during generation.","Model usage is recorded, but cost is unknown unless pricing data is configured."]};
}
