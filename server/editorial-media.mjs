import { createHash, randomUUID } from "node:crypto";
import { normalizeEditorialText } from "./editorial-evidence.mjs";
function fail(message,status=400){const error=new Error(message);error.status=status;throw error;}
function taskFor(state,workspaceId,taskId){
 const task=state.tasks?.[taskId];if(!task||task.workspaceId!==workspaceId||!task.article)fail("Editorial task not found",404);return task;
}
function fingerprint(state,workspaceId,taskId){
 const draft=(state.editorialDrafts||[]).find(item=>item.workspaceId===workspaceId&&item.taskId===taskId);
 if(!draft)fail("Editorial draft not found",404);
 const text=[draft.title||"",draft.dek||"",draft.editorialAngle||"",...(draft.sections||[]).flatMap(s=>[s.heading||"",s.body||""]),draft.metaTitle||"",draft.metaDescription||""].join("\n");
 return createHash("sha256").update(normalizeEditorialText(text)).digest("hex");
}
export function recordMediaReview(state,{workspaceId,taskId,decision,reviewerName,rationale,assets=[]}){
 const task=taskFor(state,workspaceId,taskId);
 if(task.article.stage!=="media-review")fail("Media review can only be recorded during the media-review stage",409);
 if(!["approved","not-required","changes-requested"].includes(decision))fail("Unsupported media review decision");
 if(typeof reviewerName!=="string"||reviewerName.trim().length<2||reviewerName.length>150)fail("reviewerName must contain 2-150 characters");
 if(typeof rationale!=="string"||rationale.trim().length<10||rationale.length>2000)fail("rationale must contain 10-2000 characters");
 if(!Array.isArray(assets)||assets.length>30)fail("assets must be an array of up to 30 records");
 const normalizedAssets=assets.map((asset,index)=>{
  if(!asset||typeof asset!=="object")fail("Invalid asset at index "+index);
  let url;try{url=new URL(asset.url);if(!["https:","http:"].includes(url.protocol))throw new Error();}catch{fail("Asset URL must be HTTP(S)");}
  const required=(key,max)=>{if(typeof asset[key]!=="string"||!asset[key].trim()||asset[key].length>max)fail(key+" is required for each media asset");return asset[key].trim();};
  return {url:url.toString(),creator:required("creator",180),license:required("license",300),attribution:required("attribution",500),altText:required("altText",500),rightsConfirmed:asset.rightsConfirmed===true};
 });
 if(decision==="approved"&&(!normalizedAssets.length||normalizedAssets.some(asset=>!asset.rightsConfirmed)))fail("Every approved media asset needs confirmed rights and attribution");
 if(decision==="not-required"&&normalizedAssets.length)fail("A not-required media review cannot include assets");
 const review={id:randomUUID(),workspaceId,taskId,decision,reviewerName:reviewerName.trim(),rationale:rationale.trim(),assets:normalizedAssets,draftFingerprint:fingerprint(state,workspaceId,taskId),createdAt:new Date().toISOString(),reviewMode:"human-recorded-media-rights-review"};
 state.mediaReviews ||= [];state.mediaReviews.push(review);return review;
}
export function getCurrentMediaReview(state,workspaceId,taskId){
 taskFor(state,workspaceId,taskId);
 const draft=(state.editorialDrafts||[]).find(item=>item.workspaceId===workspaceId&&item.taskId===taskId);
 if(!draft)return {review:null,reviewCurrent:false,approvedForCurrentDraft:false,blocker:"draft-missing"};
 const current=fingerprint(state,workspaceId,taskId);
 const review=(state.mediaReviews||[]).filter(item=>item.workspaceId===workspaceId&&item.taskId===taskId).sort((a,b)=>b.createdAt.localeCompare(a.createdAt))[0]||null;
 const isCurrent=Boolean(review&&review.draftFingerprint===current);
 return {review,reviewCurrent:isCurrent,approvedForCurrentDraft:isCurrent&&["approved","not-required"].includes(review.decision)};
}
export function assertCurrentMediaReview(state,workspaceId,taskId){
 const result=getCurrentMediaReview(state,workspaceId,taskId);
 if(!result.approvedForCurrentDraft)fail("A current media-rights review or explicit not-required decision is required before editorial approval",409);
 return result;
}
