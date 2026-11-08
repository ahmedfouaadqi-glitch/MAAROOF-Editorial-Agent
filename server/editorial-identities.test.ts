import { describe, expect, it } from "vitest";
import { listEditorialBrands, listEditorialClients, resolveEditorialIdentities } from "./editorial-identities.mjs";

describe("workspace editorial identities", () => {
  it("reuses client and brand names case-insensitively within a workspace", () => {
    const state: any = { clients: [], brands: [] };
    const first = resolveEditorialIdentities(state, { workspaceId: "workspace-a", clientName: "Acme Group", brandName: "Acme Daily" });
    const second = resolveEditorialIdentities(state, { workspaceId: "workspace-a", clientName: "  ACME   GROUP ", brandName: "ACME DAILY" });
    expect(second.clientId).toBe(first.clientId);
    expect(second.brandId).toBe(first.brandId);
    expect(state.clients).toHaveLength(1);
    expect(state.brands).toHaveLength(1);
  });

  it("keeps same-named clients and brands isolated across workspaces and client parents", () => {
    const state: any = { clients: [], brands: [] };
    const one = resolveEditorialIdentities(state, { workspaceId: "workspace-a", clientName: "Acme", brandName: "Daily" });
    const two = resolveEditorialIdentities(state, { workspaceId: "workspace-b", clientName: "Acme", brandName: "Daily" });
    const three = resolveEditorialIdentities(state, { workspaceId: "workspace-a", clientName: "Other Co", brandName: "Daily" });
    expect(new Set([one.clientId, two.clientId, three.clientId]).size).toBe(3);
    expect(new Set([one.brandId, two.brandId, three.brandId]).size).toBe(3);
    expect(listEditorialClients(state, "workspace-a")).toHaveLength(2);
    expect(listEditorialClients(state, "workspace-b")).toHaveLength(1);
    expect(listEditorialBrands(state, "workspace-a", one.clientId)).toHaveLength(1);
    expect(listEditorialBrands(state, "workspace-a", three.clientId)).toHaveLength(1);
  });

  it("rejects a brand ID paired with another client's ID or name", () => {
    const state: any = { clients: [], brands: [] };
    const one = resolveEditorialIdentities(state, { workspaceId: "workspace-a", clientName: "Acme", brandName: "Daily" });
    const two = resolveEditorialIdentities(state, { workspaceId: "workspace-a", clientName: "Other Co" });
    expect(() => resolveEditorialIdentities(state, { workspaceId: "workspace-a", clientId: two.clientId, brandId: one.brandId })).toThrow("Brand does not belong to the selected client");
    expect(() => resolveEditorialIdentities(state, { workspaceId: "workspace-a", clientId: one.clientId, clientName: "Other Co" })).toThrow("clientId and clientName refer to different clients");
  });

  it("rejects empty or oversized identity names", () => {
    const state: any = { clients: [], brands: [] };
    expect(() => resolveEditorialIdentities(state, { workspaceId: "workspace-a", clientName: "x" })).toThrow("clientName must contain 2-120 characters");
    expect(() => resolveEditorialIdentities(state, { workspaceId: "workspace-a", brandName: "x" })).toThrow("brandName must contain 2-120 characters");
  });

  it("stores brand guidance on the workspace-scoped brand and returns it in the brand list", () => {
    const state: any = { clients: [], brands: [] };
    const identity = resolveEditorialIdentities(state, {
      workspaceId: "workspace-a", brandName: "Daily", brandProfile: {
        voice: "Clear, direct and useful", audience: "Founders in MENA",
        approvedFacts: "Founded in 2018 (source: company profile)", avoid: "Guaranteed results"
      }
    });
    expect(listEditorialBrands(state, "workspace-a")).toMatchObject([{
      id: identity.brandId, name: "Daily", profile: { voice: "Clear, direct and useful", audience: "Founders in MENA", avoid: "Guaranteed results" }
    }]);
    expect(listEditorialBrands(state, "workspace-b")).toHaveLength(0);
  });

  it("rejects brand guidance without a brand and oversized fields", () => {
    const state: any = { clients: [], brands: [] };
    expect(() => resolveEditorialIdentities(state, { workspaceId: "workspace-a", brandProfile: { voice: "Warm" } })).toThrow("A brand name or brandId is required to save brand guidance");
    expect(() => resolveEditorialIdentities(state, { workspaceId: "workspace-a", brandName: "Daily", brandProfile: { voice: "x".repeat(1601) } })).toThrow("brandProfile.voice must be text up to 1600 characters");
  });
});
