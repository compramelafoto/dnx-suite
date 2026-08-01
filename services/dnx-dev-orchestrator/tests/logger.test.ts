import { describe, expect, it } from "vitest";
import { sanitizeMetadata } from "../src/logging/logger.js";

describe("logger sanitization", () => {
  it("redacts secret-like keys", () => {
    const sanitized = sanitizeMetadata({
      OPENAI_API_KEY: "sk-test-should-not-appear",
      CURSOR_API_KEY: "secret-value",
      taskId: "task-1",
    });
    expect(sanitized?.OPENAI_API_KEY).toBe("[REDACTED]");
    expect(sanitized?.CURSOR_API_KEY).toBe("[REDACTED]");
    expect(sanitized?.taskId).toBe("task-1");
  });
});
