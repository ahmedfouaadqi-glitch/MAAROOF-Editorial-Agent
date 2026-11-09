import { describe, expect, it } from "vitest";
import { isAllowedOrigin, parseAllowedOrigins } from "./cors-origins.mjs";

describe("CORS origin allowlist", () => {
  it("parses multiple exact origins and normalizes trailing slashes", () => {
    expect(parseAllowedOrigins("https://editor.lovable.app/, https://editor.example.com")).toEqual(
      new Set(["https://editor.lovable.app", "https://editor.example.com"])
    );
  });

  it("matches only an explicitly configured origin", () => {
    const allowed = parseAllowedOrigins("https://editor.lovable.app,https://editor.example.com");
    expect(isAllowedOrigin("https://editor.lovable.app", allowed)).toBe(true);
    expect(isAllowedOrigin("https://evil.lovable.app", allowed)).toBe(false);
    expect(isAllowedOrigin("https://editor.lovable.app.attacker.test", allowed)).toBe(false);
    expect(isAllowedOrigin("null", allowed)).toBe(false);
  });

  it("rejects paths, credentials, wildcards, and non-HTTP protocols", () => {
    expect(() => parseAllowedOrigins("https://editor.example.com/app")).toThrow(/exact HTTP\(S\) origins/);
    expect(() => parseAllowedOrigins("https://user:secret@editor.example.com")).toThrow(/exact HTTP\(S\) origins/);
    expect(() => parseAllowedOrigins("https://*.lovable.app")).toThrow();
    expect(() => parseAllowedOrigins("file:///tmp/app")).toThrow(/exact HTTP\(S\) origins/);
  });

  it("requires at least one configured origin", () => {
    expect(() => parseAllowedOrigins(" , ")).toThrow(/at least one exact origin/);
    expect(() => parseAllowedOrigins("")).toThrow(/comma-separated HTTP\(S\) origins/);
  });
});
