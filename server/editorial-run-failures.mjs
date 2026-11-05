const RETRYABLE_HTTP_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);
const RETRYABLE_CODES = new Set(["ECONNRESET", "ECONNREFUSED", "EAI_AGAIN", "ETIMEDOUT", "UND_ERR_CONNECT_TIMEOUT", "UND_ERR_HEADERS_TIMEOUT"]);

/** Normalize failures without persisting provider messages, URLs, or credentials. */
export function classifyEditorialRunFailure(error) {
  const status = Number.isSafeInteger(error?.status) ? error.status : null;
  const code = typeof error?.code === "string" ? error.code.slice(0, 64) : "";
  if (status !== null) {
    return { code: "http-" + status, category: status === 429 ? "rate-limit" : status >= 500 ? "provider-or-server" : "request", retryable: RETRYABLE_HTTP_STATUSES.has(status), status };
  }
  if (RETRYABLE_CODES.has(code)) return { code: "transient-network-error", category: "network", retryable: true };
  if (error?.name === "SyntaxError") return { code: "invalid-provider-response", category: "provider-response", retryable: false };
  return { code: "editorial-run-failed", category: "unknown", retryable: false };
}
