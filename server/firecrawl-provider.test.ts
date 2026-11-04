import { describe, expect, it, vi } from "vitest";
import { createFirecrawlProvider, validateScrapeTarget } from "./firecrawl-provider.mjs";

function response(payload, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => payload };
}

describe("Firecrawl v2 provider", () => {
  it("stays disabled without a server-side key", () => {
    expect(createFirecrawlProvider({ apiKey: "" })).toBeNull();
  });

  it("rejects local, internal, credentialed and literal IP targets", () => {
    for (const url of [
      "http://localhost/admin",
      "http://127.0.0.1/",
      "http://192.168.1.10/",
      "http://169.254.169.254/latest/meta-data/",
      "https://user:pass@example.com/",
      "https://printer.local/"
    ]) expect(() => validateScrapeTarget(url)).toThrow();
  });

  it("normalizes a public HTTP URL and strips fragments", () => {
    expect(validateScrapeTarget("https://example.org/article#intro")).toBe("https://example.org/article");
  });

  it("uses the documented v2 search endpoint and maps results", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(response({
      success: true,
      web: [{ url: "https://example.org/a", title: "Article A", description: "Summary" }]
    }));
    const provider = createFirecrawlProvider({ apiKey: "test-key", fetchImpl });
    const result = await provider.search({ query: "editorial intelligence", limit: 5, language: "en", country: "IQ" });
    expect(fetchImpl.mock.calls[0][0]).toBe("https://api.firecrawl.dev/v2/search");
    expect(fetchImpl.mock.calls[0][1].headers.Authorization).toBe("Bearer test-key");
    expect(result.results[0]).toMatchObject({ title: "Article A", url: "https://example.org/a", snippet: "Summary" });
  });

  it("scrapes Markdown and marks it unverified", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(response({
      success: true,
      data: { markdown: "# Article\n\nBody", metadata: { title: "Article", sourceURL: "https://example.org/a" } }
    }));
    const provider = createFirecrawlProvider({ apiKey: "test-key", fetchImpl });
    const result = await provider.scrape("https://example.org/a#top");
    expect(fetchImpl.mock.calls[0][0]).toBe("https://api.firecrawl.dev/v2/scrape");
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body).formats).toEqual([{ type: "markdown" }]);
    expect(result.markdown).toContain("# Article");
    expect(result.verificationState).toBe("scraped-content-unverified");
  });

  it("maps provider account and rate errors without leaking the key", async () => {
    const provider = createFirecrawlProvider({ apiKey: "secret", fetchImpl: vi.fn().mockResolvedValue(response({}, 429)) });
    await expect(provider.scrape("https://example.org")).rejects.toMatchObject({ status: 429 });
  });
});
