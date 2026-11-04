import { isIP } from "node:net";

const BASE_URL = "https://api.firecrawl.dev/v2";
const MAX_MARKDOWN_CHARS = 120_000;

function fail(message, status = 502) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

export function validateScrapeTarget(input) {
  let url;
  try { url = new URL(input); } catch { fail("A valid source URL is required", 400); }
  if (!["http:", "https:"].includes(url.protocol)) fail("Only HTTP(S) source URLs are accepted", 400);
  if (url.username || url.password) fail("URLs containing credentials are not accepted", 400);
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!host || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) {
    fail("Local or internal hostnames cannot be scraped", 400);
  }
  // Literal IP targets are intentionally rejected. Firecrawl resolves hostnames remotely,
  // so this guard is not a complete DNS-rebinding defense; destination policy checks remain required.
  if (isIP(host)) fail("Literal IP addresses cannot be scraped; use a public website hostname", 400);
  url.hash = "";
  return url.toString();
}

function mapSearchRows(payload) {
  if (Array.isArray(payload?.web)) return payload.web;
  if (Array.isArray(payload?.data?.web)) return payload.data.web;
  if (Array.isArray(payload?.results)) return payload.results;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

export function createFirecrawlProvider({
  apiKey = process.env.FIRECRAWL_API_KEY,
  fetchImpl = globalThis.fetch,
  timeoutMs = 25_000
} = {}) {
  if (typeof apiKey !== "string" || !apiKey.trim()) return null;
  if (typeof fetchImpl !== "function") throw new Error("A fetch implementation is required");

  async function post(path, body) {
    const response = await fetchImpl(BASE_URL + path, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
      redirect: "error"
    }).catch(error => {
      if (error?.name === "TimeoutError" || error?.name === "AbortError") fail("Firecrawl request timed out", 504);
      fail("Firecrawl could not be reached", 502);
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) fail("Firecrawl authentication or account access failed", 502);
      if (response.status === 429) fail("Firecrawl rate or account quota limit reached", 429);
      if (response.status === 402) fail("Firecrawl account requires credits or an active plan", 402);
      fail("Firecrawl returned HTTP " + response.status, 502);
    }

    let payload;
    try { payload = await response.json(); } catch { fail("Firecrawl returned invalid JSON", 502); }
    if (payload?.success === false) fail("Firecrawl reported that the operation failed", 502);
    return payload;
  }

  return {
    id: "firecrawl-v2",
    async search(request) {
      const payload = await post("/search", {
        query: request.query,
        limit: Math.min(request.limit, 20),
        sources: [{ type: "web" }],
        ignoreInvalidURLs: true
      });
      return {
        results: mapSearchRows(payload).map(item => ({
          url: item.url,
          title: item.title,
          snippet: item.description || item.snippet || item.markdown || "",
          publisher: item.metadata?.sourceURL ? new URL(item.metadata.sourceURL).hostname : "",
          publishedAt: item.metadata?.publishedTime || item.publishedDate || null
        }))
      };
    },
    async scrape(inputUrl) {
      const url = validateScrapeTarget(inputUrl);
      const payload = await post("/scrape", {
        url,
        formats: [{ type: "markdown" }],
        onlyMainContent: true,
        timeout: timeoutMs
      });
      const data = payload?.data || payload;
      const markdown = typeof data?.markdown === "string" ? data.markdown : "";
      if (!markdown.trim()) fail("Firecrawl did not return readable Markdown content", 502);
      if (markdown.length > MAX_MARKDOWN_CHARS) fail("Scraped page exceeded the configured content size limit", 413);
      const metadata = data?.metadata || {};
      return {
        url: typeof metadata.sourceURL === "string" ? validateScrapeTarget(metadata.sourceURL) : url,
        title: typeof metadata.title === "string" ? metadata.title.slice(0, 500) : "",
        description: typeof metadata.description === "string" ? metadata.description.slice(0, 2000) : "",
        language: typeof metadata.language === "string" ? metadata.language.slice(0, 30) : "",
        markdown,
        retrievedAt: new Date().toISOString(),
        provider: "firecrawl-v2",
        verificationState: "scraped-content-unverified",
        limitations: [
          "Scraping confirms only that content was retrieved, not that its claims are accurate.",
          "Editorial review and claim-to-evidence assessment are still required.",
          "Some sites may block access, require login, or return incomplete content."
        ]
      };
    }
  };
}
