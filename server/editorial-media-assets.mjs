import { randomUUID } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdir, readFile, rename, rm } from "node:fs/promises";
import { analyzeMediaAsset } from "./media-intelligence.mjs";
import { basename, isAbsolute, relative, resolve } from "node:path";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";

const MIME_PROFILES = {
  "image/jpeg": { kind: "image", extension: ".jpg", maxBytes: 15 * 1024 * 1024, matches: bytes => bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff },
  "image/png": { kind: "image", extension: ".png", maxBytes: 15 * 1024 * 1024, matches: bytes => bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  "image/webp": { kind: "image", extension: ".webp", maxBytes: 15 * 1024 * 1024, matches: bytes => bytes.length >= 12 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP" },
  "video/mp4": { kind: "video", extension: ".mp4", maxBytes: 100 * 1024 * 1024, matches: bytes => bytes.length >= 12 && bytes.toString("ascii", 4, 8) === "ftyp" },
  "video/webm": { kind: "video", extension: ".webm", maxBytes: 100 * 1024 * 1024, matches: bytes => bytes.length >= 4 && bytes.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3])) }
};
const MAX_TOTAL_MEDIA_BYTES = 1024 * 1024 * 1024;

function fail(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

function header(req, name) {
  const value = req.headers?.[name.toLowerCase()];
  return typeof value === "string" ? value : "";
}

function decodeHeader(value, field) {
  try { return decodeURIComponent(value); }
  catch { fail(`${field} must be URL-encoded UTF-8`); }
}

function safeDisplayName(value) {
  const input = basename(value).replace(/[\\/]/g, "_").replace(/[\u0000-\u001f\u007f]/g, "").trim();
  return (input || "uploaded-media").slice(0, 180);
}

function ownedTask(state, workspaceId, taskId) {
  const task = state.tasks?.[taskId];
  if (!task || task.workspaceId !== workspaceId || !task.article) fail("Editorial task not found", 404);
  return task;
}

function ownedAsset(state, workspaceId, taskId, assetId) {
  const item = (state.mediaAssets || []).find(asset => asset.id === assetId && asset.workspaceId === workspaceId && asset.taskId === taskId);
  if (!item) fail("Media asset not found in this workspace and article", 404);
  return item;
}

export async function createMediaAsset({ req, store, workspaceId, taskId, mediaDir }) {
  const state = await store.read();
  ownedTask(state, workspaceId, taskId);
  const storedBytes = (state.mediaAssets || []).reduce((sum, asset) => sum + (Number.isSafeInteger(asset.sizeBytes) ? asset.sizeBytes : 0), 0);
  if (storedBytes >= MAX_TOTAL_MEDIA_BYTES) fail("Local media storage quota is full", 413);
  const mimeType = header(req, "content-type").split(";")[0].trim().toLowerCase();
  const profile = MIME_PROFILES[mimeType];
  if (!profile) fail("Only JPEG, PNG, WebP, MP4, and WebM files are supported", 415);
  const description = decodeHeader(header(req, "x-media-description"), "Media description").trim();
  if (description.length < 3 || description.length > 800) fail("A media description of 3-800 characters is required", 400);
  const encodedName = header(req, "x-file-name");
  const originalName = safeDisplayName(encodedName ? decodeHeader(encodedName, "Filename") : "uploaded-media");
  const lengthHeader = header(req, "content-length");
  if (lengthHeader) {
    const length = Number(lengthHeader);
    if (!Number.isSafeInteger(length) || length < 1) fail("Content-Length must be a positive integer", 400);
    if (length > profile.maxBytes) fail("Media file exceeds the size limit for its type", 413);
  }

  const id = randomUUID();
  const root = resolve(mediaDir);
  await mkdir(root, { recursive: true, mode: 0o700 });
  const temporaryPath = resolve(root, `${id}.uploading`);
  const storageKey = `${id}${profile.extension}`;
  const finalPath = resolve(root, storageKey);
  let bytesWritten = 0;
  let prefix = Buffer.alloc(0);
  const sizeGuard = new Transform({
    transform(chunk, encoding, callback) {
      bytesWritten += chunk.length;
      if (bytesWritten > profile.maxBytes) {
        callback(Object.assign(new Error("Media file exceeds the size limit for its type"), { status: 413 }));
        return;
      }
      if (prefix.length < 16) prefix = Buffer.concat([prefix, chunk.subarray(0, 16 - prefix.length)]);
      callback(null, chunk);
    }
  });

  try {
    await pipeline(req, sizeGuard, createWriteStream(temporaryPath, { flags: "wx", mode: 0o600 }));
    if (!profile.matches(prefix)) fail("File signature does not match the declared media type", 415);
    if (bytesWritten < 1) fail("Media file is empty", 400);
    if (storedBytes + bytesWritten > MAX_TOTAL_MEDIA_BYTES) fail("Local media storage quota would be exceeded", 413);
    await rename(temporaryPath, finalPath);
    const fileBytes = await readFile(finalPath);
    const intelligence = analyzeMediaAsset({ bytes: fileBytes, mimeType, kind: profile.kind, description });
    const asset = {
      id,
      workspaceId,
      taskId,
      kind: profile.kind,
      mimeType,
      sizeBytes: bytesWritten,
      originalName,
      description,
      intelligence,
      altText: profile.kind === "image" ? description : "",
      caption: profile.kind === "video" ? description : "",
      storageKey,
      createdAt: new Date().toISOString()
    };
    try {
      return await store.transact(current => {
        ownedTask(current, workspaceId, taskId);
        const currentBytes = (current.mediaAssets || []).reduce((sum, item) => sum + (Number.isSafeInteger(item.sizeBytes) ? item.sizeBytes : 0), 0);
        if (currentBytes + bytesWritten > MAX_TOTAL_MEDIA_BYTES) fail("Local media storage quota would be exceeded", 413);
        current.mediaAssets ||= [];
        current.mediaAssets.push(asset);
        return structuredClone(asset);
      });
    } catch (error) {
      await rm(finalPath, { force: true });
      throw error;
    }
  } catch (error) {
    await rm(temporaryPath, { force: true }).catch(() => {});
    if (error?.status) throw error;
    if (error?.code === "EEXIST") fail("A temporary media file already exists; retry the upload", 409);
    throw error;
  }
}

export function listMediaAssets(state, workspaceId, taskId) {
  ownedTask(state, workspaceId, taskId);
  return (state.mediaAssets || []).filter(asset => asset.workspaceId === workspaceId && asset.taskId === taskId);
}

export async function resolveMediaAssetFile({ store, workspaceId, taskId, assetId, mediaDir }) {
  const state = await store.read();
  ownedTask(state, workspaceId, taskId);
  const asset = ownedAsset(state, workspaceId, taskId, assetId);
  const root = resolve(mediaDir);
  const filePath = resolve(root, asset.storageKey);
  const rel = relative(root, filePath);
  if (!rel || rel.startsWith("..") || isAbsolute(rel)) fail("Media asset not found", 404);
  return { asset, filePath };
}

export async function deleteMediaAsset({ store, workspaceId, taskId, assetId, mediaDir }) {
  const removed = await store.transact(state => {
    ownedTask(state, workspaceId, taskId);
    const asset = ownedAsset(state, workspaceId, taskId, assetId);
    state.mediaAssets = (state.mediaAssets || []).filter(item => item.id !== assetId || item.workspaceId !== workspaceId || item.taskId !== taskId);
    return structuredClone(asset);
  });
  const root = resolve(mediaDir);
  const filePath = resolve(root, removed.storageKey);
  const rel = relative(root, filePath);
  if (!rel || rel.startsWith("..") || isAbsolute(rel)) fail("Media asset path is invalid", 500);
  await rm(filePath, { force: true });
  return { id: removed.id, deleted: true };
}
