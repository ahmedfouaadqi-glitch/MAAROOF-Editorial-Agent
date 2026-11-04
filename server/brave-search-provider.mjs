const ENDPOINT = "https://api.search.brave.com/res/v1/web/search";
function providerError(message,status=502){const error=new Error(message);error.status=status;return error;}
export function createBraveSearchProvider({apiKey=process.env.BRAVE_SEARCH_API_KEY,fetchImpl=globalThis.fetch,timeoutMs=12000}={}){
 if(typeof apiKey!=="string"||!apiKey.trim())return null;
 if(typeof fetchImpl!=="function")throw new Error("A fetch implementation is required");
 return {
  id:"brave-web-search",
  async search(request){
   const body={q:request.query,count:Math.min(request.limit,20),safesearch:"moderate"};
   if(request.language!=="auto")body.search_lang=request.language;
   const response=await fetchImpl(ENDPOINT,{
    method:"POST",headers:{"Accept":"application/json","Content-Type":"application/json","X-Subscription-Token":apiKey,...(request.country?{"x-loc-country":request.country}:{})},
    body:JSON.stringify(body),signal:AbortSignal.timeout(timeoutMs)
   }).catch(error=>{
    if(error?.name==="TimeoutError"||error?.name==="AbortError")throw providerError("Search provider timed out",504);
    throw providerError("Search provider could not be reached",502);
   });
   if(!response.ok){
    if(response.status===401||response.status===403)throw providerError("Search provider authentication or plan access failed",502);
    if(response.status===429)throw providerError("Search provider rate or account quota limit reached",429);
    throw providerError("Search provider returned HTTP "+response.status,502);
   }
   let payload;try{payload=await response.json();}catch{throw providerError("Search provider returned invalid JSON",502);}
   const rows=Array.isArray(payload?.web?.results)?payload.web.results:[];
   return {results:rows.map(item=>({title:item.title,url:item.url,snippet:item.description||"",publisher:item.meta_url?.hostname||"",publishedAt:item.page_age||item.published||null}))};
  }
 };
}
