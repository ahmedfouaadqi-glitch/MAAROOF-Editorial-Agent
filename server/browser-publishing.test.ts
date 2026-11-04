import { describe, expect, it } from "vitest";
import {
  buildApprovedArticleForBrowser, getBrowserDestination, getBrowserSession,
  registerBrowserDestination, removeBrowserSession, saveBrowserSession, updateBrowserSession
} from "./browser-publishing.mjs";

function emptyState() {
  return { tasks: {}, editorialDrafts: [], sources: [], claims: [], researchEvidence: [], originalityChecks: [], editorialReviews: [] };
}
const profile = {
  workspaceId: "workspace-a", name: "Sample Magazine",
  homepage: "https://magazine.example", editorUrl: "https://magazine.example/login",
  approvedHosts: ["accounts.magazine.example"],
  titleSelector: "input[name=title]", bodySelector: "[contenteditable=true]"
};

describe("browser destination registry", () => {
  it("stores an HTTPS profile and keeps automation disabled until reviewed", () => {
    const state = emptyState();
    const destination = registerBrowserDestination(state, profile);
    expect(destination).toMatchObject({
      workspaceId: "workspace-a", status: "needs-policy-review", automaticPublishEnabled: false,
      approvedHosts: ["magazine.example", "accounts.magazine.example"]
    });
  });
  it("rejects unapproved editor hosts and insecure URLs", () => {
    expect(() => registerBrowserDestination(emptyState(), { ...profile, editorUrl: "https://attacker.example/login" })).toThrow();
    expect(() => registerBrowserDestination(emptyState(), { ...profile, homepage: "http://magazine.example" })).toThrow();
  });
  it("does not let a different workspace read the destination or session", () => {
    const state = emptyState();
    const destination = registerBrowserDestination(state, profile);
    expect(() => getBrowserDestination(state, "workspace-b", destination.id)).toThrow();
    saveBrowserSession(state, {
      id: "session-abc", workspaceId: "workspace-a", destinationId: destination.id,
      state: "waiting-for-user", currentUrl: profile.editorUrl, title: "Login",
      createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 60000).toISOString()
    });
    expect(() => getBrowserSession(state, "workspace-b", "session-abc")).toThrow();
  });
  it("updates and removes a session only in the owning workspace", () => {
    const state = emptyState();
    const session = saveBrowserSession(state, {
      id: "session-abc", workspaceId: "workspace-a", destinationId: "destination-a",
      state: "waiting-for-user", currentUrl: profile.editorUrl, title: "Login",
      createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 60000).toISOString()
    });
    expect(updateBrowserSession(state, "workspace-a", session.id, { state: "user-controlled", currentUrl: "https://magazine.example/editor" }).state).toBe("user-controlled");
    expect(removeBrowserSession(state, "workspace-a", session.id).closed).toBe(true);
    expect(() => getBrowserSession(state, "workspace-a", session.id)).toThrow();
  });
});

describe("approved article browser handoff", () => {
  it("rejects articles that have not completed the editorial gates", () => {
    const state = emptyState();
    state.tasks["article-a"] = { workspaceId: "workspace-a", article: { stage: "drafting" } };
    const destination = registerBrowserDestination(state, profile);
    expect(() => buildApprovedArticleForBrowser(state, { workspaceId: "workspace-a", taskId: "article-a", destination })).toThrow();
  });
});
