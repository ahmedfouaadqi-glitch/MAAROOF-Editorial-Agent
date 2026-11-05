import { describe, expect, it } from "vitest";
import { Readable } from "node:stream";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createConversationAttachment,
  parseCsvRows,
  deleteConversationAttachment,
  extractConversationAttachmentContext,
  resolveConversationAttachmentFile
} from "./editorial-conversation-attachments.mjs";

function makeStore() {
  const state: any = {
    editorialConversations: [{ id: "conv-1", workspaceId: "workspace-1", messages: [] }],
    conversationAttachments: [], mediaAssets: []
  };
  return {
    state,
    read: async () => structuredClone(state),
    transact: async (mutator: (value: any) => unknown) => mutator(state)
  };
}
function requestFor(buffer: Buffer, mime: string, name: string) {
  const req: any = Readable.from([buffer]);
  req.headers = { "content-type": mime, "content-length": String(buffer.length), "x-file-name": encodeURIComponent(name) };
  return req;
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

  it("parses bounded CSV rows with quoted commas and escaped quotes", () => {
    const parsed = parseCsvRows('Name,Notes,Count\r\n"Brand A","A, B and ""C""",12\r\nBrand B,"Second row",8');
    const bomPrefixed = parseCsvRows("\uFEFFName,Value\nA,1");
    expect(bomPrefixed.headers).toEqual(["Name", "Value"]);
    expect(parsed.headers).toEqual(["Name", "Notes", "Count"]);
    expect(parsed.rows).toEqual([
      { Name: "Brand A", Notes: 'A, B and "C"', Count: "12" },
      { Name: "Brand B", Notes: "Second row", Count: "8" }
    ]);
    expect(() => parseCsvRows("a,b\n1,2\n3,4", { maxRows: 1 })).toThrow(/row analysis limit/);
    expect(() => parseCsvRows("a,b,c\n1,2,3", { maxColumns: 2 })).toThrow(/column analysis limit/);
    expect(() => parseCsvRows('a,b\n"unterminated,2')).toThrow(/unterminated quoted field/);
  });

  it("stores CSV locally and supplies structured rows to the conversation context", async () => {
    const mediaDir = await mkdtemp(join(tmpdir(), "editorial-chat-csv-"));
    const store = makeStore();
    try {
      const csv = Buffer.from('Keyword,Market,Volume\n"AI content strategy",Iraq,1200\nGEO audit,UAE,450', "utf8");
      const attachment = await createConversationAttachment({ req: requestFor(csv, "text/csv", "keyword-research.csv"), store, workspaceId: "workspace-1", conversationId: "conv-1", mediaDir });
      expect(attachment).toMatchObject({ kind: "document", mimeType: "text/csv", originalName: "keyword-research.csv" });
      const context = await extractConversationAttachmentContext({ store, workspaceId: "workspace-1", conversationId: "conv-1", attachmentIds: [attachment.id], mediaDir });
      expect(context.documents[0].text).toContain('"AI content strategy"');
      expect(context.documents[0].text).toContain('"Volume":"1200"');
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
