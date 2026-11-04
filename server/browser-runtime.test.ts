import { describe, expect, it, vi } from "vitest";
import { BrowserSessionManager, validatePublicUrl } from "./browser-runtime.mjs";

function fakePage() {
  const visible = vi.fn().mockResolvedValue(true);
  const locator = {
    count: vi.fn().mockResolvedValue(1),
    isVisible: visible,
    fill: vi.fn().mockResolvedValue(undefined),
    first: vi.fn(() => locator)
  };
  return {
    url: () => "https://publisher.example/editor",
    title: vi.fn().mockResolvedValue("Editor"),
    goto: vi.fn().mockResolvedValue(undefined),
    setDefaultTimeout: vi.fn(),
    screenshot: vi.fn().mockResolvedValue(Buffer.from("image")),
    mouse: { click: vi.fn().mockResolvedValue(undefined), wheel: vi.fn().mockResolvedValue(undefined) },
    keyboard: { type: vi.fn().mockResolvedValue(undefined), insertText: vi.fn().mockResolvedValue(undefined), press: vi.fn().mockResolvedValue(undefined) },
    locator: vi.fn(() => locator),
    locatorMock: locator
  };
}
function fakeChromium() {
  const page = fakePage();
  const context = {
    route: vi.fn().mockResolvedValue(undefined),
    newPage: vi.fn().mockResolvedValue(page),
    close: vi.fn().mockResolvedValue(undefined)
  };
  const browser = {
    newContext: vi.fn().mockResolvedValue(context),
    close: vi.fn().mockResolvedValue(undefined)
  };
  return { chromium: { launch: vi.fn().mockResolvedValue(browser) }, page, context, browser };
}
const publicDns = async () => [{ address: "93.184.216.34", family: 4 }];

describe("Browser Agent runtime", () => {
  it("requires HTTPS and a destination-approved hostname", async () => {
    await expect(validatePublicUrl("http://publisher.example", ["publisher.example"], { resolveHost: publicDns })).rejects.toMatchObject({ status: 400 });
    await expect(validatePublicUrl("https://other.example", ["publisher.example"], { resolveHost: publicDns })).rejects.toMatchObject({ status: 403 });
  });

  it("blocks hostnames resolving to private addresses", async () => {
    const privateDns = async () => [{ address: "10.0.0.10", family: 4 }];
    await expect(validatePublicUrl("https://publisher.example", ["publisher.example"], { resolveHost: privateDns })).rejects.toMatchObject({ status: 403 });
  });

  it("creates a workspace-scoped session and returns no browser internals", async () => {
    const fake = fakeChromium();
    const manager = new BrowserSessionManager({ chromium: fake.chromium, resolveHost: publicDns });
    const session = await manager.create({
      workspaceId: "workspace-a", destinationId: "destination-a",
      startUrl: "https://publisher.example/editor", approvedHosts: ["publisher.example"]
    });
    expect(fake.chromium.launch).toHaveBeenCalledWith({ headless: true });
    expect(session).toMatchObject({ workspaceId: "workspace-a", destinationId: "destination-a", state: "waiting-for-user" });
    expect(session).not.toHaveProperty("context");
    expect(session).not.toHaveProperty("browser");
  });

  it("limits concurrent sessions per workspace", async () => {
    const fake = fakeChromium();
    const manager = new BrowserSessionManager({ chromium: fake.chromium, resolveHost: publicDns, maxSessionsPerWorkspace: 1 });
    await manager.create({ workspaceId: "workspace-a", destinationId: "destination-a", startUrl: "https://publisher.example/login", approvedHosts: ["publisher.example"] });
    await expect(manager.create({ workspaceId: "workspace-a", destinationId: "destination-a", startUrl: "https://publisher.example/login", approvedHosts: ["publisher.example"] })).rejects.toMatchObject({ status: 429 });
    await expect(manager.create({ workspaceId: "workspace-b", destinationId: "destination-a", startUrl: "https://publisher.example/login", approvedHosts: ["publisher.example"] })).resolves.toMatchObject({ workspaceId: "workspace-b" });
  });

  it("prevents another workspace from reading or closing the session", async () => {
    const fake = fakeChromium();
    const manager = new BrowserSessionManager({ chromium: fake.chromium, resolveHost: publicDns });
    const session = await manager.create({
      workspaceId: "workspace-a", destinationId: "destination-a",
      startUrl: "https://publisher.example/editor", approvedHosts: ["publisher.example"]
    });
    await expect(manager.status(session.id, "workspace-b")).rejects.toMatchObject({ status: 404 });
    await expect(manager.screenshot(session.id, "workspace-b")).rejects.toMatchObject({ status: 404 });
  });

  it("supports visible login handoff actions and screenshots", async () => {
    const fake = fakeChromium();
    const manager = new BrowserSessionManager({ chromium: fake.chromium, resolveHost: publicDns });
    const session = await manager.create({
      workspaceId: "workspace-a", destinationId: "destination-a",
      startUrl: "https://publisher.example/login", approvedHosts: ["publisher.example"]
    });
    await manager.act(session.id, "workspace-a", { type: "click", x: 240, y: 300 });
    await manager.act(session.id, "workspace-a", { type: "type", text: "user@example.org" });
    await manager.act(session.id, "workspace-a", { type: "paste", text: "A prepared editorial draft." });
    await manager.act(session.id, "workspace-a", { type: "press", key: "Tab" });
    expect(fake.page.mouse.click).toHaveBeenCalledWith(240, 300);
    expect(fake.page.keyboard.type).toHaveBeenCalledWith("user@example.org", { delay: 15 });
    expect(fake.page.keyboard.insertText).toHaveBeenCalledWith("A prepared editorial draft.");
    expect((await manager.screenshot(session.id, "workspace-a")).base64).toBe(Buffer.from("image").toString("base64"));
  });

  it("fills article title and body but never presses the publish button", async () => {
    const fake = fakeChromium();
    const manager = new BrowserSessionManager({ chromium: fake.chromium, resolveHost: publicDns });
    const session = await manager.create({
      workspaceId: "workspace-a", destinationId: "destination-a",
      startUrl: "https://publisher.example/new", approvedHosts: ["publisher.example"]
    });
    const result = await manager.fillArticle(session.id, "workspace-a", {
      title: "A researched article", body: "Article body", titleSelector: "#title", bodySelector: "[contenteditable=true]"
    });
    expect(fake.page.locatorMock.fill).toHaveBeenNthCalledWith(1, "A researched article");
    expect(fake.page.locatorMock.fill).toHaveBeenNthCalledWith(2, "Article body");
    expect(result.state).toBe("content-filled-awaiting-human-review");
  });

  it("rejects navigation to an unapproved host", async () => {
    const fake = fakeChromium();
    const manager = new BrowserSessionManager({ chromium: fake.chromium, resolveHost: publicDns });
    const session = await manager.create({
      workspaceId: "workspace-a", destinationId: "destination-a",
      startUrl: "https://publisher.example/new", approvedHosts: ["publisher.example"]
    });
    await expect(manager.act(session.id, "workspace-a", { type: "navigate", url: "https://attacker.example/" })).rejects.toMatchObject({ status: 403 });
  });

  it("closes the browser context and process", async () => {
    const fake = fakeChromium();
    const manager = new BrowserSessionManager({ chromium: fake.chromium, resolveHost: publicDns });
    const session = await manager.create({
      workspaceId: "workspace-a", destinationId: "destination-a",
      startUrl: "https://publisher.example/new", approvedHosts: ["publisher.example"]
    });
    await manager.close(session.id, "workspace-a");
    expect(fake.context.close).toHaveBeenCalledOnce();
    expect(fake.browser.close).toHaveBeenCalledOnce();
  });
});
