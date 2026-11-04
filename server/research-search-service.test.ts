import { describe, expect, it, vi } from "vitest";
import { DEFAULT_LIMITS } from "./research-budget.mjs";
import { runMeteredResearchSearch } from "./research-search-service.mjs";
function fixture(searches=0){
 const state={version:1,limits:{...DEFAULT_LIMITS},tasks:{t1:{workspaceId:"w1",article:{topic:"topic"},usage:{source:0,search:searches,inspect:0},reservations:{}}},sources:[],researchSearches:[]};
 return {state,store:{read:async()=>structuredClone(state),transact:async fn=>fn(state)}};
}
describe("metered research search",()=>{
 it("records results and commits the search quota only after the provider call",async()=>{
  const f=fixture();const provider={id:"mock",search:vi.fn().mockResolvedValue({results:[{title:"Source",url:"https://example.org",snippet:"Snippet"}]})};
  const result=await runMeteredResearchSearch({store:f.store,provider,workspaceId:"w1",taskId:"t1",input:{query:"research query",language:"en"}});
  expect(result.allowed).toBe(true);expect(result.result.results[0].verificationState).toBe("search-result-unverified");
  expect(result.quota).toMatchObject({used:1,remaining:4,status:"committed"});
  expect(f.state.researchSearches).toHaveLength(1);
 });
 it("counts provider attempts conservatively after a provider error",async()=>{
  const f=fixture();const provider={id:"mock",search:vi.fn().mockRejectedValue(Object.assign(new Error("upstream failed"),{status:502}))};
  await expect(runMeteredResearchSearch({store:f.store,provider,workspaceId:"w1",taskId:"t1",input:{query:"research query"}})).rejects.toMatchObject({status:502});
  expect(f.state.tasks.t1.usage.search).toBe(1);
  expect(Object.values(f.state.tasks.t1.reservations)[0].status).toBe("committed");
 });
 it("does not call the provider after the per-article limit is reached",async()=>{
  const f=fixture(5);const provider={id:"mock",search:vi.fn()};
  const result=await runMeteredResearchSearch({store:f.store,provider,workspaceId:"w1",taskId:"t1",input:{query:"research query"}});
  expect(result.allowed).toBe(false);expect(provider.search).not.toHaveBeenCalled();
 });
 it("rejects cross-workspace task access without reservation",async()=>{
  const f=fixture();const provider={id:"mock",search:vi.fn()};
  await expect(runMeteredResearchSearch({store:f.store,provider,workspaceId:"w2",taskId:"t1",input:{query:"research query"}})).rejects.toMatchObject({status:404});
  expect(provider.search).not.toHaveBeenCalled();
 });
});
