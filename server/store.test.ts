import { describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { JsonStore, migrateLegacyWorkspaceOwnership } from "./store.mjs";

describe("legacy workspace ownership migration", () => {
  it("assigns unscoped legacy conversations and their uniquely linked attachments to the default workspace", () => {
    const state = {
      editorialConversations: [
        { id: "legacy-1", messages: [] },
        { id: "already-scoped", workspaceId: "client-workspace", messages: [] }
      ],
      conversationAttachments: [
        { id: "asset-1", conversationId: "legacy-1" },
        { id: "asset-2", conversationId: "already-scoped" },
        { id: "orphan-asset", conversationId: "missing-conversation" },
        { id: "already-scoped-asset", workspaceId: "other-workspace", conversationId: "legacy-1" }
      ]
    };

    expect(migrateLegacyWorkspaceOwnership(state)).toEqual({
      migratedConversations: 1,
      migratedAttachments: 1
    });
    expect(state.editorialConversations[0].workspaceId).toBe("main-workspace");
    expect(state.editorialConversations[1].workspaceId).toBe("client-workspace");
    expect(state.conversationAttachments[0].workspaceId).toBe("main-workspace");
    expect(state.conversationAttachments[1].workspaceId).toBeUndefined();
    expect(state.conversationAttachments[2].workspaceId).toBeUndefined();
    expect(state.conversationAttachments[3].workspaceId).toBe("other-workspace");
  });

  it("does not guess ownership when legacy conversation IDs are ambiguous", () => {
    const state = {
      editorialConversations: [{ id: "duplicate" }, { id: "duplicate", workspaceId: "client-b" }],
      conversationAttachments: [{ id: "asset", conversationId: "duplicate" }]
    };
    migrateLegacyWorkspaceOwnership(state);
    expect(state.conversationAttachments[0].workspaceId).toBeUndefined();
  });

  it("persists the migration once during store initialization and remains idempotent", async () => {
    const directory = await mkdtemp(join(tmpdir(), "maaroof-store-"));
    const filePath = join(directory, "legacy.json");
    try {
      await writeFile(filePath, JSON.stringify({
        editorialConversations: [{ id: "legacy-2", messages: [] }],
        conversationAttachments: [{ id: "asset-2", conversationId: "legacy-2" }]
      }));
      const store = new JsonStore(filePath);
      await store.init();
      const migrated = JSON.parse(await readFile(filePath, "utf8"));
      expect(migrated.editorialConversations[0].workspaceId).toBe("main-workspace");
      expect(migrated.conversationAttachments[0].workspaceId).toBe("main-workspace");
      const before = await readFile(filePath, "utf8");
      await store.init();
      expect(await readFile(filePath, "utf8")).toBe(before);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
