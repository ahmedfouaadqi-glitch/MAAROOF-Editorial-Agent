export interface EntityScope { workspaceId: string; taskId: string; }
export interface CreateEntityInput extends EntityScope {
  canonicalName: string;
  type: "person" | "organization" | "place" | "product" | "event" | "concept" | "unknown";
  aliases?: string[];
  disambiguationNote: string;
}
export interface EntityRelationshipInput extends EntityScope {
  fromEntityId: string;
  toEntityId: string;
  relation: string;
  claimIds?: string[];
}
export function normalizeEntityLabel(value: string): string;
export function createEntity(state: Record<string, unknown>, input: CreateEntityInput): Record<string, unknown>;
export function listEntities(state: Record<string, unknown>, workspaceId: string, taskId: string): Record<string, unknown>;
export function scanKnownEntities(state: Record<string, unknown>, input: EntityScope): Record<string, unknown>;
export function createEntityRelationship(state: Record<string, unknown>, input: EntityRelationshipInput): Record<string, unknown>;
export function listEntityRelationships(state: Record<string, unknown>, workspaceId: string, taskId: string): Array<Record<string, unknown>>;
