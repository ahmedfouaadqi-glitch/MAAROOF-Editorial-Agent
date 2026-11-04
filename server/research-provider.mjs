const MAX_QUERY_LENGTH = 500;
const MAX_RESULTS = 20;
function fail(message,status=400){const error=new Error(message);error.status=status;throw error;}
export function validateSearchRequest(input){
 if(!input||typeof input.query!=="string"||input.query.trim().length<2||input.query.length>MAX_QUERY_LENGTH)fail("query must contain 2-500 characters");
 const limit=input.limit===undefined?10:input.limit;
 if(!Number.isSafeInteger(limit)||limit<1||limit>MAX_RESULTS)fail("limit must be an integer from 1 to 20");
 const language=input.language??"auto";
 if(!["auto","ar","en"].includes(language))fail("language must be auto, ar, or en");
 return {query:input.query.trim(),limit,language,region:typeof input.region==="string"?input.region.trim().slice(0,80):""};
}
function normalizeResult(item,provider,retrievedAt){
 if(!item||typeof item.url!=="string"||typeof item.title!=="string")return null;
 let url;try{url=new URL(item.url);if(!["http:","https:"].includes(url.protocol))return null;}catch{return null;}
 url.hash="";
 return {url:url.toString(),title:item.title.trim().slice(0,500),snippet:typeof item.snippet==="string"?item.snippet.trim().slice(0,3000):"",publisher:typeof item.publisher==="string"?item.publisher.trim().slice(0,300):url.hostname,publishedAt:typeof item.publishedAt==="string"&&!Number.isNaN(Date.parse(item.publishedAt))?new Date(item.publishedAt).toISOString():null,retrievedAt,provider,verificationState:"search-result-unverified"};
}
/**
 * Provider-neutral boundary. A provider implementation is injected by the host.
 * No network provider or API key is selected by this module.
 */
export async function executeResearchSearch(input,{provider}={}){
 const request=validateSearchRequest(input);
 if(!provider||typeof provider.search!=="function")fail("No live search provider is configured",503);
 const retrievedAt=new Date().toISOString();
 const response=await provider.search(request);
 const raw=Array.isArray(response)?response:response?.results;
 if(!Array.isArray(raw))fail("Search provider returned an invalid response",502);
 const seen=new Set(),results=[];
 for(const item of raw){
  const normalized=normalizeResult(item,provider.id||"unidentified-provider",retrievedAt);
  if(!normalized||seen.has(normalized.url))continue;
  seen.add(normalized.url);results.push(normalized);
  if(results.length>=request.limit)break;
 }
 return {query:request.query,language:request.language,region:request.region,provider:provider.id||"unidentified-provider",retrievedAt,results,limitations:["Search results are discovery leads, not verified sources.","Open and assess each result before citing it.","No source content was fetched or independently checked."]};
}
