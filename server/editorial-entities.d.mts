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
export function createEntity(state: Record<string, any>, input: CreateEntityInput): Record<string, any>;
export function listEntities(state: Record<string, any>, workspaceId: string, taskId: string): Record<string, any>;
export function scanKnownEntities(state: Record<string, any>, input: EntityScope): Record<string, any>;
export function createEntityRelationship(state: Record<string, any>, input: EntityRelationshipInput): Record<string, any>;
export function listEntityRelationships(state: Record<string, any>, workspaceId: string, taskId: string): Array<Record<string, any>>;
