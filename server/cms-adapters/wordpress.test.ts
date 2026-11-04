import { describe, expect, it, vi } from "vitest";
import { createWordPressAdapter } from "./wordpress.mjs";
describe("WordPress draft adapter",()=>{
 it("is disabled without server credentials",()=>expect(createWordPressAdapter({siteUrl:"",username:"",applicationPassword:""})).toBeNull());
 it("requires HTTPS for non-loopback sites",()=>expect(()=>createWordPressAdapter({siteUrl:"http://example.com",username:"user",applicationPassword:"pass"})).toThrow("HTTPS"));
 it("creates only a remote draft using application-password Basic auth",async()=>{
  const fetchImpl=vi.fn().mockResolvedValue({ok:true,status:201,json:async()=>({id:42,status:"draft",link:"https://site.example/post/"})});
  const adapter=createWordPressAdapter({siteUrl:"https://site.example",username:"editor",applicationPassword:"abcd efgh",fetchImpl});
  const result=await adapter.createDraft({title:"Title for WordPress",html:"<p>Article body</p>",slug:"maaroof-task-1",excerpt:"Excerpt"});
  expect(result).toMatchObject({remoteId:"42",status:"draft",url:"https://site.example/post/"});
  expect(fetchImpl.mock.calls[0][1].method).toBe("POST");
  expect(JSON.parse(fetchImpl.mock.calls[0][1].body).status).toBe("draft");
  expect(fetchImpl.mock.calls[0][1].headers.Authorization).toBe("Basic "+Buffer.from("editor:abcdefgh").toString("base64"));
  expect(fetchImpl.mock.calls[0][1].redirect).toBe("error");
 });
 it("does not follow redirects with authentication headers",async()=>{
  const fetchImpl=vi.fn().mockRejectedValue(Object.assign(new TypeError("redirect"),{}));
  const adapter=createWordPressAdapter({siteUrl:"https://site.example",username:"user",applicationPassword:"password",fetchImpl});
  await expect(adapter.createDraft({title:"Title for WordPress",html:"<p>Body</p>",slug:"task-1"})).rejects.toMatchObject({status:502,message:"WordPress request failed or redirected; remote result may require reconciliation"});
 });
});
