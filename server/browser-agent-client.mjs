function fail(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

export function createBrowserAgentClient({
  baseUrl = process.env.BROWSER_AGENT_URL || "http://127.0.0.1:8788",
  token = process.env.BROWSER_AGENT_TOKEN || "",
  fetchImpl = globalThis.fetch,
  timeoutMs = 45_000
} = {}) {
  let base;
  try { base = new URL(baseUrl); } catch { fail("BROWSER_AGENT_URL must be a valid URL", 500); }
  const hostname = base.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  const loopback = hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  if (!["http:", "https:"].includes(base.protocol) || base.username || base.password || base.search || base.hash || base.pathname !== "/") {
    fail("BROWSER_AGENT_URL must be an origin URL without credentials, path, query, or fragment", 500);
  }
  if (base.protocol === "http:" && !loopback) fail("Non-loopback browser agents must use HTTPS", 500);

  return async function browserAgentRequest(path, { method = "GET", body } = {}) {
    if (typeof token !== "string" || token.length < 32) fail("BROWSER_AGENT_TOKEN must contain at least 32 characters", 503);
    if (typeof fetchImpl !== "function") fail("Browser agent transport is unavailable", 503);
    if (typeof path !== "string" || !path.startsWith("/internal/workspaces/") || path.includes("..")) {
      fail("Invalid browser agent route", 400);
    }

    let response;
    try {
      response = await fetchImpl(new URL(path, base), {
        method,
        headers: {
          authorization: `Bearer ${token}`,
          ...(body === undefined ? {} : { "content-type": "application/json" })
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: AbortSignal.timeout(timeoutMs)
      });
    } catch {
      fail("Browser agent is unavailable; start the private browser worker", 503);
    }

    let payload;
    try { payload = await response.json(); } catch { fail("Browser agent returned an invalid response", 502); }
    if (!response.ok) {
      const error = new Error(typeof payload.error === "string" ? payload.error : "Browser agent request failed");
      error.status = response.status >= 400 && response.status < 500 ? response.status : 502;
      throw error;
    }
    return payload;
  };
}
