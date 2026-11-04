export interface MediaAssetReview { url:string; creator:string; license:string; attribution:string; altText:string; rightsConfirmed:boolean }
export interface MediaReviewInput { workspaceId:string; taskId:string; decision:"approved"|"not-required"|"changes-requested"; reviewerName:string; rationale:string; assets?:MediaAssetReview[] }
export function recordMediaReview(state:any,input:MediaReviewInput):Record<string,any>;
export function getCurrentMediaReview(state:any,workspaceId:string,taskId:string):Record<string,any>;
export function assertCurrentMediaReview(state:any,workspaceId:string,taskId:string):Record<string,any>;
