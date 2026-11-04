export interface ModelUsage { promptTokens:number|null; completionTokens:number|null; totalTokens:number|null }
export interface ModelProviderResponse { output:Record<string,unknown>; provider:string; model:string; usage:ModelUsage }
export interface OpenAICompatibleProvider { id:"openai-compatible"; model:string; generateJSON(input:{system:string;prompt:string;maxTokens?:number;temperature?:number}):Promise<ModelProviderResponse> }
export function createOpenAICompatibleProvider(options?:{baseUrl?:string;apiKey?:string;model?:string;fetchImpl?:typeof fetch;timeoutMs?:number}):OpenAICompatibleProvider|null;
