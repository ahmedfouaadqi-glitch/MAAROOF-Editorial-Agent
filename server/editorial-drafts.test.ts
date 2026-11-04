import { describe, expect, it } from "vitest";
import { buildEditorialOutline, getEditorialDraft, updateEditorialDraft } from "./editorial-drafts.mjs";

function state(){return {tasks:{task:{workspaceId:"workspace-a",article:{topic:"أثر الذكاء الاصطناعي في التعليم",language:"ar",objective:"analysis"}}},editorialDrafts:[]};}
describe("editorial draft scaffold",()=>{
 it("creates an Arabic objective-specific outline without inventing article facts",()=>{
  const db=state();const draft=buildEditorialOutline(db,{workspaceId:"workspace-a",taskId:"task",angle:"تحليل متوازن"});
  expect(draft.sections).toHaveLength(3);
  expect(draft.language).toBe("ar");
  expect(draft.status).toBe("outline");
  expect(draft.generationMode).toBe("deterministic-editorial-scaffold");
  expect(draft.sections.every(section=>section.body==="")).toBe(true);
 });
 it("persists human-authored section content and metadata",()=>{
  const db=state();const draft=buildEditorialOutline(db,{workspaceId:"workspace-a",taskId:"task"});
  const updated=updateEditorialDraft(db,{workspaceId:"workspace-a",taskId:"task",title:"عنوان المقال",metaTitle:"عنوان",metaDescription:"وصف",sections:[{id:draft.sections[0].id,body:"نص كتبه المحرر."}]});
  expect(updated.title).toBe("عنوان المقال");
  expect(updated.status).toBe("draft");
  expect(getEditorialDraft(db,"workspace-a","task").sections[0].body).toBe("نص كتبه المحرر.");
 });
 it("rejects cross-workspace access",()=>{
  const db=state();
  expect(()=>buildEditorialOutline(db,{workspaceId:"workspace-b",taskId:"task"})).toThrow("Editorial task not found");
 });
});
