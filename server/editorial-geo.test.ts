import { describe, expect, it } from "vitest";
import { getGeoReadiness, updateGeoBrief } from "./editorial-geo.mjs";

function fixture() {
  const workspaceId = "workspace-a";
  const taskId = "task-a";
  const state = {
    tasks: { [taskId]: { workspaceId, article: { topic: "Solar panels for schools", language: "en", objective: "educational" } } },
    editorialDrafts: [{
      id: "draft-a", workspaceId, taskId, title: "Solar panels for schools", dek: "", editorialAngle: "A practical, evidence-led guide for school decision-makers.",
      sections: [{ id: "section-a", heading: "School rooftop solar", body: "Solar panels for schools can reduce purchased electricity. Solar Initiative offers a planning framework for comparing rooftop suitability and energy use." }]
    }],
    sources: [{ id: "source-a", workspaceId, taskId, title: "Planning report", research: { publishedAt: "2026-01-01T00:00:00.000Z" } }],
    claims: [{ id: "claim-a", workspaceId, taskId, text: "Solar Initiative provides a school rooftop planning framework.", sourceIds: ["source-a"] }],
    researchEvidence: [{ id: "evidence-a", workspaceId, taskId, claimId: "claim-a", sourceId: "source-a", excerpt: "The report describes a rooftop planning framework for schools.", stance: "supports", verificationState: "manually-transcribed-unverified" }],
    entities: [{ id: "entity-a", workspaceId, taskId, canonicalName: "Solar Initiative", aliases: ["Solar planning program"] }],
    entityClaimLinks: [{ id: "link-a", workspaceId, taskId, entityId: "entity-a", claimId: "claim-a" }]
  };
  return { state, workspaceId, taskId };
}

describe("editorial GEO brief and readiness", () => {
  it("stores an intent-led brief with question, section, entity and evidence references", () => {
    const { state, workspaceId, taskId } = fixture();
    const result = updateGeoBrief(state, {
      workspaceId, taskId, intent: "informational", primaryQuery: "solar panels for schools",
      supportingTerms: ["school rooftop solar", "school rooftop solar"],
      targetQuestions: [{ question: "How can a school assess rooftop solar?", sectionId: "section-a", evidenceIds: ["evidence-a"] }],
      targetEntityIds: ["entity-a"]
    });
    expect(result.brief.supportingTerms).toEqual(["school rooftop solar"]);
    expect(result.readiness.status).toBe("ready-for-editor-review");
    expect(result.readiness.termCoverage[0].occurrences).toBeGreaterThan(0);
    expect(result.readiness.questionCoverage[0]).toMatchObject({ supportingEvidenceCount: 1, answerSectionHasText: true });
    expect(result.readiness.entityCoverage[0]).toMatchObject({ mentioned: true, evidenceCount: 1 });
    expect(result.readiness).not.toHaveProperty("score");
    expect(result.readiness.limitations.join(" ")).toContain("not a ranking score");
  });

  it("rejects unrelated entities, evidence, sections and unsupported search intents", () => {
    const { state, workspaceId, taskId } = fixture();
    expect(() => updateGeoBrief(state, { workspaceId, taskId, intent: "viral", primaryQuery: "solar panels", targetQuestions: [], targetEntityIds: [] })).toThrow("Unsupported search intent");
    expect(() => updateGeoBrief(state, { workspaceId, taskId, intent: "informational", primaryQuery: "solar panels", targetQuestions: [{ question: "How can a school assess solar?", sectionId: "foreign-section", evidenceIds: [] }], targetEntityIds: [] })).toThrow("Target question section must belong to this article");
    expect(() => updateGeoBrief(state, { workspaceId, taskId, intent: "informational", primaryQuery: "solar panels", targetQuestions: [{ question: "How can a school assess solar?", sectionId: "section-a", evidenceIds: ["foreign-evidence"] }], targetEntityIds: [] })).toThrow("Question evidence must belong to this workspace and article");
    expect(() => updateGeoBrief(state, { workspaceId, taskId, intent: "informational", primaryQuery: "solar panels", targetQuestions: [], targetEntityIds: ["foreign-entity"] })).toThrow("Target entities must be registered in this workspace and article");
  });

  it("reports missing answer evidence without fabricating a readiness pass", () => {
    const { state, workspaceId, taskId } = fixture();
    const result = updateGeoBrief(state, {
      workspaceId, taskId, intent: "informational", primaryQuery: "solar panels for schools", supportingTerms: [],
      targetQuestions: [{ question: "What does the school report say about payback?", sectionId: "section-a", evidenceIds: [] }], targetEntityIds: []
    });
    expect(result.readiness.status).toBe("incomplete");
    expect(result.readiness.questionCoverage[0].status).toBe("incomplete");
    expect(result.readiness.checks.find(item => item.id === "questions")?.status).toBe("missing");
  });

  it("keeps checks scoped to the requested article and exposes an empty brief before an outline", () => {
    const { state, workspaceId, taskId } = fixture();
    expect(() => getGeoReadiness(state, "workspace-b", taskId)).toThrow("Editorial task not found");
    const empty = { ...state, editorialDrafts: [] };
    expect(getGeoReadiness(empty, workspaceId, taskId).brief).toMatchObject({ intent: "", primaryQuery: "", targetQuestions: [] });
    expect(() => updateGeoBrief(empty, { workspaceId, taskId, intent: "", primaryQuery: "", targetQuestions: [], targetEntityIds: [] })).toThrow("Create an article outline before setting its GEO brief");
  });
});
