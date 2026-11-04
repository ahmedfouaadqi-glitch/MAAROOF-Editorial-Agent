export interface EditorialReviewInput { workspaceId:string; taskId:string; decision:"approved"|"changes-requested"|"rejected"; reviewerName:string; rationale:string }
export function buildDraftReviewText(draft:any):string;
export function editorialDraftFingerprint(draft:any):string;
export function checkEditorialDraftOriginality(state:any,input:{workspaceId:string;taskId:string}):Record<string,unknown>;
export function getEditorialApproval(state:any,workspaceId:string,taskId:string):Record<string,any>;
export function recordEditorialReview(state:any,input:EditorialReviewInput):Record<string,any>;
export function assertCurrentEditorialApproval(state:any,workspaceId:string,taskId:string):Record<string,any>;
