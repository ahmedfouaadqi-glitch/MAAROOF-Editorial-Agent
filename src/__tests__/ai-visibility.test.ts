import { describe, expect, it } from "vitest";
import { classifyBot, listVisibilityEvents, recordVisibilityEvent, summarizeVisibility } from "../../server/ai-visibility.mjs";

describe("AI visibility evidence ledger", () => {
  it("distinguishes training crawlers from search crawlers and user fetches", () => {
    expect(classifyBot("Mozilla/5.0 GPTBot/1.4").purpose).toBe("training_candidate");
    expect(classifyBot("OAI-SearchBot/1.0").purpose).toBe("ai_search_crawler");
    expect(classifyBot("Claude-User/1.0").purpose).toBe("user_requested_fetch");
  });

  it("records crawler access without claiming indexing, citation, or training", () => {
    const state = {};
    const event = recordVisibilityEvent(state, {
      workspaceId: "w1", url: "https://example.com/story",
      eventType: "crawler_fetch", bot: "GPTBot/1.4", source: "manual"
    });
    expect(event.botPurpose).toBe("training_candidate");
    expect(event.verified).toBe(false);
    expect(summarizeVisibility(listVisibilityEvents(state, "w1")).trainingAttestations).toBe(0);
  });

  it("requires evidence for verified citations and training attestations", () => {
    const state = {};
    expect(() => recordVisibilityEvent(state, {
      workspaceId: "w1", url: "https://example.com/story",
      eventType: "citation_verified", verified: true
    })).toThrow(/evidence URL/i);
    expect(() => recordVisibilityEvent(state, {
      workspaceId: "w1", url: "https://example.com/story",
      eventType: "training_attestation", verified: true
    })).toThrow(/evidence URL/i);
  });

  it("counts only verified indexing, citation, and training evidence", () => {
    const state = {};
    for (const [eventType, evidenceNote] of [
      ["search_index_verified", "URL inspection result"],
      ["citation_verified", "Captured answer citation"],
      ["training_attestation", "Provider's explicit statement"]
    ] as const) {
      recordVisibilityEvent(state, {
        workspaceId: "w1", url: "https://example.com/story", eventType,
        verified: true, evidenceUrl: "https://evidence.example/result", evidenceNote
      });
    }
    const summary = summarizeVisibility(listVisibilityEvents(state, "w1"));
    expect(summary.searchIndexVerified).toBe(1);
    expect(summary.citationsVerified).toBe(1);
    expect(summary.trainingAttestations).toBe(1);
  });

  it("isolates events by workspace and rejects non-http URLs", () => {
    const state = {};
    recordVisibilityEvent(state, { workspaceId: "w1", url: "https://example.com/a", eventType: "crawler_fetch" });
    expect(listVisibilityEvents(state, "w2")).toHaveLength(0);
    expect(() => recordVisibilityEvent(state, { workspaceId: "w1", url: "javascript:alert(1)", eventType: "crawler_fetch" })).toThrow(/HTTP/);
  });
});
