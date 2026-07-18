/**
 * El pipeline / HTTP no debe importar @repo/cuanto-cobro-core.
 * Solo módulos aislados de pricing (engine/adapter tests) y tests.
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const srcRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");

const PIPELINE_DIRS = [
  "pipeline",
  "processor",
  "simulate",
  "routes",
  "conversation",
  "intents",
  "memory",
  "server",
  "http",
  "response",
  "app",
  "quote-request",
];

function walkTsFiles(dir: string): string[] {
  const out: string[] = [];
  if (!statSync(dir, { throwIfNoEntry: false })?.isDirectory()) return out;
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      out.push(...walkTsFiles(full));
      continue;
    }
    if (name.endsWith(".ts") && !name.endsWith(".test.ts")) out.push(full);
  }
  return out;
}

const CORE_IMPORT = /from\s+["']@repo\/cuanto-cobro-core/;
/** Engine/dry-run no deben importarse desde HTTP/processor; el pipeline usa pricing/runtime. */
const ENGINE_OR_DRYRUN_IMPORT =
  /from\s+["'][^"']*pricing\/(?:cuanto-cobro-engine|offline|cli\/(?:run-)?pricing-dry-run)/;

const PUBLIC_SURFACE_DIRS = PIPELINE_DIRS.filter((d) => d !== "pipeline");

describe("pipeline — sin import directo de @repo/cuanto-cobro-core", () => {
  it("directorios de runtime público no importan el core", () => {
    const offenders: string[] = [];
    for (const dir of PIPELINE_DIRS) {
      const root = join(srcRoot, dir);
      for (const file of walkTsFiles(root)) {
        const text = readFileSync(file, "utf8");
        if (CORE_IMPORT.test(text)) {
          offenders.push(relative(srcRoot, file));
        }
      }
    }
    assert.deepEqual(offenders, []);
  });

  it("HTTP / processor / conversation no importan engine ni dry-run", () => {
    const offenders: string[] = [];
    for (const dir of PUBLIC_SURFACE_DIRS) {
      const root = join(srcRoot, dir);
      for (const file of walkTsFiles(root)) {
        const text = readFileSync(file, "utf8");
        if (
          ENGINE_OR_DRYRUN_IMPORT.test(text) ||
          /createCuantoCobroPricingEngine|runPricingDryRun/.test(text)
        ) {
          offenders.push(relative(srcRoot, file));
        }
      }
    }
    assert.deepEqual(offenders, []);
  });

  it("pipeline solo importa pricing/runtime (no engine ni core)", () => {
    const offenders: string[] = [];
    for (const file of walkTsFiles(join(srcRoot, "pipeline"))) {
      const text = readFileSync(file, "utf8");
      if (CORE_IMPORT.test(text) || ENGINE_OR_DRYRUN_IMPORT.test(text)) {
        offenders.push(relative(srcRoot, file));
      }
    }
    assert.deepEqual(offenders, []);
  });

  it("solo pricing/cuanto-cobro-engine importa el core en producción", () => {
    const offenders: string[] = [];
    for (const file of walkTsFiles(srcRoot)) {
      const rel = relative(srcRoot, file);
      if (rel.startsWith("pricing/cuanto-cobro-engine/")) {
        continue;
      }
      const text = readFileSync(file, "utf8");
      if (CORE_IMPORT.test(text)) {
        offenders.push(rel);
      }
    }
    assert.deepEqual(offenders, []);
  });
});
