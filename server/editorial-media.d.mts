export interface MediaAssetReview { url:string; creator:string; license:string; attribution:string; altText:string; rightsConfirmed:boolean }
export interface MediaReviewInput { workspaceId:string; taskId:string; decision:"approved"|"not-required"|"changes-requested"; reviewerName:string; rationale:string; assets?:MediaAssetReview[] }
export function recordMediaReview(state:unknown,input:MediaReviewInput):Record<string,unknown>;
export function getCurrentMediaReview(state:unknown,workspaceId:string,taskId:string):Record<string,unknown>;
export function assertCurrentMediaReview(state:unknown,workspaceId:string,taskId:string):Record<string,unknown>;
