import { randomUUID } from "node:crypto";

const ENTITY_TYPES = new Set(["person", "organization", "place", "product", "event", "concept", "unknown"]);

function fail(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

function taskFor(state, workspaceId, taskId) {
  const task = state.tasks?.[taskId];
  if (!task || task.workspaceId !== workspaceId || !task.article) fail("Editorial task not found", 404);
  return task;
}

export function normalizeEntityLabel(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/[ى]/g, "ي")
    .replace(/[ؤ]/g, "و")
    .replace(/[ئ]/g, "ي")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function createEntity(state, { workspaceId, taskId, canonicalName, type, aliases = [], disambiguationNote }) {
  taskFor(state, workspaceId, taskId);
  if (typeof canonicalName !== "string" || canonicalName.trim().length < 2 || canonicalName.length > 180) fail("canonicalName must contain 2-180 characters");
  if (!ENTITY_TYPES.has(type)) fail("Unsupported entity type");
  if (typeof disambiguationNote !== "string" || disambiguationNote.trim().length < 8 || disambiguationNote.length > 500) fail("A disambiguation note (8-500 characters) is required");
  if (!Array.isArray(aliases) || aliases.length > 30 || aliases.some(alias => typeof alias !== "string" || alias.trim().length < 2 || alias.length > 180)) fail("aliases must contain up to 30 valid labels");
  const labels = [...new Set([canonicalName, ...aliases].map(label => label.trim()))];
  const normalizedAliases = [...new Set(labels.map(normalizeEntityLabel).filter(Boolean))];
  state.entities ||= [];
  const collision = state.entities.find(entity => entity.workspaceId === workspaceId && entity.taskId === taskId && entity.normalizedAliases.some(alias => normalizedAliases.includes(alias)));
  if (collision) fail("An entity with a matching canonical name or alias already exists in this workspace", 409);
  const entity = {
    id: randomUUID(), workspaceId, taskId, canonicalName: canonicalName.trim(), type,
    aliases: labels.filter(label => normalizeEntityLabel(label) !== normalizeEntityLabel(canonicalName)),
    normalizedAliases, disambiguationNote: disambiguationNote.trim(), createdAt: new Date().toISOString()
  };
  state.entities.push(entity);
  return entity;
}

export function listEntities(state, workspaceId, taskId) {
  taskFor(state, workspaceId, taskId);
  const entities = (state.entities || []).filter(entity => entity.workspaceId === workspaceId && entity.taskId === taskId);
  const links = (state.entityClaimLinks || []).filter(link => link.workspaceId === workspaceId && link.taskId === taskId);
  return {
    entities: entities.map(entity => ({ ...entity, claimIds: [...new Set(links.filter(link => link.entityId === entity.id).map(link => link.claimId))] })),
    summary: { total: entities.length, byType: Object.fromEntries([...ENTITY_TYPES].map(type => [type, entities.filter(entity => entity.type === type).length])) }
  };
}

export function scanKnownEntities(state, { workspaceId, taskId }) {
  taskFor(state, workspaceId, taskId);
  const entities = (state.entities || []).filter(entity => entity.workspaceId === workspaceId && entity.taskId === taskId);
  const claims = (state.claims || []).filter(claim => claim.workspaceId === workspaceId && claim.taskId === taskId);
  state.entityClaimLinks ||= [];
  const matches = [];
  for (const claim of claims) {
    const paddedText = " " + normalizeEntityLabel(claim.text) + " ";
    for (const entity of entities) {
      const foundAliases = entity.normalizedAliases.filter(alias => alias.length >= 2 && paddedText.includes(" " + alias + " "));
      if (!foundAliases.length) continue;
      const existing = state.entityClaimLinks.find(link => link.workspaceId === workspaceId && link.taskId === taskId && link.entityId === entity.id && link.claimId === claim.id);
      if (!existing) state.entityClaimLinks.push({
        id: randomUUID(), workspaceId, taskId, entityId: entity.id, claimId: claim.id,
        matchedAliases: foundAliases, matchMethod: "normalized-exact-alias", createdAt: new Date().toISOString()
      });
      matches.push({ entityId: entity.id, claimId: claim.id, matchedAliases: foundAliases });
    }
  }
  return {
    scannedClaims: claims.length, registeredEntities: entities.length, matches,
    note: "This scans only registered aliases in this article's claims. It does not discover new entities or infer entity identity."
  };
}

export function createEntityRelationship(state, { workspaceId, taskId, fromEntityId, toEntityId, relation, claimIds = [] }) {
  taskFor(state, workspaceId, taskId);
  if (typeof fromEntityId !== "string" || typeof toEntityId !== "string" || fromEntityId === toEntityId) fail("Relationship requires two different entity IDs");
  if (typeof relation !== "string" || relation.trim().length < 2 || relation.length > 120) fail("relation must contain 2-120 characters");
  if (!Array.isArray(claimIds) || claimIds.length > 20 || claimIds.some(id => typeof id !== "string")) fail("claimIds must be an array of up to 20 claim IDs");
  const entities = state.entities || [];
  for (const id of [fromEntityId, toEntityId]) {
    if (!entities.some(entity => entity.id === id && entity.workspaceId === workspaceId && entity.taskId === taskId)) fail("Both entities must belong to this workspace and article", 404);
  }
  const claims = state.claims || [];
  for (const id of new Set(claimIds)) {
    if (!claims.some(claim => claim.id === id && claim.workspaceId === workspaceId && claim.taskId === taskId)) fail("Every supporting claim must belong to this workspace and article", 404);
  }
  state.entityRelationships ||= [];
  const duplicate = state.entityRelationships.find(item => item.workspaceId === workspaceId && item.taskId === taskId && item.fromEntityId === fromEntityId && item.toEntityId === toEntityId && normalizeEntityLabel(item.relation) === normalizeEntityLabel(relation));
  if (duplicate) fail("This entity relationship already exists", 409);
  const relationship = {
    id: randomUUID(), workspaceId, taskId, fromEntityId, toEntityId, relation: relation.trim(),
    claimIds: [...new Set(claimIds)], evidenceState: claimIds.length ? "claim-linked-unverified" : "unsubstantiated",
    createdAt: new Date().toISOString()
  };
  state.entityRelationships.push(relationship);
  return relationship;
}

export function listEntityRelationships(state, workspaceId, taskId) {
  taskFor(state, workspaceId, taskId);
  return (state.entityRelationships || []).filter(item => item.workspaceId === workspaceId && item.taskId === taskId);
}
