import { describe, expect, it } from "vitest";
import { createMagazineSubmission, listMagazineSubmissions, transitionMagazineSubmission } from "./magazine-submissions.mjs";

function fixture() {
  return {
    tasks: { task_1: { workspaceId: "workspace_1", article: { topic: "Test article" } } },
    magazineSubmissions: []
  };
}

describe("magazine submission workflow", () => {
  it("creates a workspace-scoped draft without sending anything externally", () => {
    const state = fixture();
    const item = createMagazineSubmission(state, {
      workspaceId: "workspace_1", taskId: "task_1", publicationId: "publication-a",
      proposedTitle: "A sourced article", pitch: "A concise editorial pitch."
    });
    expect(item.status).toBe("draft");
    expect(item.history).toHaveLength(1);
    expect(listMagazineSubmissions(state, "workspace_1", "task_1")).toHaveLength(1);
  });

  it("requires explicit approval and exclusivity confirmation before recording submission", () => {
    const state = fixture();
    const item = createMagazineSubmission(state, {
      workspaceId: "workspace_1", taskId: "task_1", publicationId: "publication-a",
      proposedTitle: "A sourced article", pitch: "A concise editorial pitch."
    });
    expect(() => transitionMagazineSubmission(state, {
      workspaceId: "workspace_1", taskId: "task_1", submissionId: item.id, nextStatus: "submitted"
    })).toThrow(/Invalid submission transition/);
    transitionMagazineSubmission(state, {
      workspaceId: "workspace_1", taskId: "task_1", submissionId: item.id, nextStatus: "approved"
    });
    expect(() => transitionMagazineSubmission(state, {
      workspaceId: "workspace_1", taskId: "task_1", submissionId: item.id, nextStatus: "submitted"
    })).toThrow(/exclusivity/);
    item.exclusivityConfirmed = true;
    const submitted = transitionMagazineSubmission(state, {
      workspaceId: "workspace_1", taskId: "task_1", submissionId: item.id, nextStatus: "submitted", note: "Sent manually by editor."
    });
    expect(submitted.submittedAt).toBeTruthy();
    expect(submitted.history.at(-1).note).toBe("Sent manually by editor.");
  });

  it("does not confuse acceptance with publication", () => {
    const state = fixture();
    const item = createMagazineSubmission(state, {
      workspaceId: "workspace_1", taskId: "task_1", publicationId: "publication-a",
      proposedTitle: "A sourced article", pitch: "A concise editorial pitch.", exclusivityConfirmed: true
    });
    for (const nextStatus of ["approved", "submitted", "accepted"]) {
      transitionMagazineSubmission(state, {
        workspaceId: "workspace_1", taskId: "task_1", submissionId: item.id, nextStatus
      });
    }
    expect(item.status).toBe("accepted");
    expect(item.publishedAt).toBeUndefined();
    transitionMagazineSubmission(state, {
      workspaceId: "workspace_1", taskId: "task_1", submissionId: item.id, nextStatus: "published"
    });
    expect(item.publishedAt).toBeTruthy();
  });

  it("rejects cross-workspace access", () => {
    const state = fixture();
    expect(() => createMagazineSubmission(state, {
      workspaceId: "other", taskId: "task_1", publicationId: "publication-a",
      proposedTitle: "A sourced article", pitch: "A concise editorial pitch."
    })).toThrow(/not found/);
  });
});
