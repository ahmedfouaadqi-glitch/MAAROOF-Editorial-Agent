function fail(message,status=502){const error=new Error(message);error.status=status;throw error;}
function baseUrl(value){
 let url;try{url=new URL(value);}catch{fail("WordPress site URL is invalid",500);}
 const local=["localhost","127.0.0.1","[::1]"].includes(url.hostname);
 if(url.protocol!=="https:"&&!(url.protocol==="http:"&&local))fail("WordPress site must use HTTPS, except for loopback development",500);
 if(url.username||url.password||url.search||url.hash)fail("WordPress site URL must not contain credentials, query, or fragment",500);
 return url.toString().replace(/\/+$/,"");
}
function safeText(value,max=12000){if(typeof value!=="string"||!value.trim()||value.length>max)fail("Invalid WordPress draft content",400);return value.trim();}
function checkResponse(status){
 if(status===401||status===403)fail("WordPress authorization or REST permission failed",502);
 if(status===404)fail("WordPress REST posts endpoint was not found",502);
 if(status===429)fail("WordPress rate limit reached",429);
 if(status>=500)fail("WordPress returned a server error",502);
 fail("WordPress rejected the draft request (HTTP "+status+")",400);
}
export function createWordPressAdapter({siteUrl=process.env.WORDPRESS_SITE_URL,username=process.env.WORDPRESS_USERNAME,applicationPassword=process.env.WORDPRESS_APPLICATION_PASSWORD,fetchImpl=globalThis.fetch,timeoutMs=20000}={}){
 if(!siteUrl||!username||!applicationPassword)return null;
 const root=baseUrl(siteUrl),endpoint=root+"/wp-json/wp/v2/posts";
 if(typeof fetchImpl!=="function")throw new Error("A fetch implementation is required");
 const authorization="Basic "+Buffer.from(username+":"+applicationPassword.replace(/\s+/g,"")).toString("base64");
 async function request(url,options={}){
  const response=await fetchImpl(url,{...options,headers:{Authorization:authorization,Accept:"application/json",...(options.body?{"Content-Type":"application/json"}:{}),...options.headers},redirect:"error",signal:AbortSignal.timeout(timeoutMs)}).catch(error=>{
   if(error?.name==="TimeoutError"||error?.name==="AbortError")fail("WordPress request timed out; remote result may require reconciliation",504);
   if(error?.name==="TypeError")fail("WordPress request failed or redirected; remote result may require reconciliation",502);
   throw error;
  });
  if(!response.ok)checkResponse(response.status);
  try{return await response.json();}catch{fail("WordPress returned invalid JSON",502);}
 }
 return {
  id:"wordpress-rest",
  async createDraft(input){
   const title=safeText(input.title,300),content=safeText(input.html,100000);
   const slug=safeText(input.slug,180);
   const payload={title,content,status:"draft",slug,excerpt:typeof input.excerpt==="string"?input.excerpt.slice(0,1000):""};
   const data=await request(endpoint,{method:"POST",body:JSON.stringify(payload)});
   if(!Number.isSafeInteger(data?.id)||data.status!=="draft")fail("WordPress did not confirm creation of a draft post",502);
   return {remoteId:String(data.id),url:typeof data.link==="string"?data.link:null,status:data.status,platform:"wordpress"};
  },
  async getPost(remoteId){
   if(!/^\d+$/.test(String(remoteId)))fail("Invalid WordPress remote post ID",400);
   const data=await request(endpoint+"/"+encodeURIComponent(String(remoteId))+"?context=edit",{method:"GET"});
   return {remoteId:String(data.id),url:typeof data.link==="string"?data.link:null,status:data.status,platform:"wordpress"};
  }
 };
}
