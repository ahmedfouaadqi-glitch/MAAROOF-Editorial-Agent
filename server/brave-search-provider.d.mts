import type { ResearchSearchRequest } from "./research-provider.mjs";
export interface BraveSearchProvider { id:"brave-web-search"; search(request:ResearchSearchRequest):Promise<{results:Array<{title:string;url:string;snippet:string;publisher:string;publishedAt:string|null}>}> }
export function createBraveSearchProvider(options?:{apiKey?:string;fetchImpl?:typeof fetch;timeoutMs?:number}):BraveSearchProvider|null;
