import { describe, expect, it } from "vitest";
import { Readable } from "node:stream";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createConversationAttachment,
  deleteConversationAttachment,
  extractConversationAttachmentContext,
  resolveConversationAttachmentFile,
  validateDocxArchiveLimits
} from "./editorial-conversation-attachments.mjs";

type AttachmentState = { editorialConversations: { id: string; workspaceId: string; messages: unknown[] }[]; conversationAttachments: unknown[]; mediaAssets: unknown[] };
function makeStore() {
  const state: AttachmentState = {
    editorialConversations: [{ id: "conv-1", workspaceId: "workspace-1", messages: [] }],
    conversationAttachments: [], mediaAssets: []
  };
  return {
    state,
    read: async () => structuredClone(state),
    transact: async (mutator: (value: AttachmentState) => unknown) => mutator(state)
  };
}
function requestFor(buffer: Buffer, mime: string, name: string) {
  const req = Readable.from([buffer]) as Readable & { headers: Record<string, string> };
  req.headers = { "content-type": mime, "content-length": String(buffer.length), "x-file-name": encodeURIComponent(name) };
  return req;
}
function centralDirectoryFixture({ entryName = "word/document.xml", uncompressedBytes = 1024 } = {}) {
  const name = Buffer.from(entryName, "utf8");
  const local = Buffer.alloc(30 + name.length);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(name.length, 26);
  name.copy(local, 30);
  const central = Buffer.alloc(46 + name.length);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(20, 4);
  central.writeUInt16LE(20, 6);
  central.writeUInt32LE(1, 20);
  central.writeUInt32LE(uncompressedBytes, 24);
  central.writeUInt16LE(name.length, 28);
  name.copy(central, 46);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(1, 8);
  eocd.writeUInt16LE(1, 10);
  eocd.writeUInt32LE(central.length, 12);
  eocd.writeUInt32LE(local.length, 16);
  return Buffer.concat([local, central, eocd]);
}

describe("conversation attachments", () => {
  it("stores TXT locally, scopes it to a conversation and extracts bounded text", async () => {
    const mediaDir = await mkdtemp(join(tmpdir(), "editorial-chat-"));
    const store = makeStore();
    try {
      const text = Buffer.from("Editorial brief: write a clear bilingual announcement with a helpful explanation.", "utf8");
      const attachment = await createConversationAttachment({ req: requestFor(text, "text/plain", "brief.txt"), store, workspaceId: "workspace-1", conversationId: "conv-1", mediaDir });
      expect(attachment).toMatchObject({ kind: "document", mimeType: "text/plain", originalName: "brief.txt", sizeBytes: text.length });
      const context = await extractConversationAttachmentContext({ store, workspaceId: "workspace-1", conversationId: "conv-1", attachmentIds: [attachment.id], mediaDir });
      expect(context.documents).toMatchObject([{ name: "brief.txt", text: "Editorial brief: write a clear bilingual announcement with a helpful explanation." }]);
      expect(context.images).toHaveLength(0);
      const resolved = await resolveConversationAttachmentFile({ store, workspaceId: "workspace-1", conversationId: "conv-1", attachmentId: attachment.id, mediaDir });
      expect(await readFile(resolved.filePath)).toEqual(text);
      await expect(resolveConversationAttachmentFile({ store, workspaceId: "workspace-other", conversationId: "conv-1", attachmentId: attachment.id, mediaDir })).rejects.toMatchObject({ status: 404 });
      expect(await deleteConversationAttachment({ store, workspaceId: "workspace-1", conversationId: "conv-1", attachmentId: attachment.id, mediaDir })).toMatchObject({ id: attachment.id, deleted: true });
    } finally { await rm(mediaDir, { recursive: true, force: true }); }
  });

  it("rejects MIME spoofing and DOCX files without the required extension", async () => {
    const mediaDir = await mkdtemp(join(tmpdir(), "editorial-chat-"));
    const store = makeStore();
    try {
      await expect(createConversationAttachment({ req: requestFor(Buffer.from("not a jpeg"), "image/jpeg", "fake.jpg"), store, workspaceId: "workspace-1", conversationId: "conv-1", mediaDir })).rejects.toMatchObject({ status: 415 });
      await expect(createConversationAttachment({ req: requestFor(Buffer.from([0x50, 0x4b, 0x03, 0x04]), "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "word.doc"), store, workspaceId: "workspace-1", conversationId: "conv-1", mediaDir })).rejects.toMatchObject({ status: 415 });
      expect(store.state.conversationAttachments).toHaveLength(0);
    } finally { await rm(mediaDir, { recursive: true, force: true }); }
  });

  it("bounds DOCX central-directory expansion and rejects traversal paths", () => {
    expect(validateDocxArchiveLimits(centralDirectoryFixture())).toMatchObject({ entryCount: 1, expandedBytes: 1024 });
    expect(() => validateDocxArchiveLimits(centralDirectoryFixture({ uncompressedBytes: 26 * 1024 * 1024 }))).toThrow(/oversized/i);
    expect(() => validateDocxArchiveLimits(centralDirectoryFixture({ entryName: "../outside.xml" }))).toThrow(/unsafe archive path/i);
    expect(() => validateDocxArchiveLimits(Buffer.from("PK0304 malformed"))).toThrow(/malformed/i);
  });

  it("stores visual attachments and prepares image context without exposing storage keys", async () => {
    const mediaDir = await mkdtemp(join(tmpdir(), "editorial-chat-"));
    const store = makeStore();
    try {
      const bytes = Buffer.from([0xff, 0xd8, 0xff, 0x00, 0x01]);
      const attachment = await createConversationAttachment({ req: requestFor(bytes, "image/jpeg", "campaign.jpg"), store, workspaceId: "workspace-1", conversationId: "conv-1", mediaDir });
      expect(attachment).not.toHaveProperty("storageKey");
      const context = await extractConversationAttachmentContext({ store, workspaceId: "workspace-1", conversationId: "conv-1", attachmentIds: [attachment.id], mediaDir });
      expect(context.images).toMatchObject([{ mimeType: "image/jpeg", label: "campaign.jpg" }]);
      expect(context.images[0].data).toEqual(bytes);
    } finally { await rm(mediaDir, { recursive: true, force: true }); }
  });
});
