import type { OpenAICompatibleProvider } from "./model-provider.mjs";
export interface EditorialDraftGenerationResult { draft:unknown; usage:unknown; provider:{provider:string;model:string}; limitations:string[] }
export function runEditorialDraftGeneration(input:{store:{read():Promise<unknown>;transact<T>(mutator:(state:unknown)=>T|Promise<T>):Promise<T>};provider:OpenAICompatibleProvider|null;workspaceId:string;taskId:string;maxTokens?:number;maxRequests?:number}):Promise<EditorialDraftGenerationResult>;
