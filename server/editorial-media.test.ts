import { describe, expect, it } from "vitest";
import { getCurrentMediaReview, recordMediaReview, assertCurrentMediaReview } from "./editorial-media.mjs";
function fixture(){return {tasks:{t:{workspaceId:"w",article:{stage:"media-review"}}},editorialDrafts:[{workspaceId:"w",taskId:"t",title:"Title",sections:[{heading:"One",body:"Body text"}]}],mediaReviews:[]};}
describe("media rights review",()=>{
 it("records an explicit no-media decision against the draft version",()=>{
  const s=fixture();recordMediaReview(s,{workspaceId:"w",taskId:"t",decision:"not-required",reviewerName:"Editor",rationale:"This article requires no embedded visual media."});
  expect(assertCurrentMediaReview(s,"w","t").approvedForCurrentDraft).toBe(true);
 });
 it("requires rights confirmation and attribution for approved media",()=>{
  const s=fixture();const asset={url:"https://example.org/photo.jpg",creator:"Photographer",license:"CC BY 4.0",attribution:"Photo by Photographer",altText:"A city skyline",rightsConfirmed:false};
  expect(()=>recordMediaReview(s,{workspaceId:"w",taskId:"t",decision:"approved",reviewerName:"Editor",rationale:"Reviewed the supplied media and rights.",assets:[asset]})).toThrow("confirmed rights");
  expect(()=>recordMediaReview(s,{workspaceId:"w",taskId:"t",decision:"approved",reviewerName:"Editor",rationale:"Reviewed the supplied media and rights.",assets:[{...asset,rightsConfirmed:true}]})).not.toThrow();
 });
 it("invalidates a review when the draft changes",()=>{
  const s=fixture();recordMediaReview(s,{workspaceId:"w",taskId:"t",decision:"not-required",reviewerName:"Editor",rationale:"No visual assets are required for this article."});
  s.editorialDrafts[0].title="Changed title";
  expect(getCurrentMediaReview(s,"w","t").approvedForCurrentDraft).toBe(false);
 });
 it("enforces stage and workspace ownership",()=>{
  const s=fixture();s.tasks.t.article.stage="drafting";
  expect(()=>recordMediaReview(s,{workspaceId:"w",taskId:"t",decision:"not-required",reviewerName:"Editor",rationale:"No media needed for this piece."})).toThrow("media-review stage");
 });
});
