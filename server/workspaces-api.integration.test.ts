import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer as createNetServer } from "node:net";
import { spawn } from "node:child_process";

const token = "test-admin-token-for-workspace-api";
let directory: string;
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

  it("rejects unknown workspace IDs in body-scoped operations", async () => {
    const response = await api("/api/v1/claims", {
      method: "POST",
      body: JSON.stringify({ workspaceId: "does-not-exist", taskId: "task-x" })
    });
    expect(response.status).toBe(404);
  });
});
