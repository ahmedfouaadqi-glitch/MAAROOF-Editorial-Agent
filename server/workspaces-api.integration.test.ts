import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer as createNetServer } from "node:net";
import { spawn } from "node:child_process";

const token = "test-admin-token-for-workspace-api";
let directory = "";
let baseUrl = "";
let child: ReturnType<typeof spawn> | null = null;

async function reservePort(): Promise<number> {
  const server = createNetServer();
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Could not reserve a local test port");
  const port = address.port;
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  return port;
}

async function waitForHealth(): Promise<void> {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    if (child?.exitCode !== null && child?.exitCode !== undefined) {
      throw new Error(`API process exited with code ${child.exitCode}`);
    }
    try {
      const response = await fetch(`${baseUrl}/health`);
      if (response.ok) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error("API did not become healthy within 10 seconds");
}

async function api(path: string, options: RequestInit = {}, authenticated = true): Promise<Response> {
  const headers = new Headers(options.headers);
  if (authenticated) headers.set("authorization", `Bearer ${token}`);
  if (options.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  return fetch(`${baseUrl}${path}`, { ...options, headers });
}

describe("workspace API integration", () => {
  beforeAll(async () => {
    directory = await mkdtemp(join(tmpdir(), "maaroof-api-test-"));
    const port = await reservePort();
    baseUrl = `http://127.0.0.1:${port}`;
    child = spawn(process.execPath, ["server/main.mjs"], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        PORT: String(port),
        HOST: "127.0.0.1",
        ADMIN_API_TOKEN: token,
        DATA_FILE: join(directory, "state.json"),
        MEDIA_DIR: join(directory, "media"),
        CORS_ORIGIN: "http://localhost:5173"
      },
      stdio: "ignore"
    });
    await waitForHealth();
  }, 15_000);

  afterAll(async () => {
    if (child && child.exitCode === null) {
      child.kill("SIGTERM");
      await new Promise<void>(resolve => child?.once("exit", () => resolve()));
    }
    if (directory) await rm(directory, { recursive: true, force: true });
  });

  it("requires the single administrator token", async () => {
    const response = await api("/api/v1/workspaces", {}, false);
    expect(response.status).toBe(401);
  });

  it("creates, archives, blocks, and restores a workspace", async () => {
    const createdResponse = await api("/api/v1/workspaces", {
      method: "POST",
      body: JSON.stringify({ name: "API Test Workspace", description: "integration" })
    });
    expect(createdResponse.status).toBe(201);
    const { workspace } = await createdResponse.json() as any;

    const archiveResponse = await api(`/api/v1/workspaces/${workspace.id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "archived" })
    });
    expect(archiveResponse.status).toBe(200);

    const blocked = await api(`/api/v1/workspaces/${workspace.id}/conversations`);
    expect(blocked.status).toBe(404);

    const archivedList = await api("/api/v1/workspaces?includeArchived=true");
    expect(archivedList.status).toBe(200);
    const archivedPayload = await archivedList.json() as any;
    expect(archivedPayload.workspaces.some((item: any) => item.id === workspace.id && item.status === "archived")).toBe(true);

    const restored = await api(`/api/v1/workspaces/${workspace.id}/restore`, { method: "POST" });
    expect(restored.status).toBe(200);
    expect((await restored.json() as any).workspace.status).toBe("active");

    const allowed = await api(`/api/v1/workspaces/${workspace.id}/conversations`);
    expect(allowed.status).toBe(200);
  });

  it("keeps article records isolated between two active workspaces", async () => {
    const firstResponse = await api("/api/v1/workspaces", { method: "POST", body: JSON.stringify({ name: "Isolation Workspace A" }) });
    const secondResponse = await api("/api/v1/workspaces", { method: "POST", body: JSON.stringify({ name: "Isolation Workspace B" }) });
    const first = (await firstResponse.json() as any).workspace;
    const second = (await secondResponse.json() as any).workspace;

    const created = await api(`/api/v1/workspaces/${first.id}/articles`, {
      method: "POST",
      body: JSON.stringify({ topic: "Workspace-scoped editorial task", language: "en", objective: "analysis" })
    });
    expect(created.status).toBe(201);
    const article = (await created.json() as any).article;

    const firstList = await api(`/api/v1/workspaces/${first.id}/articles`);
    const secondList = await api(`/api/v1/workspaces/${second.id}/articles`);
    expect((await firstList.json() as any).articles.some((item: any) => item.id === article.id)).toBe(true);
    expect((await secondList.json() as any).articles.some((item: any) => item.id === article.id)).toBe(false);

    const crossWorkspaceUpdate = await api(`/api/v1/workspaces/${second.id}/articles/${article.id}/stage`, {
      method: "PUT",
      body: JSON.stringify({ nextStage: "planning" })
    });
    expect(crossWorkspaceUpdate.status).toBe(404);
  });

  it("denies cross-workspace conversation and attachment reads", async () => {
    const workspaceAResponse = await api("/api/v1/workspaces", { method: "POST", body: JSON.stringify({ name: "Conversation Boundary A" }) });
    const workspaceBResponse = await api("/api/v1/workspaces", { method: "POST", body: JSON.stringify({ name: "Conversation Boundary B" }) });
    const workspaceA = (await workspaceAResponse.json() as any).workspace;
    const workspaceB = (await workspaceBResponse.json() as any).workspace;

    const created = await api(`/api/v1/workspaces/${workspaceA.id}/conversations`, {
      method: "POST",
      body: JSON.stringify({ targetId: "medium", language: "en", title: "Private workspace conversation" })
    });
    expect(created.status).toBe(201);
    const conversation = (await created.json() as any).conversation;

    const foreignConversation = await api(`/api/v1/workspaces/${workspaceB.id}/conversations/${conversation.id}`);
    expect(foreignConversation.status).toBe(404);
    const foreignAttachments = await api(`/api/v1/workspaces/${workspaceB.id}/conversations/${conversation.id}/attachments`);
    expect(foreignAttachments.status).toBe(404);
    const foreignCancel = await api(`/api/v1/workspaces/${workspaceB.id}/conversations/${conversation.id}/cancel`, { method: "POST" });
    expect(foreignCancel.status).toBe(404);
  });

  it("rejects retry unless the conversation's previous run failed or was cancelled", async () => {
    const created = await api("/api/v1/workspaces/main-workspace/conversations", {
      method: "POST",
      body: JSON.stringify({ targetId: "medium", language: "en", title: "Retry boundary" })
    });
    expect(created.status).toBe(201);
    const conversation = (await created.json() as any).conversation;
    const rejected = await api(`/api/v1/workspaces/main-workspace/conversations/${conversation.id}/retry`, { method: "POST" });
    expect(rejected.status).toBe(409);
  });

  it("enforces active workspace scope for AI visibility reads and writes", async () => {
    const createdResponse = await api("/api/v1/workspaces", { method: "POST", body: JSON.stringify({ name: "Visibility Boundary Workspace" }) });
    const workspace = (await createdResponse.json() as any).workspace;
    const eventResponse = await api("/api/v1/admin/ai-visibility/events", {
      method: "POST",
      body: JSON.stringify({ workspaceId: workspace.id, url: "https://publisher.example/article", eventType: "referral_visit", source: "manual" })
    });
    expect(eventResponse.status).toBe(201);
    const list = await api(`/api/v1/admin/ai-visibility?workspaceId=${encodeURIComponent(workspace.id)}`);
    expect(list.status).toBe(200);
    expect((await list.json() as any).events).toHaveLength(1);

    const invalidWrite = await api("/api/v1/admin/ai-visibility/events", {
      method: "POST",
      body: JSON.stringify({ workspaceId: "missing-workspace", url: "https://publisher.example/article", eventType: "referral_visit" })
    });
    expect(invalidWrite.status).toBe(404);

    const archived = await api(`/api/v1/workspaces/${workspace.id}`, { method: "PATCH", body: JSON.stringify({ status: "archived" }) });
    expect(archived.status).toBe(200);
    const archivedRead = await api(`/api/v1/admin/ai-visibility?workspaceId=${encodeURIComponent(workspace.id)}`);
    expect(archivedRead.status).toBe(404);
    const archivedWrite = await api("/api/v1/admin/ai-visibility/events", {
      method: "POST",
      body: JSON.stringify({ workspaceId: workspace.id, url: "https://publisher.example/another", eventType: "referral_visit" })
    });
    expect(archivedWrite.status).toBe(404);
  });

  it("isolates browser publishing destinations and session listings", async () => {
    const aResponse = await api("/api/v1/workspaces", { method: "POST", body: JSON.stringify({ name: "Browser Boundary A" }) });
    const bResponse = await api("/api/v1/workspaces", { method: "POST", body: JSON.stringify({ name: "Browser Boundary B" }) });
    const a = (await aResponse.json() as any).workspace;
    const b = (await bResponse.json() as any).workspace;

    const destinationResponse = await api(`/api/v1/workspaces/${a.id}/browser-destinations`, {
      method: "POST",
      body: JSON.stringify({
        name: "Authorized Publisher", homepage: "https://publisher.example",
        editorUrl: "https://publisher.example/editor", approvedHosts: [],
        titleSelector: "", bodySelector: "", authorityConfirmed: true, policyReviewed: true
      })
    });
    expect(destinationResponse.status).toBe(201);
    const destination = (await destinationResponse.json() as any).destination;

    const ownDestinations = await api(`/api/v1/workspaces/${a.id}/browser-destinations`);
    const foreignDestinations = await api(`/api/v1/workspaces/${b.id}/browser-destinations`);
    expect((await ownDestinations.json() as any).destinations.map((item: any) => item.id)).toContain(destination.id);
    expect((await foreignDestinations.json() as any).destinations).toHaveLength(0);

    const ownSessions = await api(`/api/v1/workspaces/${a.id}/browser-sessions`);
    const foreignSessions = await api(`/api/v1/workspaces/${b.id}/browser-sessions`);
    expect((await ownSessions.json() as any).sessions).toHaveLength(0);
    expect((await foreignSessions.json() as any).sessions).toHaveLength(0);
  });

  it("rejects unknown workspace IDs in body-scoped operations", async () => {
    const response = await api("/api/v1/claims", {
      method: "POST",
      body: JSON.stringify({ workspaceId: "does-not-exist", taskId: "task-x" })
    });
    expect(response.status).toBe(404);
  });
});
