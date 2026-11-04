import { createHash, randomUUID } from "node:crypto";
import { checkOriginality, normalizeEditorialText } from "./editorial-evidence.mjs";

function fail(message,status=400){const error=new Error(message);error.status=status;throw error;}
function taskFor(state,workspaceId,taskId){
 const task=state.tasks?.[taskId];
 if(!task||task.workspaceId!==workspaceId||!task.article)fail("Editorial task not found",404);
 return task;
}
function draftFor(state,workspaceId,taskId){
 const draft=(state.editorialDrafts||[]).find(item=>item.workspaceId===workspaceId&&item.taskId===taskId);
 if(!draft)fail("Editorial draft not found",404);
 return draft;
}
export function buildDraftReviewText(draft){
 return [draft.title||"",draft.dek||"",draft.editorialAngle||"",...(draft.sections||[]).flatMap(section=>[section.heading||"",section.body||""]),draft.metaTitle||"",draft.metaDescription||""].filter(Boolean).join("\n");
}
export function editorialDraftFingerprint(draft){
 return createHash("sha256").update(normalizeEditorialText(buildDraftReviewText(draft))).digest("hex");
}
export function checkEditorialDraftOriginality(state,{workspaceId,taskId}){
 const task=taskFor(state,workspaceId,taskId);
 if(task.article.stage!=="originality-review")fail("Originality check can only be recorded during the originality-review stage",409);
 const draft=draftFor(state,workspaceId,taskId);
 const text=buildDraftReviewText(draft);
 if(text.trim().length<30)fail("Draft must contain at least 30 characters before an originality check");
 const result=checkOriginality(state,{workspaceId,taskId,text});
 return {...result,draftFingerprint:editorialDraftFingerprint(draft),scope:"current-editorial-draft",note:"This is a local workspace comparison only; no external corpus or semantic paraphrase analysis is used."};
}
export function getEditorialApproval(state,workspaceId,taskId){
 taskFor(state,workspaceId,taskId);
 const draft=(state.editorialDrafts||[]).find(item=>item.workspaceId===workspaceId&&item.taskId===taskId)||null;
 const sources=(state.sources||[]).filter(item=>item.workspaceId===workspaceId&&item.taskId===taskId);
 const claims=(state.claims||[]).filter(item=>item.workspaceId===workspaceId&&item.taskId===taskId);
 const evidence=(state.researchEvidence||[]).filter(item=>item.workspaceId===workspaceId&&item.taskId===taskId);
 const originalityChecks=(state.originalityChecks||[]).filter(item=>item.workspaceId===workspaceId&&item.taskId===taskId);
 const blockers=[];
 if(!draft)blockers.push("draft-missing");
 else{
  if(!draft.title?.trim())blockers.push("title-missing");
  if(!Array.isArray(draft.sections)||draft.sections.length<2)blockers.push("insufficient-sections");
  if(!draft.sections?.length||draft.sections.some(section=>!section.heading?.trim()||!section.body?.trim()))blockers.push("incomplete-sections");
  if(!draft.metaTitle?.trim())blockers.push("meta-title-missing");
  if(!draft.metaDescription?.trim())blockers.push("meta-description-missing");
  if(!sources.length)blockers.push("no-registered-sources");
  const unlinked=claims.filter(claim=>!Array.isArray(claim.sourceIds)||claim.sourceIds.length===0);
  if(unlinked.length)blockers.push("claims-without-sources");
  const noEvidence=claims.filter(claim=>!evidence.some(item=>item.claimId===claim.id));
  if(noEvidence.length)blockers.push("claims-without-evidence-excerpts");
 }
 const fingerprint=draft?editorialDraftFingerprint(draft):null;
 const matchingChecks=fingerprint?originalityChecks.filter(item=>item.fingerprint===fingerprint):[];
 const latestCheck=matchingChecks.sort((a,b)=>b.checkedAt.localeCompare(a.checkedAt))[0]||null;
 if(!latestCheck)blockers.push("current-draft-originality-check-missing");
 const reviews=(state.editorialReviews||[]).filter(item=>item.workspaceId===workspaceId&&item.taskId===taskId).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
 const latestReview=reviews[0]||null;
 const reviewCurrent=Boolean(latestReview&&fingerprint&&latestReview.draftFingerprint===fingerprint);
 const approved=Boolean(reviewCurrent&&latestReview.decision==="approved");
 const conflictClaimIds=[...new Set(evidence.filter(item=>item.stance==="supports").map(item=>item.claimId).filter(id=>evidence.some(x=>x.claimId===id&&x.stance==="contradicts")))];
 return {
  readyForApproval:blockers.length===0,blockers,
  warnings:[
   ...(latestCheck&&latestCheck.outcome!=="no-match-found"?["originality-match-requires-human-assessment"]:[]),
   ...(conflictClaimIds.length?["conflicting-evidence-recorded"]:[]),
   "Source and excerpt records are operator-supplied; their truth is not independently proven by this approval check."
  ],
  draftFingerprint:fingerprint,
  originality:{checked:Boolean(latestCheck),outcome:latestCheck?.outcome||null,method:latestCheck?.method||null},
  evidence:{sourceCount:sources.length,claimCount:claims.length,evidenceExcerptCount:evidence.length,conflictingClaimCount:conflictClaimIds.length},
  latestReview:latestReview?{id:latestReview.id,decision:latestReview.decision,reviewerName:latestReview.reviewerName,rationale:latestReview.rationale,createdAt:latestReview.createdAt,draftFingerprint:latestReview.draftFingerprint,current:reviewCurrent}:null,
  reviewCurrent,
  approvedForCurrentDraft:approved
 };
}
export function recordEditorialReview(state,{workspaceId,taskId,decision,reviewerName,rationale}){
 const task=taskFor(state,workspaceId,taskId);
 if(task.article.stage!=="editorial-approval")fail("Editorial review can only be recorded during the editorial-approval stage",409);
 if(!["approved","changes-requested","rejected"].includes(decision))fail("Unsupported editorial decision");
 if(typeof reviewerName!=="string"||reviewerName.trim().length<2||reviewerName.length>150)fail("reviewerName must contain 2-150 characters");
 if(typeof rationale!=="string"||rationale.trim().length<10||rationale.length>3000)fail("rationale must contain 10-3000 characters");
 const readiness=getEditorialApproval(state,workspaceId,taskId);
 if(decision==="approved"&&!readiness.readyForApproval) {
  const error=new Error("Editorial approval is blocked by incomplete draft checks");
  error.status=409;error.details=readiness.blockers;throw error;
 }
 const draft=draftFor(state,workspaceId,taskId);
 const review={
  id:randomUUID(),workspaceId,taskId,decision,
  reviewerName:reviewerName.trim(),rationale:rationale.trim(),
  draftFingerprint:editorialDraftFingerprint(draft),
  createdAt:new Date().toISOString(),
  reviewMode:"human-recorded-editorial-decision"
 };
 state.editorialReviews ||= [];
 state.editorialReviews.push(review);
 return {review,readiness:getEditorialApproval(state,workspaceId,taskId)};
}
export function assertCurrentEditorialApproval(state,workspaceId,taskId){
 const report=getEditorialApproval(state,workspaceId,taskId);
 if(!report.approvedForCurrentDraft)fail("A current human approval for this exact draft version is required before the article can be marked ready to publish",409);
 return report;
}
