import { existsSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadDotenvFiles } from "./load-dotenv.js";

describe("loadDotenvFiles", () => {
  const originalEnv = { ...process.env };
  let tempDir: string;

  afterEach(() => {
    process.env = { ...originalEnv };
    if (tempDir) {
      // temp cleaned on OS schedule
    }
  });

  it("carga .env.local sin fallar si no existe", () => {
    tempDir = mkdtempSync(join(tmpdir(), "dnx-mcp-env-"));
    expect(() => {
      loadDotenvFiles(tempDir);
    }).not.toThrow();
  });

  it("aplica variables de .env.local con override sobre .env", () => {
    tempDir = mkdtempSync(join(tmpdir(), "dnx-mcp-env-"));
    writeFileSync(join(tempDir, ".env"), "GIT_REPO_PATH=/from-env\nLOG_LEVEL=info\n");
    writeFileSync(join(tempDir, ".env.local"), 'GIT_REPO_PATH="/from-local"\n');

    loadDotenvFiles(tempDir);

    expect(process.env.GIT_REPO_PATH).toBe("/from-local");
    expect(process.env.LOG_LEVEL).toBe("info");
  });

  it("no requiere que existan archivos en cwd de tests", () => {
    tempDir = mkdtempSync(join(tmpdir(), "dnx-mcp-env-empty-"));
    expect(existsSync(join(tempDir, ".env"))).toBe(false);
    expect(existsSync(join(tempDir, ".env.local"))).toBe(false);
    expect(() => {
      loadDotenvFiles(tempDir);
    }).not.toThrow();
  });
});
