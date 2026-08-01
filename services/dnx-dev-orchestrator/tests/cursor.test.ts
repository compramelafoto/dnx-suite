import { describe, expect, it } from "vitest";
import { CursorClient } from "../src/cursor/client.js";
import { findCursorAgentBinary } from "../src/cursor/discovery.js";

describe("cursor binary discovery", () => {
  it("prefers env binary when present", async () => {
    const discovery = await findCursorAgentBinary("/custom/agent", {
      whichFn: async () => null,
      pathExistsFn: async (path) => path === "/custom/agent",
      homeDir: "/home/test",
    });
    expect(discovery.found).toBe(true);
    expect(discovery.path).toBe("/custom/agent");
    expect(discovery.source).toBe("env");
  });

  it("falls back to ~/.local/bin/agent", async () => {
    const discovery = await findCursorAgentBinary(undefined, {
      whichFn: async () => null,
      pathExistsFn: async (path) => path === "/home/test/.local/bin/agent",
      homeDir: "/home/test",
    });
    expect(discovery.found).toBe(true);
    expect(discovery.source).toBe("local-agent");
  });

  it("returns not found when nothing matches", async () => {
    const discovery = await findCursorAgentBinary(undefined, {
      whichFn: async () => null,
      pathExistsFn: async () => false,
      homeDir: "/home/test",
    });
    expect(discovery.found).toBe(false);
    expect(discovery.path).toBeNull();
  });
});

describe("cursor read-only fail-closed", () => {
  it("refuses when writeExecutionEnabled breaks read-only guarantee", async () => {
    const client = new CursorClient({
      writeExecutionEnabled: true,
      runner: async () => ({ code: 0, stdout: "ok", stderr: "", timedOut: false }),
    });
    const result = await client.askReadOnly({
      workspace: "/tmp",
      prompt: "should not run",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(["WRITE_DISABLED", "READ_ONLY_NOT_GUARANTEED"]).toContain(result.code);
    }
  });

  it("returns CURSOR_AUTH_REQUIRED when status is not authenticated", async () => {
    const client = new CursorClient({
      writeExecutionEnabled: false,
      resolveBinaryFn: async () => "/mock/agent",
      statusFn: async () => ({
        binary: { found: true, path: "/mock/agent", source: "env" },
        version: "2026.01.23",
        auth: "CURSOR_AUTH_REQUIRED",
        authDetail: "Cursor Agent reports not logged in.",
        loginHint: "Run manually: /mock/agent login",
      }),
      runner: async () => ({
        code: 0,
        stdout: "should-not-reach",
        stderr: "",
        timedOut: false,
      }),
    });

    const result = await client.askReadOnly({
      workspace: "/tmp",
      prompt: "explain something",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("CURSOR_AUTH_REQUIRED");
    }
  });
});
