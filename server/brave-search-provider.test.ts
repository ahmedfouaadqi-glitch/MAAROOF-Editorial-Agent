import { describe, expect, it, vi } from "vitest";
import { createBraveSearchProvider } from "./brave-search-provider.mjs";
describe("Brave web search adapter",()=>{
 it("is disabled without a secret",()=>expect(createBraveSearchProvider({apiKey:""})).toBeNull());
 it("maps web results and sends secrets only as a server header",async()=>{
  const fetchImpl=vi.fn().mockResolvedValue({ok:true,status:200,json:async()=>({web:{results:[{title:"Result",url:"https://example.org",description:"Snippet",meta_url:{hostname:"example.org"},page_age:"2026-10-20"}]}})});
  const provider=createBraveSearchProvider({apiKey:"server-only-secret",fetchImpl});
  const result=await provider.search({query:"محركات البحث",limit:8,country:"IQ",language:"ar"});
  expect(result.results[0]).toMatchObject({title:"Result",url:"https://example.org",snippet:"Snippet",publisher:"example.org"});
  expect(fetchImpl.mock.calls[0][0]).toContain("country=IQ");
  expect(fetchImpl.mock.calls[0][1].headers["X-Subscription-Token"]).toBe("server-only-secret");
 });
 it("maps quota and access failures to sanitized errors",async()=>{
  const provider=createBraveSearchProvider({apiKey:"key",fetchImpl:vi.fn().mockResolvedValue({ok:false,status:429})});
  await expect(provider.search({query:"research",limit:5,country:"IQ",language:"en"})).rejects.toMatchObject({status:429,message:"Search provider rate or account quota limit reached"});
 });
});
