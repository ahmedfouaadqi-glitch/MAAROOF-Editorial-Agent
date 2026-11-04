import { describe, expect, it } from "vitest";
import { checkEditorialDraftOriginality, getEditorialApproval, recordEditorialReview, assertCurrentEditorialApproval } from "./editorial-approval.mjs";
function fixture(){
 const workspaceId="w1",taskId="t1",sourceId="s1",claimId="c1";
 return {workspaceId,taskId,sourceId,claimId,state:{
  tasks:{t1:{workspaceId,article:{topic:"Editorial subject",stage:"editorial-approval"}}},
  editorialDrafts:[{workspaceId,taskId,title:"A fully reviewed article title",metaTitle:"Search title",metaDescription:"A descriptive search result description.",editorialAngle:"A clear and bounded editorial angle.",sections:[{heading:"First section",body:"This is the first complete section of an editorial article."},{heading:"Second section",body:"This is the second complete section with enough text to review."}],status:"draft"}],
  sources:[{id:sourceId,workspaceId,taskId,url:"https://example.org/source",title:"Source"}],
  claims:[{id:claimId,workspaceId,taskId,text:"A testable claim",sourceIds:[sourceId]}],
  researchEvidence:[{id:"ev1",workspaceId,taskId,sourceId,claimId,excerpt:"A transcribed evidence excerpt for the claim.",stance:"supports"}],
  originalityChecks:[],editorialReviews:[]
 }};
}
describe("version-bound editorial approval",()=>{
 it("blocks approval until current draft checks are complete",()=>{
  const f=fixture();const report=getEditorialApproval(f.state,f.workspaceId,f.taskId);
  expect(report.readyForApproval).toBe(false);
  expect(report.blockers).toContain("current-draft-originality-check-missing");
 });
 it("records approval against the current draft fingerprint",()=>{
  const f=fixture();checkEditorialDraftOriginality(f.state,{workspaceId:f.workspaceId,taskId:f.taskId});
  const result=recordEditorialReview(f.state,{workspaceId:f.workspaceId,taskId:f.taskId,decision:"approved",reviewerName:"Editor",rationale:"I reviewed the full draft and its linked evidence."});
  expect(result.readiness.approvedForCurrentDraft).toBe(true);
  expect(assertCurrentEditorialApproval(f.state,f.workspaceId,f.taskId).approvedForCurrentDraft).toBe(true);
 });
 it("does not allow approved review for a different draft version",()=>{
  const f=fixture();checkEditorialDraftOriginality(f.state,{workspaceId:f.workspaceId,taskId:f.taskId});
  recordEditorialReview(f.state,{workspaceId:f.workspaceId,taskId:f.taskId,decision:"approved",reviewerName:"Editor",rationale:"I reviewed the full draft and its linked evidence."});
  f.state.editorialDrafts[0].title="Edited after approval";
  expect(getEditorialApproval(f.state,f.workspaceId,f.taskId).approvedForCurrentDraft).toBe(false);
  expect(()=>assertCurrentEditorialApproval(f.state,f.workspaceId,f.taskId)).toThrow("current human approval");
 });
 it("rejects approval from another workspace or from the wrong lifecycle stage",()=>{
  const f=fixture();
  expect(()=>recordEditorialReview(f.state,{workspaceId:"other",taskId:f.taskId,decision:"approved",reviewerName:"Editor",rationale:"Reviewed and approved after careful consideration."})).toThrow("Editorial task not found");
  f.state.tasks.t1.article.stage="drafting";
  expect(()=>recordEditorialReview(f.state,{workspaceId:f.workspaceId,taskId:f.taskId,decision:"changes-requested",reviewerName:"Editor",rationale:"Revise the evidence and improve the second section."})).toThrow("editorial-approval stage");
 });
});
