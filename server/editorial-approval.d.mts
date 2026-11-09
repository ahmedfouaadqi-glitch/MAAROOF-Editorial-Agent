export interface EditorialReviewInput { workspaceId:string; taskId:string; decision:"approved"|"changes-requested"|"rejected"; reviewerName:string; rationale:string }
export function buildDraftReviewText(draft:unknown):string;
export function editorialDraftFingerprint(draft:unknown):string;
export function checkEditorialDraftOriginality(state:unknown,input:{workspaceId:string;taskId:string}):Record<string,unknown>;
export function getEditorialApproval(state:unknown,workspaceId:string,taskId:string):Record<string,unknown>;
export function recordEditorialReview(state:unknown,input:EditorialReviewInput):Record<string,unknown>;
export function assertCurrentEditorialApproval(state:unknown,workspaceId:string,taskId:string):Record<string,unknown>;
