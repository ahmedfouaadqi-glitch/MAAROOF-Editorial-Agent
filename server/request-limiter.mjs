export function createRequestLimiter({
  windowMs = 60_000,
  limits = { read: 240, write: 60, preflight: 600 },
  maxEntries = 10_000,
  now = () => Date.now()
} = {}) {
  if (!Number.isSafeInteger(windowMs) || windowMs < 1) throw new TypeError("windowMs must be a positive integer");
  if (!Number.isSafeInteger(maxEntries) || maxEntries < 1) throw new TypeError("maxEntries must be a positive integer");
  const entries = new Map();

  function consume(key, bucket) {
    const limit = limits[bucket];
    if (typeof key !== "string" || !key || !Number.isSafeInteger(limit) || limit < 1) {
      throw new TypeError("A request key and configured positive limit are required");
    }
    const timestamp = now();
    let entry = entries.get(key);
    if (entry && timestamp - entry.startedAt >= windowMs) {
      entries.delete(key);
      entry = undefined;
    }
    if (!entry) {
      if (entries.size >= maxEntries) {
        for (const [candidate, value] of entries) {
          if (timestamp - value.startedAt >= windowMs) entries.delete(candidate);
          if (entries.size < maxEntries) break;
        }
        if (entries.size >= maxEntries) return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil(windowMs / 1000)) };
      }
      entry = { startedAt: timestamp, count: 0 };
      entries.set(key, entry);
    }
    if (entry.count >= limit) {
      return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((entry.startedAt + windowMs - timestamp) / 1000)) };
    }
    entry.count += 1;
    entries.set(key, entry);
    return { allowed: true, retryAfterSeconds: 0 };
  }

  return { consume, get activeKeys() { return entries.size; } };
}
