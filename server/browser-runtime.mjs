import { randomUUID } from "node:crypto";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

function fail(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

function ipv4Number(value) {
  return value.split(".").reduce((acc, part) => (acc << 8n) + BigInt(Number(part)), 0n);
}
function inV4Cidr(value, base, prefix) {
  const mask = (0xffffffffn << BigInt(32 - prefix)) & 0xffffffffn;
  return (ipv4Number(value) & mask) === (ipv4Number(base) & mask);
}
function ipv6Number(value) {
  let input = value.toLowerCase();
  if (input.includes(".")) {
    const index = input.lastIndexOf(":");
    const ipv4 = input.slice(index + 1);
    if (isIP(ipv4) !== 4) return null;
    const n = ipv4Number(ipv4);
    input = input.slice(0, index + 1) + Number((n >> 16n) & 0xffffn).toString(16) + ":" + Number(n & 0xffffn).toString(16);
  }
  const halves = input.split("::");
  if (halves.length > 2) return null;
  const left = halves[0] ? halves[0].split(":") : [];
  const right = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const missing = 8 - left.length - right.length;
  if ((halves.length === 1 && missing !== 0) || (halves.length === 2 && missing < 1)) return null;
  const groups = [...left, ...Array(missing).fill("0"), ...right];
  if (groups.length !== 8 || groups.some(x => !/^[0-9a-f]{1,4}$/.test(x))) return null;
  return BigInt("0x" + groups.map(x => x.padStart(4, "0")).join(""));
}
function isPublicIp(address) {
  const family = isIP(address);
  if (family === 4) {
    return ![
      ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10],
      ["127.0.0.0", 8], ["169.254.0.0", 16], ["172.16.0.0", 12],
      ["192.0.0.0", 24], ["192.0.2.0", 24], ["192.88.99.0", 24],
      ["192.168.0.0", 16], ["198.18.0.0", 15], ["198.51.100.0", 24],
      ["203.0.113.0", 24], ["224.0.0.0", 4], ["240.0.0.0", 4]
    ].some(([base, prefix]) => inV4Cidr(address, base, prefix));
  }
  if (family !== 6) return false;
  const value = ipv6Number(address);
  if (value === null) return false;
  const prefix = (bits, base) => (value >> BigInt(128 - bits)) === BigInt(base);
  if (value === 0n || value === 1n) return false;
  // Permit only global-unicast IPv6 (2000::/3), then exclude special-purpose ranges.
  if ((value >> 125n) !== 1n) return false;
  if (prefix(7, 0x7en) || prefix(10, 0x3fan) || prefix(8, 0xffn)
    || prefix(32, 0x20010db8n) || prefix(16, 0x2002n) || prefix(32, 0x20010000n)) return false;
  return true;
}

function normalizeAllowedHosts(value) {
  if (!Array.isArray(value) || value.length < 1 || value.length > 12) fail("Destination must define between 1 and 12 approved hosts");
  const hosts = value.map(item => String(item).trim().toLowerCase().replace(/^\*\./, ""));
  if (hosts.some(host => !host || host.length > 253 || /[^a-z0-9.-]/.test(host) || host.startsWith(".") || host.endsWith(".") || host.includes(".."))) {
    fail("Approved hosts must be valid DNS hostnames");
  }
  return [...new Set(hosts)];
}

function hostAllowed(host, approvedHosts) {
  const value = host.toLowerCase().replace(/^\[|\]$/g, "");
  return approvedHosts.some(allowed => value === allowed || value.endsWith("." + allowed));
}

export async function validatePublicUrl(input, approvedHosts, { resolveHost = lookup, requireApprovedHost = true } = {}) {
  let url;
  try { url = new URL(input); } catch { fail("A valid destination URL is required", 400); }
  if (url.protocol !== "https:" || url.username || url.password) fail("Browser publishing accepts HTTPS URLs without embedded credentials only", 400);
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (requireApprovedHost && !hostAllowed(host, approvedHosts)) fail("Navigation is outside the approved destination hosts", 403);
  if (isIP(host)) {
    if (!isPublicIp(host)) fail("Private or reserved IP targets are blocked", 403);
  } else {
    let addresses;
    try { addresses = await resolveHost(host, { all: true, verbatim: true }); }
    catch { fail("Destination DNS resolution failed; navigation was blocked", 502); }
    if (!Array.isArray(addresses) || addresses.length === 0 || addresses.some(entry => !isPublicIp(entry.address))) {
      fail("Destination resolves to a private or reserved IP; navigation was blocked", 403);
    }
  }
  url.hash = "";
  return url;
}

const ACTIONS = new Set(["click", "type", "press", "scroll", "fill", "navigate"]);
const SAFE_KEYS = new Set(["Enter", "Tab", "Escape", "Backspace", "Delete", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End", "Space"]);
const MAX_TEXT = 200_000;

export class BrowserSessionManager {
  constructor({ chromium, resolveHost = lookup, now = () => Date.now(), ttlMs = 60 * 60 * 1000, maxSessionsPerWorkspace = 2 }) {
    if (!chromium || typeof chromium.launch !== "function") throw new Error("Playwright Chromium is required");
    this.chromium = chromium;
    this.resolveHost = resolveHost;
    this.now = now;
    this.ttlMs = ttlMs;
    this.maxSessionsPerWorkspace = maxSessionsPerWorkspace;
    this.sessions = new Map();
  }

  async create({ workspaceId, destinationId, startUrl, approvedHosts }) {
    if (typeof workspaceId !== "string" || !workspaceId.trim() || workspaceId.length > 128) fail("workspaceId is required");
    if (typeof destinationId !== "string" || !destinationId.trim() || destinationId.length > 128) fail("destinationId is required");
    const activeCount = [...this.sessions.values()].filter(item => item.workspaceId === workspaceId && item.expiresAt > this.now()).length;
    if (activeCount >= this.maxSessionsPerWorkspace) fail("The active browser session limit for this workspace has been reached", 429);
    const hosts = normalizeAllowedHosts(approvedHosts);
    const target = await validatePublicUrl(startUrl, hosts, { resolveHost: this.resolveHost });
    const browser = await this.chromium.launch({ headless: true });
    try {
      const context = await browser.newContext({
        viewport: { width: 1440, height: 1000 },
        acceptDownloads: false,
        serviceWorkers: "block"
      });
      await context.route("**/*", async route => {
        try {
          const request = route.request();
          const raw = request.url();
          if (/^(about:|data:|blob:)/i.test(raw)) return route.continue();
          const navigation = request.isNavigationRequest();
          const url = await validatePublicUrl(raw, hosts, { resolveHost: this.resolveHost, requireApprovedHost: navigation });
          if (navigation && !hostAllowed(url.hostname, hosts)) return route.abort("blockedbyclient");
          return route.continue();
        } catch {
          return route.abort("blockedbyclient");
        }
      });
      const page = await context.newPage();
      page.setDefaultTimeout(12_000);
      await page.goto(target.toString(), { waitUntil: "domcontentloaded", timeout: 30_000 });
      const id = randomUUID();
      const createdAt = this.now();
      const session = {
        id, workspaceId, destinationId, approvedHosts: hosts,
        browser, context, page, createdAt, lastActiveAt: createdAt,
        expiresAt: createdAt + this.ttlMs, state: "waiting-for-user",
        currentUrl: page.url(), title: await page.title().catch(() => ""),
        lastError: null
      };
      this.sessions.set(id, session);
      return this.publicSession(session);
    } catch (error) {
      await browser.close().catch(() => {});
      throw error;
    }
  }

  get(id, workspaceId) {
    const session = this.sessions.get(id);
    if (!session || session.workspaceId !== workspaceId) fail("Browser session not found", 404);
    if (session.expiresAt <= this.now()) {
      void this.close(id, workspaceId);
      fail("Browser session expired; create a new session", 410);
    }
    session.lastActiveAt = this.now();
    return session;
  }

  publicSession(session) {
    return {
      id: session.id, workspaceId: session.workspaceId, destinationId: session.destinationId,
      state: session.state, currentUrl: session.currentUrl, title: session.title,
      createdAt: new Date(session.createdAt).toISOString(),
      expiresAt: new Date(session.expiresAt).toISOString(),
      lastError: session.lastError
    };
  }

  async status(id, workspaceId) {
    const session = this.get(id, workspaceId);
    session.currentUrl = session.page.url();
    session.title = await session.page.title().catch(() => "");
    return this.publicSession(session);
  }

  async screenshot(id, workspaceId) {
    const session = this.get(id, workspaceId);
    const image = await session.page.screenshot({ type: "jpeg", quality: 72, fullPage: false, timeout: 10_000 });
    return { contentType: "image/jpeg", base64: image.toString("base64") };
  }

  async act(id, workspaceId, input) {
    const session = this.get(id, workspaceId);
    if (!input || !ACTIONS.has(input.type)) fail("Unsupported browser action");
    const page = session.page;
    try {
      if (input.type === "click") {
        const x = Number(input.x), y = Number(input.y);
        if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0 || x > 1440 || y > 1000) fail("Click coordinates are outside the browser viewport");
        await page.mouse.click(x, y);
      } else if (input.type === "type") {
        if (typeof input.text !== "string" || input.text.length > 4000) fail("Typed text must be 1-4000 characters");
        await page.keyboard.type(input.text, { delay: 15 });
      } else if (input.type === "press") {
        if (!SAFE_KEYS.has(input.key)) fail("Unsupported keyboard key");
        await page.keyboard.press(input.key);
      } else if (input.type === "scroll") {
        const deltaY = Number(input.deltaY);
        if (!Number.isFinite(deltaY) || Math.abs(deltaY) > 1200) fail("Scroll distance must be between -1200 and 1200");
        await page.mouse.wheel(0, deltaY);
      } else if (input.type === "fill") {
        const selector = typeof input.selector === "string" ? input.selector.trim() : "";
        const value = typeof input.value === "string" ? input.value : "";
        if (!selector || selector.length > 500 || value.length > MAX_TEXT) fail("A selector and bounded text value are required");
        const locator = page.locator(selector).first();
        if (await locator.count() < 1 || !await locator.isVisible()) fail("The configured field selector is not visible", 409);
        await locator.fill(value);
      } else if (input.type === "navigate") {
        const target = await validatePublicUrl(input.url, session.approvedHosts, { resolveHost: this.resolveHost });
        await page.goto(target.toString(), { waitUntil: "domcontentloaded", timeout: 30_000 });
      }
      session.currentUrl = page.url();
      session.title = await page.title().catch(() => "");
      session.lastError = null;
      session.state = "user-controlled";
      return this.publicSession(session);
    } catch (error) {
      session.lastError = error.message;
      throw error;
    }
  }

  async fillArticle(id, workspaceId, { title, body, titleSelector, bodySelector }) {
    const session = this.get(id, workspaceId);
    if (typeof title !== "string" || !title.trim() || title.length > 500) fail("Article title must contain 1-500 characters");
    if (typeof body !== "string" || !body.trim() || body.length > MAX_TEXT) fail("Article body must contain 1-200000 characters");
    for (const selector of [titleSelector, bodySelector]) {
      if (typeof selector !== "string" || !selector.trim() || selector.length > 500) fail("Destination title/body selectors must be configured first");
    }
    const titleField = session.page.locator(titleSelector).first();
    const bodyField = session.page.locator(bodySelector).first();
    if (await titleField.count() < 1 || !await titleField.isVisible()) fail("The title selector is not visible on the current page", 409);
    if (await bodyField.count() < 1 || !await bodyField.isVisible()) fail("The article body selector is not visible on the current page", 409);
    await titleField.fill(title);
    await bodyField.fill(body);
    session.currentUrl = session.page.url();
    session.title = await session.page.title().catch(() => "");
    session.lastError = null;
    session.state = "content-filled-awaiting-human-review";
    return this.publicSession(session);
  }

  async close(id, workspaceId) {
    const session = this.sessions.get(id);
    if (!session || session.workspaceId !== workspaceId) return { closed: true, alreadyClosed: true };
    this.sessions.delete(id);
    await session.context.close().catch(() => {});
    await session.browser.close().catch(() => {});
    return { closed: true, alreadyClosed: false };
  }

  async closeExpired() {
    for (const session of this.sessions.values()) {
      if (session.expiresAt <= this.now()) await this.close(session.id, session.workspaceId);
    }
  }
}
