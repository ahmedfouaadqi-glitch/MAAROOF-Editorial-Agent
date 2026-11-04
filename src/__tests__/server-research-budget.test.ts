import { describe, expect, it } from "vitest";
import { DEFAULT_LIMITS, reserveBudget, releaseReservation, commitReservation, validateLimits } from "../../server/research-budget.mjs";

function freshState() {
  return { version: 1, limits: { ...DEFAULT_LIMITS }, tasks: {}, sources: [] };
}
const scope = { workspaceId: "workspace-a", taskId: "article-a" };

describe("server-side research budget", () => {
  it("validates admin limits", () => {
    expect(validateLimits(DEFAULT_LIMITS).valid).toBe(true);
    expect(validateLimits({ ...DEFAULT_LIMITS, searchesPerArticle: -1 }).valid).toBe(false);
  });

  it("reserves source URL units rather than request count", () => {
    const state = freshState();
    const first = reserveBudget(state, { ...scope, operation: "source", units: 3, reservationId: "source-0001" });
    expect(first.allowed).toBe(true);
    const over = reserveBudget(state, { ...scope, operation: "source", units: 1, reservationId: "source-0002" });
    expect(over.allowed).toBe(false);
    expect(over.used).toBe(3);
  });

  it("enforces search and inspection budgets independently", () => {
    const state = freshState();
    for (let i = 0; i < 5; i++) {
      expect(reserveBudget(state, { ...scope, operation: "search", reservationId: `search-000${i}` }).allowed).toBe(true);
      expect(reserveBudget(state, { ...scope, operation: "inspect", reservationId: `inspect-00${i}` }).allowed).toBe(true);
    }
    expect(reserveBudget(state, { ...scope, operation: "search", reservationId: "search-final" }).allowed).toBe(false);
    expect(reserveBudget(state, { ...scope, operation: "inspect", reservationId: "inspect-final" }).allowed).toBe(false);
  });

  it("isolates tasks and workspaces", () => {
    const state = freshState();
    reserveBudget(state, { ...scope, operation: "search", reservationId: "search-0001" });
    expect(reserveBudget(state, { workspaceId: "workspace-b", taskId: "article-a", operation: "search", reservationId: "search-0002" }).allowed).toBe(true);
    expect(() => reserveBudget(state, { workspaceId: "workspace-b", taskId: "article-a", operation: "search", reservationId: "search-0003" })).not.toThrow();
  });

  it("releases failed reservations and commits successful reservations", () => {
    const state = freshState();
    reserveBudget(state, { ...scope, operation: "search", reservationId: "search-0001" });
    expect(releaseReservation(state, { ...scope, reservationId: "search-0001" }).usage.search).toBe(0);
    reserveBudget(state, { ...scope, operation: "search", reservationId: "search-0002" });
    expect(commitReservation(state, { ...scope, reservationId: "search-0002" }).committed).toBe(true);
    expect(() => releaseReservation(state, { ...scope, reservationId: "search-0002" })).toThrow();
  });

  it("supports idempotent retries using the same reservation id", () => {
    const state = freshState();
    reserveBudget(state, { ...scope, operation: "search", reservationId: "same-reservation" });
    const replay = reserveBudget(state, { ...scope, operation: "search", reservationId: "same-reservation" });
    expect(replay.replayed).toBe(true);
    expect(replay.usage.search).toBe(1);
  });
});
