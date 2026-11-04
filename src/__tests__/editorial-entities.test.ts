import { describe, expect, it } from "vitest";
import {
  createEntity, createEntityRelationship, listEntities, listEntityRelationships,
  normalizeEntityLabel, scanKnownEntities
} from "../../server/editorial-entities.mjs";

function fixture() {
  return {
    tasks: {
      "task-a": { workspaceId: "workspace-a", article: { topic: "Story" } },
      "task-b": { workspaceId: "workspace-a", article: { topic: "Other story" } },
      "task-x": { workspaceId: "workspace-x", article: { topic: "Private" } }
    },
    claims: [
      { id: "claim-a", workspaceId: "workspace-a", taskId: "task-a", text: "شركة معروف أعلنت إطلاق المنتج الجديد." },
      { id: "claim-b", workspaceId: "workspace-a", taskId: "task-a", text: "Maaroof partnered with Acme Group." },
      { id: "claim-x", workspaceId: "workspace-x", taskId: "task-x", text: "Maaroof appeared in a separate workspace." }
    ],
    entities: [],
    entityClaimLinks: [],
    entityRelationships: []
  };
}

describe("editorial entity intelligence", () => {
  it("normalizes Arabic orthographic variants for alias matching", () => {
    expect(normalizeEntityLabel("مَعْرُوفٌ،")).toBe("معروف");
    expect(normalizeEntityLabel("إِبْرَاهِيم")).toBe("ابراهيم");
  });

  it("creates a typed entity with a required disambiguation note", () => {
    const state = fixture();
    const entity = createEntity(state, {
      workspaceId: "workspace-a", taskId: "task-a",
      canonicalName: "معروف", type: "organization",
      aliases: ["Maaroof", "شركة معروف"],
      disambiguationNote: "علامة تجارية وشركة تقنية ضمن سياق هذه المقالة."
    });
    expect(entity.type).toBe("organization");
    expect(entity.normalizedAliases).toContain("maar oof".replace(" ", ""));
    expect(() => createEntity(state, {
      workspaceId: "workspace-a", taskId: "task-a",
      canonicalName: "شركة معروف", type: "organization",
      disambiguationNote: "اسم بديل للكيان نفسه ضمن هذه المقالة."
    })).toThrow("matching canonical name or alias");
  });

  it("allows the same real-world label to be separately curated in another article", () => {
    const state = fixture();
    createEntity(state, {
      workspaceId: "workspace-a", taskId: "task-a", canonicalName: "Maaroof",
      type: "organization", disambiguationNote: "كيان محدد ضمن المقالة الأولى."
    });
    const second = createEntity(state, {
      workspaceId: "workspace-a", taskId: "task-b", canonicalName: "Maaroof",
      type: "organization", disambiguationNote: "نفس الاسم لكنه سجل مستقل للمقالة الثانية."
    });
    expect(second.taskId).toBe("task-b");
  });

  it("scans only registered aliases and links matching claims", () => {
    const state = fixture();
    const entity = createEntity(state, {
      workspaceId: "workspace-a", taskId: "task-a",
      canonicalName: "معروف", type: "organization", aliases: ["Maaroof"],
      disambiguationNote: "علامة تجارية محددة في سياق المقالة الحالية."
    });
    const result = scanKnownEntities(state, { workspaceId: "workspace-a", taskId: "task-a" });
    expect(result.scannedClaims).toBe(2);
    expect(result.matches).toHaveLength(2);
    expect(listEntities(state, "workspace-a", "task-a").entities[0].claimIds).toContain("claim-a");
    expect(listEntities(state, "workspace-a", "task-a").entities[0].id).toBe(entity.id);
    expect(scanKnownEntities(state, { workspaceId: "workspace-a", taskId: "task-a" }).matches).toHaveLength(2);
    expect(state.entityClaimLinks).toHaveLength(2);
  });

  it("rejects cross-workspace and cross-article entity relationships", () => {
    const state = fixture();
    const a = createEntity(state, {
      workspaceId: "workspace-a", taskId: "task-a", canonicalName: "Maaroof",
      type: "organization", disambiguationNote: "شركة وعلامة ضمن سياق المقالة."
    });
    const b = createEntity(state, {
      workspaceId: "workspace-a", taskId: "task-a", canonicalName: "Acme Group",
      type: "organization", disambiguationNote: "شركة أخرى مذكورة في المقالة."
    });
    expect(() => createEntityRelationship(state, {
      workspaceId: "workspace-a", taskId: "task-a", fromEntityId: a.id,
      toEntityId: b.id, relation: "partnered with", claimIds: ["claim-x"]
    })).toThrow("Every supporting claim must belong");
    const relationship = createEntityRelationship(state, {
      workspaceId: "workspace-a", taskId: "task-a", fromEntityId: a.id,
      toEntityId: b.id, relation: "partnered with", claimIds: ["claim-b"]
    });
    expect(relationship.evidenceState).toBe("claim-linked-unverified");
    expect(listEntityRelationships(state, "workspace-a", "task-a")).toHaveLength(1);
    expect(() => createEntityRelationship(state, {
      workspaceId: "workspace-a", taskId: "task-b", fromEntityId: a.id,
      toEntityId: b.id, relation: "partnered with"
    })).toThrow("Both entities must belong");
  });
});
