import { describe, expect, it, vi } from "vitest";
import { runEditorialDraftGeneration } from "./editorial-writing.mjs";
function fixture(){
 const workspaceId="w1",taskId="t1",sourceId="s1",claimId="c1",evidenceId="e1";
 const draft={id:"d1",workspaceId,taskId,title:"",language:"en",sections:[{id:"sec1",heading:"Context",brief:"Explain the context",body:""}],metaTitle:"",metaDescription:"",editorialAngle:"",status:"outline"};
 const state={tasks:{t1:{workspaceId,article:{topic:"A sufficiently detailed topic",language:"en",objective:"analysis",stage:"drafting"}}},editorialDrafts:[draft],
 sources:[{id:sourceId,workspaceId,taskId,url:"https://example.org/report",title:"Report",research:{publisher:"Example",qualityRating:"medium",assessmentMode:"manual-editorial-review"}}],
 claims:[{id:claimId,workspaceId,taskId,text:"A supported editorial claim",sourceIds:[sourceId]}],
 researchEvidence:[{id:evidenceId,workspaceId,taskId,sourceId,claimId,excerpt:"A sufficiently detailed evidence excerpt supplied by the editor.",stance:"supports",verificationState:"manually-transcribed-unverified"}],modelUsage:[]};
 const store={read:async()=>structuredClone(state),transact:async mutator=>mutator(state)};
 const provider={id:"mock",model:"mock-model",generateJSON:vi.fn().mockResolvedValue({provider:"mock",model:"mock-model",usage:{promptTokens:100,completionTokens:200,totalTokens:300},output:{
  title:"A carefully sourced article title",dek:"A concise introduction to the subject.",editorialAngle:"Evidence-led analysis.",metaTitle:"Carefully sourced article",metaDescription:"A detailed description of the article for search results.",
  sections:[{heading:"Context",body:"This section explains the supplied evidence while making clear that the excerpt is not independently verified. It avoids unsupported additions.",evidenceIds:[evidenceId],claimIds:[claimId]}],
  entities:[{name:"Example organization",type:"organization",relevance:"primary"}],keywords:[{term:"research topic",intent:"informational",role:"primary"}]
 }})};
 return {state,store,provider,workspaceId,taskId};
}
describe("AI-assisted editorial drafting contract",()=>{
 it("creates a draft with only existing evidence and claim references",async()=>{
  const f=fixture();const result=await runEditorialDraftGeneration({store:f.store,provider:f.provider,workspaceId:f.workspaceId,taskId:f.taskId});
  expect(result.draft.status).toBe("draft");expect(result.draft.generationMode).toBe("model-assisted");
  expect(result.draft.sections[0].evidenceIds).toEqual(["e1"]);
  expect(f.state.modelUsage).toHaveLength(1);
 });
 it("rejects evidence IDs fabricated by the model and does not save the draft",async()=>{
  const f=fixture();f.provider.generateJSON.mockResolvedValueOnce({output:{title:"A carefully sourced article title",metaTitle:"Carefully sourced article",metaDescription:"A detailed description of the article for search results.",sections:[{heading:"Context",body:"This section has sufficient length to pass the basic structural content check and then some.",evidenceIds:["unknown"],claimIds:["c1"]}]}});
  await expect(runEditorialDraftGeneration({store:f.store,provider:f.provider,workspaceId:f.workspaceId,taskId:f.taskId})).rejects.toMatchObject({status:422});
  expect(f.state.editorialDrafts[0].status).toBe("outline");
 });
 it("does not run outside the drafting stage or without a provider",async()=>{
  const f=fixture();f.state.tasks.t1.article.stage="source-review";
  await expect(runEditorialDraftGeneration({store:f.store,provider:f.provider,workspaceId:f.workspaceId,taskId:f.taskId})).rejects.toMatchObject({status:409});
  expect(f.provider.generateJSON).not.toHaveBeenCalled();
  await expect(runEditorialDraftGeneration({store:f.store,provider:null,workspaceId:f.workspaceId,taskId:f.taskId})).rejects.toMatchObject({status:503});
 });
 it("rejects stale outline writes if the article changes during generation",async()=>{
  const f=fixture();
  f.provider.generateJSON.mockImplementationOnce(async()=>{
   f.state.editorialDrafts[0].title="A concurrent editor title";
   return {output:{title:"A carefully sourced article title",metaTitle:"Carefully sourced article",metaDescription:"A detailed description of the article for search results.",sections:[{heading:"Context",body:"This section explains the supplied evidence while making clear that the excerpt is not independently verified.",evidenceIds:["e1"],claimIds:["c1"]}]}};
  });
  await expect(runEditorialDraftGeneration({store:f.store,provider:f.provider,workspaceId:f.workspaceId,taskId:f.taskId})).rejects.toMatchObject({status:409});
  expect(f.state.editorialDrafts[0].title).toBe("A concurrent editor title");
 });
});
