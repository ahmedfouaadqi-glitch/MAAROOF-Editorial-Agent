import { describe, expect, it, vi } from "vitest";
import { executeResearchSearch, validateSearchRequest } from "./research-provider.mjs";
describe("provider-neutral research search",()=>{
 it("validates bounded query parameters",()=>{
  expect(validateSearchRequest({query:"  الذكاء الاصطناعي ",language:"ar"})).toMatchObject({query:"الذكاء الاصطناعي",limit:10,language:"ar"});
  expect(()=>validateSearchRequest({query:"x"})).toThrow("2-400");
 });
 it("fails closed when no provider is configured",async()=>{
  await expect(executeResearchSearch({query:"market trends"})).rejects.toMatchObject({status:503});
 });
 it("normalizes and deduplicates results without claiming verification",async()=>{
  const provider={id:"test-provider",search:vi.fn().mockResolvedValue({results:[
   {url:"https://example.org/a#section",title:"A",snippet:"Summary"},
   {url:"https://example.org/a",title:"Duplicate"},
   {url:"javascript:alert(1)",title:"Unsafe"},
   {url:"https://example.net/b",title:"B",publishedAt:"2025-02-01"}
  ]})};
  const result=await executeResearchSearch({query:"research",limit:5},{provider});
  expect(result.results).toHaveLength(2);
  expect(result.results[0].verificationState).toBe("search-result-unverified");
  expect(result.results[1].publishedAt).toBe("2025-02-01T00:00:00.000Z");
  expect(result.limitations.length).toBeGreaterThan(0);
 });
});
