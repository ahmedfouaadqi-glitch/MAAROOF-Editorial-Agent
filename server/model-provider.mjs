function fail(message,status=502){const error=new Error(message);error.status=status;throw error;}
function endpointFrom(baseUrl){
 let url;try{url=new URL(baseUrl);}catch{fail("Model provider base URL is invalid",500);}
 const local=["localhost","127.0.0.1","[::1]"].includes(url.hostname);
 if(url.protocol!=="https:"&&!(url.protocol==="http:"&&local))fail("Model provider must use HTTPS, except for loopback development endpoints",500);
 if(url.username||url.password||url.search||url.hash)fail("Model provider URL must not contain credentials, query parameters, or fragments",500);
 return url.toString().replace(/\/+$/,"")+"/chat/completions";
}
export function createOpenAICompatibleProvider({baseUrl=process.env.MODEL_API_BASE_URL,apiKey=process.env.MODEL_API_KEY,model=process.env.MODEL_NAME,fetchImpl=globalThis.fetch,timeoutMs=60000}={}){
 if(!baseUrl||!apiKey||!model)return null;
 const endpoint=endpointFrom(baseUrl);
 if(typeof fetchImpl!=="function")throw new Error("A fetch implementation is required");
 return {
  id:"openai-compatible",
  model,
  async generateJSON({system,prompt,maxTokens=1800,temperature=0.2,images=[],signal}){
   if(typeof system!=="string"||system.length<10||system.length>12000)fail("Model system prompt must contain 10-12000 characters",400);
   if(typeof prompt!=="string"||prompt.trim().length<10||prompt.length>60000)fail("Model prompt must contain 10-60000 characters",400);
   if(!Number.isSafeInteger(maxTokens)||maxTokens<64||maxTokens>8192)fail("maxTokens must be from 64 to 8192",400);
   if(typeof temperature!=="number"||!Number.isFinite(temperature)||temperature<0||temperature>1)fail("temperature must be between 0 and 1",400);
   if(!Array.isArray(images)||images.length>8)fail("At most 8 images may be included",400);
   let imageBytes=0;
   const messageContent=[{type:"text",text:prompt}];
   for(const image of images){
    if(!image||typeof image.mimeType!=="string"||!/^image\/(jpeg|png|webp)$/.test(image.mimeType))fail("Only JPEG, PNG or WebP image context is supported",400);
    const bytes=Buffer.isBuffer(image.data)?image.data:Buffer.from(typeof image.data==="string"?image.data:"", "base64");
    if(!bytes.length)fail("Image context must contain image bytes",400);
    imageBytes+=bytes.length;
    if(imageBytes>10*1024*1024)fail("Combined image context exceeds 10 MiB",413);
    messageContent.push({type:"image_url",image_url:{url:`data:${image.mimeType};base64,${bytes.toString("base64")}`,detail:"auto"}});
   }
   const response=await fetchImpl(endpoint,{
    method:"POST",
    headers:{"Authorization":"Bearer "+apiKey,"Content-Type":"application/json","Accept":"application/json"},
    redirect:"error",
    body:JSON.stringify({model,messages:[{role:"system",content:system},{role:"user",content:images.length?messageContent:prompt}],temperature,max_tokens:maxTokens,response_format:{type:"json_object"}}),
    signal:signal ? AbortSignal.any([AbortSignal.timeout(timeoutMs), signal]) : AbortSignal.timeout(timeoutMs)
   }).catch(error=>{
    if(error?.name==="TimeoutError"||error?.name==="AbortError")throw fail("Model provider timed out",504);
    throw fail("Model provider could not be reached",502);
   });
   if(!response.ok){
    if(response.status===401||response.status===403)fail("Model provider authentication or model access failed",502);
    if(response.status===429)fail("Model provider rate or account quota limit reached",429);
    fail("Model provider returned HTTP "+response.status,502);
   }
   let payload;try{payload=await response.json();}catch{fail("Model provider returned invalid JSON",502);}
   const content=payload?.choices?.[0]?.message?.content;
   if(typeof content!=="string"||!content.trim())fail("Model provider returned no text content",502);
   let output;try{output=JSON.parse(content);}catch{fail("Model provider output was not valid JSON",502);}
   const usage=payload?.usage||{};
   return {output,provider:this.id,model:typeof payload?.model==="string"?payload.model:model,usage:{
    promptTokens:Number.isSafeInteger(usage.prompt_tokens)?usage.prompt_tokens:null,
    completionTokens:Number.isSafeInteger(usage.completion_tokens)?usage.completion_tokens:null,
    totalTokens:Number.isSafeInteger(usage.total_tokens)?usage.total_tokens:null
   }};
  }
 };
}
