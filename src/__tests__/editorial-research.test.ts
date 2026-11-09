import { describe, expect, it } from "vitest";
import { assessSource, listResearch, recordEvidence } from "../../server/editorial-research.mjs";

type AssessedSource = { research: { metadataCompleteness: number; qualityRating: string }; fetched: boolean };
type ResearchReport = {
  claims: Array<{ conflictState: string }>;
  summary: { claimsWithConflictingEvidence: number; evidenceRecordCount: number; claimsWithoutEvidence: number };
};
function fixture() {
  return {
    tasks: {
      "task-a": { workspaceId: "workspace-a", article: { topic: "Energy policy" } },
      "task-b": { workspaceId: "workspace-a", article: { topic: "Another article" } }
    },
    sources: [
      { id: "source-a", workspaceId: "workspace-a", taskId: "task-a", url: "https://example.org/report", title: "Annual report", fetched: false },
      { id: "source-b", workspaceId: "workspace-a", taskId: "task-a", url: "https://example.org/news", title: "News report", fetched: false },
      { id: "source-other", workspaceId: "workspace-a", taskId: "task-b", url: "https://example.org/other" }
    ],
    claims: [
      { id: "claim-a", workspaceId: "workspace-a", taskId: "task-a", text: "The project began in 2024." },
      { id: "claim-other", workspaceId: "workspace-a", taskId: "task-b", text: "Different article claim." }
    ],
    researchEvidence: []
  };
}

describe("editorial research service", () => {
  it("records source metadata and computes metadata completeness separately from quality rating", () => {
    const state = fixture();
    const source = assessSource(state, {
      workspaceId: "workspace-a", taskId: "task-a", sourceId: "source-a",
      author: "Research Unit", publisher: "Example Institute", sourceType: "academic",
      publishedAt: "2025-02-10", updatedAt: "2025-03-01",
      effectiveFrom: "2024-01-01", effectiveTo: "2025-12-31",
      jurisdiction: "Iraq", methodology: "Annual audited administrative dataset.",
      qualityRating: "high", qualityRationale: "Primary institutional report with disclosed methodology."
    }) as unknown as AssessedSource;
    expect(source.research.metadataCompleteness).toBe(100);
    expect(source.research.qualityRating).toBe("high");
    expect(source.fetched).toBe(false);
  });

  it("requires a rationale for a manual quality rating", () => {
    expect(() => assessSource(fixture(), {
      workspaceId: "workspace-a", taskId: "task-a", sourceId: "source-a",
      qualityRating: "high"
    })).toThrow("A rationale is required");
  });

  it("rejects invalid temporal ranges", () => {
    expect(() => assessSource(fixture(), {
      workspaceId: "workspace-a", taskId: "task-a", sourceId: "source-a",
      effectiveFrom: "2025-12-31", effectiveTo: "2024-01-01"
    })).toThrow("effectiveTo cannot precede");
  });

  it("records source excerpts with explicit support or contradiction stance", () => {
    const state = fixture();
    const supporting = recordEvidence(state, {
      workspaceId: "workspace-a", taskId: "task-a", sourceId: "source-a",
      claimId: "claim-a", excerpt: "The implementation commenced in January 2024.",
      stance: "supports", locator: "Page 4"
    });
    const contradicting = recordEvidence(state, {
      workspaceId: "workspace-a", taskId: "task-a", sourceId: "source-b",
      claimId: "claim-a", excerpt: "The launch was postponed until 2025.",
      stance: "contradicts", locator: "Paragraph 6"
    });
    expect(supporting.verificationState).toBe("manually-transcribed-unverified");
    expect(contradicting.stance).toBe("contradicts");
    const report = listResearch(state, "workspace-a", "task-a") as unknown as ResearchReport;
    expect(report.claims[0].conflictState).toBe("conflicting-evidence");
    expect(report.summary.claimsWithConflictingEvidence).toBe(1);
    expect(report.summary.evidenceRecordCount).toBe(2);
  });

  it("enforces workspace and article isolation for evidence", () => {
    const state = fixture();
    expect(() => recordEvidence(state, {
      workspaceId: "workspace-a", taskId: "task-a", sourceId: "source-other",
      claimId: "claim-a", excerpt: "This is a long enough excerpt.", stance: "supports"
    })).toThrow("Source not found");
    expect(() => recordEvidence(state, {
      workspaceId: "workspace-a", taskId: "task-a", sourceId: "source-a",
      claimId: "claim-other", excerpt: "This is a long enough excerpt.", stance: "supports"
    })).toThrow("Claim not found");
  });

  it("reports no evidence distinctly from unverified linked references", () => {
    const report = listResearch(fixture(), "workspace-a", "task-a") as unknown as ResearchReport;
    expect(report.claims[0].conflictState).toBe("no-evidence-recorded");
    expect(report.summary.claimsWithoutEvidence).toBe(1);
  });
});
