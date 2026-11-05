import { randomUUID } from "node:crypto";
import { execFile as execFileCallback } from "node:child_process";
import { createWriteStream } from "node:fs";
import { mkdir, readFile, rename, rm } from "node:fs/promises";
import { basename, isAbsolute, relative, resolve } from "node:path";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { promisify } from "node:util";
import pdfParse from "pdf-parse/lib/pdf-parse.js";
import mammoth from "mammoth";

const execFile = promisify(execFileCallback);
const MAX_TOTAL_BYTES = 1024 * 1024 * 1024;
const MAX_DOCUMENT_TEXT = 24_000;
const MAX_INLINE_IMAGE_BYTES = 10 * 1024 * 1024;
const MIME_PROFILES = {
  "image/jpeg": { kind: "image", extension: ".jpg", maxBytes: 15 * 1024 * 1024, matches: bytes => bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff },
  "image/png": { kind: "image", extension: ".png", maxBytes: 15 * 1024 * 1024, matches: bytes => bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  "image/webp": { kind: "image", extension: ".webp", maxBytes: 15 * 1024 * 1024, matches: bytes => bytes.length >= 12 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP" },
  "video/mp4": { kind: "video", extension: ".mp4", maxBytes: 100 * 1024 * 1024, matches: bytes => bytes.length >= 12 && bytes.toString("ascii", 4, 8) === "ftyp" },
  "video/webm": { kind: "video", extension: ".webm", maxBytes: 100 * 1024 * 1024, matches: bytes => bytes.length >= 4 && bytes.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3])) },
  "application/pdf": { kind: "document", extension: ".pdf", maxBytes: 25 * 1024 * 1024, matches: bytes => bytes.length >= 5 && bytes.toString("ascii", 0, 5) === "%PDF-" },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": { kind: "document", extension: ".docx", maxBytes: 25 * 1024 * 1024, matches: bytes => bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04 },
  "text/plain": { kind: "document", extension: ".txt", maxBytes: 5 * 1024 * 1024, matches: bytes => bytes.length > 0 && !bytes.subarray(0, Math.min(bytes.length, 4096)).includes(0) },
  "text/markdown": { kind: "document", extension: ".txt", maxBytes: 5 * 1024 * 1024, matches: bytes => bytes.length > 0 && !bytes.subarray(0, Math.min(bytes.length, 4096)).includes(0) },
  "text/csv": { kind: "document", extension: ".csv", maxBytes: 10 * 1024 * 1024, matches: bytes => bytes.length > 0 && !bytes.subarray(0, Math.min(bytes.length, 4096)).includes(0) }
};

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
  return (input || "uploaded-file").slice(0, 180);
}
function ownedConversation(state, workspaceId, conversationId) {
  const conversation = (state.editorialConversations || []).find(item => item.id === conversationId && item.workspaceId === workspaceId);
  if (!conversation) fail("Editorial conversation not found", 404);
  return conversation;
}
function ownedAttachment(state, workspaceId, conversationId, attachmentId) {
  const asset = (state.conversationAttachments || []).find(item => item.id === attachmentId && item.workspaceId === workspaceId && item.conversationId === conversationId);
  if (!asset) fail("Attachment not found in this conversation", 404);
  return asset;
}
function publicAsset({ storageKey: _storageKey, ...asset }) { return structuredClone(asset); }

export async function createConversationAttachment({ req, store, workspaceId, conversationId, mediaDir }) {
  const state = await store.read();
  ownedConversation(state, workspaceId, conversationId);
  const storedBytes = [...(state.mediaAssets || []), ...(state.conversationAttachments || [])].reduce((sum, asset) => sum + (Number.isSafeInteger(asset.sizeBytes) ? asset.sizeBytes : 0), 0);
  if (storedBytes >= MAX_TOTAL_BYTES) fail("Local media storage quota is full", 413);
  const mimeType = header(req, "content-type").split(";")[0].trim().toLowerCase();
  const profile = MIME_PROFILES[mimeType];
  if (!profile) fail("Supported files: JPEG, PNG, WebP, MP4, WebM, PDF, DOCX, and TXT", 415);
  const descriptionHeader = header(req, "x-media-description");
  const description = descriptionHeader ? decodeHeader(descriptionHeader, "File description").trim() : "";
  if (description.length > 800) fail("File description must be at most 800 characters");
  const encodedName = header(req, "x-file-name");
  const originalName = safeDisplayName(encodedName ? decodeHeader(encodedName, "Filename") : "uploaded-file");
  if (profile.extension === ".docx" && !originalName.toLowerCase().endsWith(".docx")) fail("The uploaded Word file must use the .docx extension", 415);
  if (profile.extension === ".pdf" && !originalName.toLowerCase().endsWith(".pdf")) fail("The uploaded PDF file must use the .pdf extension", 415);
  if (profile.extension === ".txt" && !/\.(txt|md)$/i.test(originalName)) fail("Text files must use .txt or .md", 415);
  if (profile.extension === ".csv" && !originalName.toLowerCase().endsWith(".csv")) fail("CSV files must use the .csv extension", 415);
  const lengthHeader = header(req, "content-length");
  if (lengthHeader) {
    const length = Number(lengthHeader);
    if (!Number.isSafeInteger(length) || length < 1) fail("Content-Length must be a positive integer", 400);
    if (length > profile.maxBytes) fail("File exceeds the size limit for its type", 413);
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
      if (bytesWritten > profile.maxBytes) return callback(Object.assign(new Error("File exceeds the size limit for its type"), { status: 413 }));
      if (prefix.length < 32) prefix = Buffer.concat([prefix, chunk.subarray(0, 32 - prefix.length)]);
      callback(null, chunk);
    }
  });

  try {
    await pipeline(req, sizeGuard, createWriteStream(temporaryPath, { flags: "wx", mode: 0o600 }));
    if (bytesWritten < 1) fail("File is empty", 400);
    if (!profile.matches(prefix)) fail("File signature does not match the declared type", 415);
    if (storedBytes + bytesWritten > MAX_TOTAL_BYTES) fail("Local media storage quota would be exceeded", 413);
    await rename(temporaryPath, finalPath);
    const asset = {
      id, workspaceId, conversationId, kind: profile.kind, mimeType,
      sizeBytes: bytesWritten, originalName, description, storageKey,
      createdAt: new Date().toISOString()
    };
    try {
      const saved = await store.transact(current => {
        ownedConversation(current, workspaceId, conversationId);
        const currentBytes = [...(current.mediaAssets || []), ...(current.conversationAttachments || [])].reduce((sum, item) => sum + (Number.isSafeInteger(item.sizeBytes) ? item.sizeBytes : 0), 0);
        if (currentBytes + bytesWritten > MAX_TOTAL_BYTES) fail("Local media storage quota would be exceeded", 413);
        current.conversationAttachments ||= [];
        current.conversationAttachments.push(asset);
        return publicAsset(asset);
      });
      return saved;
    } catch (error) {
      await rm(finalPath, { force: true });
      throw error;
    }
  } catch (error) {
    await rm(temporaryPath, { force: true }).catch(() => {});
    if (error?.status) throw error;
    if (error?.code === "EEXIST") fail("A temporary upload already exists; retry the upload", 409);
    throw error;
  }
}

export async function listConversationAttachments(store, workspaceId, conversationId) {
  const state = await store.read();
  ownedConversation(state, workspaceId, conversationId);
  return (state.conversationAttachments || []).filter(item => item.workspaceId === workspaceId && item.conversationId === conversationId).map(publicAsset);
}

export async function resolveConversationAttachmentFile({ store, workspaceId, conversationId, attachmentId, mediaDir }) {
  const state = await store.read();
  ownedConversation(state, workspaceId, conversationId);
  const asset = ownedAttachment(state, workspaceId, conversationId, attachmentId);
  const root = resolve(mediaDir);
  const filePath = resolve(root, asset.storageKey);
  const rel = relative(root, filePath);
  if (!rel || rel.startsWith("..") || isAbsolute(rel)) fail("Attachment not found", 404);
  return { asset: publicAsset(asset), filePath };
}

export async function deleteConversationAttachment({ store, workspaceId, conversationId, attachmentId, mediaDir }) {
  const removed = await store.transact(state => {
    ownedConversation(state, workspaceId, conversationId);
    const asset = ownedAttachment(state, workspaceId, conversationId, attachmentId);
    state.conversationAttachments = (state.conversationAttachments || []).filter(item => item.id !== attachmentId || item.workspaceId !== workspaceId || item.conversationId !== conversationId);
    for (const message of (state.editorialConversations || []).find(item => item.id === conversationId && item.workspaceId === workspaceId).messages) {
      message.attachmentIds = (message.attachmentIds || []).filter(id => id !== attachmentId);
    }
    return asset;
  });
  const root = resolve(mediaDir);
  const filePath = resolve(root, removed.storageKey);
  const rel = relative(root, filePath);
  if (!rel || rel.startsWith("..") || isAbsolute(rel)) fail("Attachment path is invalid", 500);
  await rm(filePath, { force: true });
  return { id: removed.id, deleted: true };
}

export function parseCsvRows(input, { maxRows = 200, maxColumns = 40, maxCellChars = 4000 } = {}) {
  if (typeof input !== "string") fail("CSV content must be text");
  const rows = [];
  let row = [], cell = "", quoted = false;
  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    if (quoted) {
      if (char === '"' && input[index + 1] === '"') { cell += '"'; index += 1; }
      else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"' && cell.length === 0) quoted = true;
    else if (char === ",") { row.push(cell.slice(0, maxCellChars)); cell = ""; }
    else if (char === "\n" || char === "\r") {
      if (char === "\r" && input[index + 1] === "\n") index += 1;
      row.push(cell.slice(0, maxCellChars)); cell = "";
      if (row.some(value => value.trim())) rows.push(row);
      row = [];
      if (rows.length > maxRows) fail(`CSV exceeds the ${maxRows}-row analysis limit`, 413);
    } else cell += char;
    if (row.length >= maxColumns) fail(`CSV exceeds the ${maxColumns}-column analysis limit`, 413);
  }
  if (quoted) fail("CSV contains an unterminated quoted field");
  if (cell.length || row.length) { row.push(cell.slice(0, maxCellChars)); if (row.some(value => value.trim())) rows.push(row); }
  if (rows.length > maxRows) fail(`CSV exceeds the ${maxRows}-row analysis limit`, 413);
  if (!rows.length) return { headers: [], rows: [] };
  const rawHeaders = rows[0].slice(0, maxColumns);
  const headers = rawHeaders.map((value, index) => {
    const base = value.trim().slice(0, 120) || `Column ${index + 1}`;
    const duplicateCount = rawHeaders.slice(0, index).filter(item => item.trim() === value.trim()).length;
    return duplicateCount ? `${base} (${duplicateCount + 1})` : base;
  });
  const records = rows.slice(1, maxRows + 1).map(values => Object.fromEntries(headers.map((header, index) => [header, (values[index] || "").slice(0, maxCellChars)])));
  return { headers, rows: records };
}

async function videoFrames(filePath) {
  const frames = [];
  const warnings = [];
  for (const seconds of [0, 2, 5]) {
    try {
      const { stdout } = await execFile("ffmpeg", ["-hide_banner", "-loglevel", "error", "-ss", String(seconds), "-i", filePath, "-frames:v", "1", "-vf", "scale=640:640:force_original_aspect_ratio=decrease", "-q:v", "5", "-f", "image2", "pipe:1"], { encoding: null, timeout: 20_000, maxBuffer: 3 * 1024 * 1024 });
      if (Buffer.isBuffer(stdout) && stdout.length > 0) frames.push({ mimeType: "image/jpeg", data: stdout, label: `video frame near ${seconds}s` });
    } catch (error) {
      if (seconds === 0) warnings.push(error?.code === "ENOENT" ? "Video uploaded, but frame analysis is unavailable because ffmpeg is not installed." : "Video frames could not be extracted; use the optional file description as context.");
      break;
    }
  }
  return { frames, warnings };
}

export async function extractConversationAttachmentContext({ store, workspaceId, conversationId, attachmentIds, mediaDir }) {
  const state = await store.read();
  ownedConversation(state, workspaceId, conversationId);
  const ids = [...new Set(Array.isArray(attachmentIds) ? attachmentIds : [])];
  if (ids.length > 10) fail("At most 10 attachments can be analyzed per message", 413);
  const documents = [];
  const images = [];
  const warnings = [];
  let inlineBytes = 0;
  for (const id of ids) {
    const asset = ownedAttachment(state, workspaceId, conversationId, id);
    const filePath = resolve(resolve(mediaDir), asset.storageKey);
    const relativePath = relative(resolve(mediaDir), filePath);
    if (!relativePath || relativePath.startsWith("..") || isAbsolute(relativePath)) fail("Attachment path is invalid", 500);
    if (asset.kind === "document") {
      const buffer = await readFile(filePath);
      let text = "";
      try {
        if (asset.mimeType === "text/plain" || asset.mimeType === "text/markdown") text = buffer.toString("utf8");
        else if (asset.mimeType === "text/csv") {
          const parsed = parseCsvRows(buffer.toString("utf8"));
          text = `CSV HEADERS: ${JSON.stringify(parsed.headers)}\nCSV ROWS: ${JSON.stringify(parsed.rows)}`;
        } else if (asset.mimeType === "application/pdf") {
          const parsed = await pdfParse(buffer, { max: 60 });
          text = parsed.text || "";
        } else if (asset.mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
          const parsed = await mammoth.extractRawText({ buffer });
          text = parsed.value || "";
        }
      } catch {
        warnings.push(`Text extraction failed for ${asset.originalName}; it was not included in the model prompt.`);
      }
      text = text.replace(/\u0000/g, "").trim().slice(0, MAX_DOCUMENT_TEXT);
      if (text) documents.push({ name: asset.originalName, description: asset.description || "", text });
      else if (!warnings.some(item => item.includes(asset.originalName))) warnings.push(`No readable text was extracted from ${asset.originalName}.`);
      continue;
    }
    if (asset.kind === "image") {
      const buffer = await readFile(filePath);
      if (inlineBytes + buffer.length > MAX_INLINE_IMAGE_BYTES) {
        warnings.push(`Image ${asset.originalName} was stored but omitted from model analysis because the combined image limit was reached.`);
        continue;
      }
      inlineBytes += buffer.length;
      images.push({ mimeType: asset.mimeType, data: buffer, label: asset.originalName, description: asset.description || "" });
      continue;
    }
    if (asset.kind === "video") {
      const result = await videoFrames(filePath);
      warnings.push(...result.warnings);
      for (const frame of result.frames) {
        if (inlineBytes + frame.data.length > MAX_INLINE_IMAGE_BYTES) break;
        inlineBytes += frame.data.length;
        images.push({ ...frame, label: `${asset.originalName} — ${frame.label}`, description: asset.description || "" });
      }
      continue;
    }
    warnings.push(`Unsupported attachment type for ${asset.originalName}.`);
  }
  return { documents, images, warnings, limitations: [
    "Text is extracted locally from TXT, PDF and DOCX files, with a bounded excerpt included in the prompt.",
    "Images and selected video frames are sent to the configured OpenAI-compatible model provider only when one is configured.",
    "Video audio is not transcribed; frame extraction is visual-only.",
    "Attachments remain stored in local project storage and are never sent to MAAROOF AI."
  ] };
}
