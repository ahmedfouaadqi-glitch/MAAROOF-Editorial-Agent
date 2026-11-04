import { describe, expect, it } from "vitest";
import { assessSource, recordEvidence, listResearch } from "./editorial-research.mjs";

function fixture(){
 const workspaceId="w1",taskId="t1",sourceId="s1",claimId="c1";
 return {workspaceId,taskId,sourceId,claimId,state:{
  tasks:{t1:{workspaceId,article:{topic:"test"}}},
  sources:[{id:sourceId,workspaceId,taskId,url:"https://example.org/report",title:"Report",fetched:false}],
  claims:[{id:claimId,workspaceId,taskId,text:"A testable claim",sourceIds:[sourceId]}],
  researchEvidence:[]
 }};
}
describe("manual editorial research records",()=>{
 it("stores a dated source assessment and explicit human quality rationale",()=>{
  const f=fixture();
  const source=assessSource(f.state,{workspaceId:f.workspaceId,taskId:f.taskId,sourceId:f.sourceId,author:"Research team",publisher:"Example Institute",sourceType:"academic",publishedAt:"2025-01-01",jurisdiction:"Iraq",methodology:"Documented sampling and comparative review",qualityRating:"high",qualityRationale:"Methods and limitations are clearly described."});
  expect(source.research.qualityRating).toBe("high");
  expect(source.research.metadataCompleteness).toBeGreaterThan(0);
  expect(source.research.assessmentMode).toBe("manual-editorial-review");
 });
 it("records excerpt stance but never labels it independently verified",()=>{
  const f=fixture();
  const evidence=recordEvidence(f.state,{workspaceId:f.workspaceId,taskId:f.taskId,sourceId:f.sourceId,claimId:f.claimId,excerpt:"The report describes the measured outcome.",locator:"Page 4",stance:"supports"});
  expect(evidence.verificationState).toBe("manually-transcribed-unverified");
  const report=listResearch(f.state,f.workspaceId,f.taskId);
  expect(report.claims[0].conflictState).toBe("supporting-evidence-recorded");
 });
 it("flags opposing annotations without deciding which is correct",()=>{
  const f=fixture();
  for(const stance of ["supports","contradicts"])recordEvidence(f.state,{workspaceId:f.workspaceId,taskId:f.taskId,sourceId:f.sourceId,claimId:f.claimId,excerpt:"A manually transcribed excerpt.",locator:"Page 2",stance});
  expect(listResearch(f.state,f.workspaceId,f.taskId).claims[0].conflictState).toBe("conflicting-evidence");
 });
 it("rejects cross-workspace evidence links",()=>{
  const f=fixture();
  expect(()=>recordEvidence(f.state,{workspaceId:"other",taskId:f.taskId,sourceId:f.sourceId,claimId:f.claimId,excerpt:"An excerpt that is long enough.",stance:"supports"})).toThrow("Editorial task not found");
 });
});
