import type { OpenAICompatibleProvider } from "./model-provider.mjs";
export interface EditorialDraftGenerationResult { draft:any; usage:any; provider:{provider:string;model:string}; limitations:string[] }
export function runEditorialDraftGeneration(input:{store:{read():Promise<any>;transact<T>(mutator:(state:any)=>T|Promise<T>):Promise<T>};provider:OpenAICompatibleProvider|null;workspaceId:string;taskId:string;maxTokens?:number;maxRequests?:number}):Promise<EditorialDraftGenerationResult>;
