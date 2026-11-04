import { describe, expect, it, vi } from "vitest";
import { createOpenAICompatibleProvider } from "./model-provider.mjs";
describe("OpenAI-compatible model provider",()=>{
 it("remains disabled when required server credentials are absent",()=>{
  expect(createOpenAICompatibleProvider({baseUrl:"",apiKey:"",model:""})).toBeNull();
 });
 it("rejects non-HTTPS remote endpoints and embedded URL credentials",()=>{
  expect(()=>createOpenAICompatibleProvider({baseUrl:"http://models.example.com/v1",apiKey:"secret",model:"model"})).toThrow("HTTPS");
  expect(()=>createOpenAICompatibleProvider({baseUrl:"https://user:pass@models.example.com/v1",apiKey:"secret",model:"model"})).toThrow("credentials");
 });
 it("supports loopback development endpoints and parses JSON output",async()=>{
  const fetchImpl=vi.fn().mockResolvedValue({ok:true,status:200,json:async()=>({model:"mock-model",choices:[{message:{content:'{"ok":true}'}}],usage:{prompt_tokens:12,completion_tokens:9,total_tokens:21}})});
  const provider=createOpenAICompatibleProvider({baseUrl:"http://127.0.0.1:11434/v1",apiKey:"local-key",model:"local-model",fetchImpl});
  const result=await provider.generateJSON({system:"Return only a JSON object in the required shape.",prompt:"Create a tiny JSON object for the test."});
  expect(result.output).toEqual({ok:true});
  expect(result.usage).toEqual({promptTokens:12,completionTokens:9,totalTokens:21});
  expect(fetchImpl.mock.calls[0][1].headers.Authorization).toBe("Bearer local-key");
  expect(fetchImpl.mock.calls[0][1].redirect).toBe("error");
  expect(JSON.parse(fetchImpl.mock.calls[0][1].body).response_format).toEqual({type:"json_object"});
 });
 it("sends image context as bounded OpenAI-compatible image_url parts",async()=>{
  const fetchImpl=vi.fn().mockResolvedValue({ok:true,status:200,json:async()=>({model:"vision-model",choices:[{message:{content:'{"ok":true}'}}],usage:{prompt_tokens:3,completion_tokens:2,total_tokens:5}})});
  const provider=createOpenAICompatibleProvider({baseUrl:"https://models.example.com/v1",apiKey:"secret",model:"vision-model",fetchImpl});
  await provider.generateJSON({system:"Return a small JSON object.",prompt:"Describe this uploaded image carefully.",images:[{mimeType:"image/jpeg",data:Buffer.from("image-bytes")} ]});
  const body=JSON.parse(fetchImpl.mock.calls[0][1].body);
  expect(body.messages[1].content[0]).toMatchObject({type:"text"});
  expect(body.messages[1].content[1].image_url.url).toBe("data:image/jpeg;base64,aW1hZ2UtYnl0ZXM=");
 });
 it("rejects image contexts that exceed the bounded request size",async()=>{
  const provider=createOpenAICompatibleProvider({baseUrl:"https://models.example.com/v1",apiKey:"secret",model:"vision-model",fetchImpl:vi.fn()});
  await expect(provider.generateJSON({system:"Return a small JSON object.",prompt:"Describe this uploaded image carefully.",images:[{mimeType:"image/png",data:Buffer.alloc(10*1024*1024+1)}]})).rejects.toMatchObject({status:413});
 });
 it("rejects non-finite temperature before network access",async()=>{
  const fetchImpl=vi.fn();
  const provider=createOpenAICompatibleProvider({baseUrl:"https://models.example.com/v1",apiKey:"secret",model:"model",fetchImpl});
  await expect(provider.generateJSON({system:"A sufficiently long system prompt.",prompt:"A sufficiently long prompt for a response.",temperature:Number.NaN})).rejects.toMatchObject({status:400});
  expect(fetchImpl).not.toHaveBeenCalled();
 });
 it("never includes provider error response bodies in surfaced errors",async()=>{
  const provider=createOpenAICompatibleProvider({baseUrl:"https://models.example.com/v1",apiKey:"secret",model:"model",fetchImpl:vi.fn().mockResolvedValue({ok:false,status:429,text:async()=>"secret provider payload"})});
  await expect(provider.generateJSON({system:"A sufficiently long system prompt.",prompt:"A sufficiently long prompt for a response."})).rejects.toMatchObject({status:429,message:"Model provider rate or account quota limit reached"});
 });
});
