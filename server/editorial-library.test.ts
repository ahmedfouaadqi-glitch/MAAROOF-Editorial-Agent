import { describe, expect, it } from "vitest";
import { listEditorialLibraryItems } from "./editorial-library.mjs";

describe("editorial library", () => {
  it("lists saved drafts with their request and identity context in reverse chronological order", () => {
    const state = {
      editorialConversations: [{
        id: "conversation-1", workspaceId: "workspace-1", title: "Draft conversation",
        targetId: "linkedin", targetName: "LinkedIn", language: "en", clientName: "Client A", brandName: "Brand A",
        messages: [
          { id: "request-1", role: "user", content: "Write a post about AI.", createdAt: "2026-11-01T10:00:00.000Z" },
          { id: "answer-1", role: "assistant", content: "Draft body", createdAt: "2026-11-01T10:01:00.000Z" }
        ]
      }],
      conversationDrafts: [
        { id: "draft-old", workspaceId: "workspace-1", conversationId: "conversation-1", messageId: "answer-1", title: "Older", body: "Old body", createdAt: "2026-11-01T10:01:00.000Z" },
        { id: "draft-new", workspaceId: "workspace-1", conversationId: "conversation-1", messageId: "answer-1", title: "Newer", body: "New body", createdAt: "2026-11-02T10:01:00.000Z" },
        { id: "draft-other", workspaceId: "workspace-2", conversationId: "conversation-2", messageId: "answer-2", title: "Other workspace", createdAt: "2026-11-03T10:00:00.000Z" },
        { id: "draft-orphan", workspaceId: "workspace-1", conversationId: "missing", title: "Orphan", createdAt: "2026-11-04T10:00:00.000Z" }
      ]
    };
    const items = listEditorialLibraryItems(state, "workspace-1");
    expect(items.map(item => item.id)).toEqual(["draft-new", "draft-old"]);
    expect(items[0]).toMatchObject({
      title: "Newer", targetId: "linkedin", targetName: "LinkedIn",
      clientName: "Client A", brandName: "Brand A", request: "Write a post about AI."
    });
  });

  it("rejects an empty workspace id", () => {
    expect(() => listEditorialLibraryItems({}, "")).toThrow("workspaceId must contain 1-128 characters");
  });
});
