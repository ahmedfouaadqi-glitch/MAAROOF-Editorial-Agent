export interface ResearchSearchRequest { query:string; limit:number; language:"auto"|"ar"|"en"; country:string }
export interface SearchResult { url:string; title:string; snippet:string; publisher:string; publishedAt:string|null; retrievedAt:string; provider:string; verificationState:"search-result-unverified" }
export interface ResearchSearchResult { query:string; language:string; country:string; provider:string; retrievedAt:string; results:SearchResult[]; limitations:string[] }
export function validateSearchRequest(input:unknown):ResearchSearchRequest;
export function executeResearchSearch(input:unknown,options:{provider:{id?:string;search(request:ResearchSearchRequest):Promise<unknown>}}):Promise<ResearchSearchResult>;
