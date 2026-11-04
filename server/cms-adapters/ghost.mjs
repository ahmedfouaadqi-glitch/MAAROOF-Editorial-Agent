import { createHmac } from "node:crypto";
function fail(message,status=502){const error=new Error(message);error.status=status;throw error;}
function baseUrl(value){
 let url;try{url=new URL(value);}catch{fail("Ghost Admin URL is invalid",500);}
 const local=["localhost","127.0.0.1","[::1]"].includes(url.hostname);
 if(url.protocol!=="https:"&&!(url.protocol==="http:"&&local))fail("Ghost Admin URL must use HTTPS, except for loopback development",500);
 if(url.username||url.password||url.search||url.hash)fail("Ghost Admin URL must not contain credentials, query, or fragment",500);
 return url.toString().replace(/\/+$/,"");
}
function tokenFromKey(key){
 if(typeof key!=="string"||!/^[-\w]+:[a-fA-F0-9]{32,}$/.test(key))fail("Ghost Admin API key must contain an ID and hexadecimal secret",500);
 const [id,hex]=key.split(":");
 const now=Math.floor(Date.now()/1000);
 const header=Buffer.from(JSON.stringify({alg:"HS256",typ:"JWT",kid:id})).toString("base64url");
 const payload=Buffer.from(JSON.stringify({iat:now,exp:now+300,aud:"/admin/"})).toString("base64url");
 const unsigned=header+"."+payload;
 const signature=createHmac("sha256",Buffer.from(hex,"hex")).update(unsigned).digest("base64url");
 return unsigned+"."+signature;
}
function requiredText(value,max,field){if(typeof value!=="string"||!value.trim()||value.length>max)fail("Invalid "+field,400);return value.trim();}
function checkResponse(status){
 if(status===401||status===403)fail("Ghost Admin authentication or integration permission failed",502);
 if(status===404)fail("Ghost Admin API posts endpoint was not found",502);
 if(status===429)fail("Ghost Admin API rate limit reached",429);
 if(status>=500)fail("Ghost Admin returned a server error",502);
 fail("Ghost Admin rejected the draft request (HTTP "+status+")",400);
}
export function createGhostAdapter({adminUrl=process.env.GHOST_ADMIN_URL,adminApiKey=process.env.GHOST_ADMIN_API_KEY,apiVersion=process.env.GHOST_API_VERSION,fetchImpl=globalThis.fetch,timeoutMs=20000}={}){
 if(!adminUrl||!adminApiKey||!apiVersion)return null;
 if(!/^v\d+\.\d+$/.test(apiVersion))fail("Ghost API version must use vN.N format",500);
 const root=baseUrl(adminUrl),endpoint=root+"/ghost/api/admin/posts/";
 if(typeof fetchImpl!=="function")throw new Error("A fetch implementation is required");
 async function request(url,options={}){
  const response=await fetchImpl(url,{...options,headers:{Authorization:"Ghost "+tokenFromKey(adminApiKey),"Accept-Version":apiVersion,Accept:"application/json",...(options.body?{"Content-Type":"application/json"}:{}),...options.headers},redirect:"error",signal:AbortSignal.timeout(timeoutMs)}).catch(error=>{
   if(error?.name==="TimeoutError"||error?.name==="AbortError")fail("Ghost request timed out; remote result may require reconciliation",504);
   if(error?.name==="TypeError")fail("Ghost request failed or redirected; remote result may require reconciliation",502);
   throw error;
  });
  if(!response.ok)checkResponse(response.status);
  try{return await response.json();}catch{fail("Ghost returned invalid JSON",502);}
 }
 return {
  id:"ghost-admin",
  async createDraft(input){
   const post={title:requiredText(input.title,300,"Ghost title"),html:requiredText(input.html,100000,"Ghost HTML"),status:"draft"};
   if(typeof input.excerpt==="string"&&input.excerpt.trim())post.custom_excerpt=input.excerpt.trim().slice(0,300);
   if(typeof input.metaTitle==="string"&&input.metaTitle.trim())post.meta_title=input.metaTitle.trim().slice(0,300);
   if(typeof input.metaDescription==="string"&&input.metaDescription.trim())post.meta_description=input.metaDescription.trim().slice(0,500);
   if(typeof input.slug==="string"&&input.slug.trim())post.slug=input.slug.trim().slice(0,191);
   const data=await request(endpoint,{method:"POST",body:JSON.stringify({posts:[post]})});
   const created=data?.posts?.[0];
   if(!created?.id||created.status!=="draft")fail("Ghost did not confirm creation of a draft post",502);
   return {remoteId:String(created.id),url:typeof created.url==="string"?created.url:null,status:created.status,platform:"ghost"};
  },
  async getPost(remoteId){
   if(typeof remoteId!=="string"||!/^[-\w]+$/.test(remoteId))fail("Invalid Ghost remote post ID",400);
   const data=await request(endpoint+encodeURIComponent(remoteId)+"/",{method:"GET"});
   const post=data?.posts?.[0];
   if(!post?.id)fail("Ghost returned no matching post",404);
   return {remoteId:String(post.id),url:typeof post.url==="string"?post.url:null,status:post.status,platform:"ghost"};
  },
  async findBySlug(slug){
   const safeSlug=requiredText(slug,191,"Ghost slug");
   const data=await request(endpoint+"slug/"+encodeURIComponent(safeSlug)+"/",{method:"GET"});
   const post=data?.posts?.[0];
   return post?.id?[{remoteId:String(post.id),url:typeof post.url==="string"?post.url:null,status:post.status,slug:post.slug,platform:"ghost"}]:[];
  }
 };
}
