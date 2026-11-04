import { afterEach, describe, expect, it, vi } from "vitest";
import { Readable } from "node:stream";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createMediaAsset, deleteMediaAsset, listMediaAssets, resolveMediaAssetFile } from "./editorial-media-assets.mjs";

const roots: string[] = [];
async function newRoot() {
  const root = await mkdtemp(join(tmpdir(), "editorial-media-test-"));
  roots.push(root);
  return root;
}
afterEach(async () => { await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true }))); });

function initialState() {
  return { tasks: { taskA: { workspaceId: "workspaceA", article: { topic: "Solar", language: "en" } } }, mediaAssets: [] as any[] };
}
function makeStore(state = initialState()) {
  return {
    state,
    read: vi.fn(async () => structuredClone(state)),
    transact: vi.fn(async (mutator: (value: typeof state) => unknown) => mutator(state))
  };
}
function request(body: Buffer, mime = "image/png", overrides: Record<string, string> = {}) {
  const stream = Readable.from([body]) as Readable & { headers: Record<string, string> };
  stream.headers = {
    "content-type": mime,
    "content-length": String(body.length),
    "x-file-name": encodeURIComponent("campaign-art.png"),
    "x-media-description": encodeURIComponent("Solar panels on a community school roof"),
    ...overrides
  };
  return stream;
}
const validPng = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

describe("editorial media assets", () => {
  it("streams a supported image, stores private metadata and scopes it to the article", async () => {
    const mediaDir = await newRoot();
    const store = makeStore();
    const asset = await createMediaAsset({ req: request(validPng), store, workspaceId: "workspaceA", taskId: "taskA", mediaDir });
    expect(asset).toMatchObject({ kind: "image", mimeType: "image/png", sizeBytes: validPng.length, altText: "Solar panels on a community school roof" });
    expect((await readFile(join(mediaDir, asset.storageKey))).equals(validPng)).toBe(true);
    expect(listMediaAssets(store.state, "workspaceA", "taskA")).toHaveLength(1);
    await expect(Promise.resolve().then(() => listMediaAssets(store.state, "workspaceB", "taskA"))).rejects.toMatchObject({ status: 404 });
  });

  it("accepts a supported WebM video and records its contextual caption", async () => {
    const mediaDir = await newRoot();
    const store = makeStore();
    const video = Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0, 0, 0]);
    const req = request(video, "video/webm", {
      "x-file-name": encodeURIComponent("campaign-cut.webm"),
      "x-media-description": encodeURIComponent("Vertical video showing the installation sequence on a school roof")
    });
    const asset = await createMediaAsset({ req, store, workspaceId: "workspaceA", taskId: "taskA", mediaDir });
    expect(asset).toMatchObject({ kind: "video", mimeType: "video/webm", caption: "Vertical video showing the installation sequence on a school roof", altText: "" });
  });

  it("rejects a MIME/signature mismatch and unsupported media types", async () => {
    const mediaDir = await newRoot();
    const store = makeStore();
    await expect(createMediaAsset({ req: request(Buffer.from("not a png")), store, workspaceId: "workspaceA", taskId: "taskA", mediaDir })).rejects.toMatchObject({ status: 415 });
    await expect(createMediaAsset({ req: request(validPng, "image/svg+xml"), store, workspaceId: "workspaceA", taskId: "taskA", mediaDir })).rejects.toMatchObject({ status: 415 });
    expect(store.state.mediaAssets).toHaveLength(0);
  });

  it("rejects uploads exceeding the declared type limit before writing", async () => {
    const mediaDir = await newRoot();
    const store = makeStore();
    const req = request(validPng, "image/png", { "content-length": String(16 * 1024 * 1024) });
    await expect(createMediaAsset({ req, store, workspaceId: "workspaceA", taskId: "taskA", mediaDir })).rejects.toMatchObject({ status: 413 });
    expect(store.state.mediaAssets).toHaveLength(0);
  });

  it("requires a real workspace-owned task and a contextual description", async () => {
    const mediaDir = await newRoot();
    const store = makeStore();
    const shortDescription = request(validPng, "image/png", { "x-media-description": encodeURIComponent("x") });
    await expect(createMediaAsset({ req: shortDescription, store, workspaceId: "workspaceA", taskId: "missing", mediaDir })).rejects.toMatchObject({ status: 404 });
    await expect(createMediaAsset({ req: shortDescription, store, workspaceId: "workspaceA", taskId: "taskA", mediaDir })).rejects.toMatchObject({ status: 400 });
  });

  it("serves and deletes files only through workspace- and article-scoped lookups", async () => {
    const mediaDir = await newRoot();
    const store = makeStore();
    const asset = await createMediaAsset({ req: request(validPng), store, workspaceId: "workspaceA", taskId: "taskA", mediaDir });
    const resolved = await resolveMediaAssetFile({ store, workspaceId: "workspaceA", taskId: "taskA", assetId: asset.id, mediaDir });
    expect((await stat(resolved.filePath)).isFile()).toBe(true);
    await expect(resolveMediaAssetFile({ store, workspaceId: "workspaceB", taskId: "taskA", assetId: asset.id, mediaDir })).rejects.toMatchObject({ status: 404 });
    expect(await deleteMediaAsset({ store, workspaceId: "workspaceA", taskId: "taskA", assetId: asset.id, mediaDir })).toEqual({ id: asset.id, deleted: true });
    await expect(stat(resolved.filePath)).rejects.toMatchObject({ code: "ENOENT" });
    expect(store.state.mediaAssets).toHaveLength(0);
  });
});
