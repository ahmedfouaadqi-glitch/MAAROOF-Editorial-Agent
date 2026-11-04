import { describe, expect, it, vi } from "vitest";
import { createGhostAdapter } from "./ghost.mjs";
describe("Ghost Admin draft adapter",()=>{
 it("is disabled without all server configuration",()=>expect(createGhostAdapter({adminUrl:"",adminApiKey:"",apiVersion:""})).toBeNull());
 it("rejects malformed API keys and non-HTTPS remote URLs",()=>{
  expect(()=>createGhostAdapter({adminUrl:"https://ghost.example",adminApiKey:"bad-key",apiVersion:"v5.0"})).toThrow("ID and hexadecimal secret");
  expect(()=>createGhostAdapter({adminUrl:"http://ghost.example",adminApiKey:"id:".concat("a".repeat(64)),apiVersion:"v5.0"})).toThrow("HTTPS");
 });
 it("creates only a draft with a short-lived Ghost JWT",async()=>{
  const fetchImpl=vi.fn().mockResolvedValue({ok:true,status:201,json:async()=>({posts:[{id:"post123",status:"draft",url:"https://ghost.example/post/"}]})});
  const key="integration-id:"+ "ab".repeat(32);
  const adapter=createGhostAdapter({adminUrl:"https://ghost.example",adminApiKey:key,apiVersion:"v5.0",fetchImpl});
  const result=await adapter.createDraft({title:"Title for Ghost",html:"<p>Body</p>",metaTitle:"Meta title",metaDescription:"A useful description"});
  expect(result).toMatchObject({remoteId:"post123",status:"draft",url:"https://ghost.example/post/"});
  expect(fetchImpl.mock.calls[0][0]).toBe("https://ghost.example/ghost/api/admin/posts/");
  expect(fetchImpl.mock.calls[0][1].headers["Accept-Version"]).toBe("v5.0");
  expect(fetchImpl.mock.calls[0][1].headers.Authorization).toMatch(/^Ghost [\w.-]+$/);
  expect(JSON.parse(fetchImpl.mock.calls[0][1].body).posts[0].status).toBe("draft");
 });
});
