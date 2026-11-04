import { readFileSync } from "node:fs";

const catalogUrl = new URL("../config/editorial-targets.json", import.meta.url);
const parsed = JSON.parse(readFileSync(catalogUrl, "utf8"));
const TARGETS = new Map((parsed.targets || []).map(target => [target.id, Object.freeze(target)]));

function fail(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

export function getEditorialTarget(targetId) {
  if (typeof targetId !== "string" || !targetId.trim() || targetId.length > 128) fail("A supported editorial target is required");
  const target = TARGETS.get(targetId);
  if (!target || target.selectable !== true) fail("Editorial target is not available", 404);
  return structuredClone(target);
}

export function listEditorialTargets() {
  return [...TARGETS.values()].filter(target => target.selectable === true).map(target => structuredClone(target));
}
