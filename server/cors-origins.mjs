export function parseAllowedOrigins(value) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error("CORS_ORIGIN must contain one or more comma-separated HTTP(S) origins.");
  }

  const origins = new Set();
  for (const candidate of value.split(",").map(item => item.trim()).filter(Boolean)) {
    let parsed;
    try { parsed = new URL(candidate); }
    catch { throw new Error("CORS_ORIGIN contains an invalid origin."); }
    if (!["http:", "https:"].includes(parsed.protocol)
      || parsed.username || parsed.password || parsed.hostname.includes("*")
      || parsed.pathname !== "/" || parsed.search || parsed.hash) {
      throw new Error("CORS_ORIGIN entries must be exact HTTP(S) origins without credentials, paths, queries, or fragments.");
    }
    origins.add(parsed.origin);
  }
  if (!origins.size) throw new Error("CORS_ORIGIN must contain at least one exact origin.");
  return origins;
}

export function isAllowedOrigin(origin, allowedOrigins) {
  return typeof origin === "string" && allowedOrigins instanceof Set && allowedOrigins.has(origin);
}
