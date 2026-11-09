import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const mainEntry = fileURLToPath(new URL("./main.mjs", import.meta.url));

describe("API network binding guard", () => {
  it("refuses a non-loopback bind unless remote exposure is explicitly enabled", () => {
    const result = spawnSync(process.execPath, [mainEntry], {
      encoding: "utf8",
      timeout: 5_000,
      env: {
        ...process.env,
        HOST: "0.0.0.0",
        PORT: "18787",
        ADMIN_API_TOKEN: "a".repeat(64),
        API_ALLOW_REMOTE: "false",
        DATA_FILE: "/tmp/editorial-agent-binding-guard-test.json",
        MEDIA_DIR: "/tmp/editorial-agent-binding-guard-test-media",
      },
    });

    expect(result.error).toBeUndefined();
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("API_ALLOW_REMOTE=true");
  });
});
