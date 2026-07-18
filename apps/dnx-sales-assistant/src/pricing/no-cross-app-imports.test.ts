import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const srcRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

function walkTsFiles(dir: string): string[] {
  const out: string[] = [];
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

/** Detecta imports/requires hacia ComprameLaFoto (no menciones en comentarios de docs). */
const IMPORT_PATTERNS = [
  /from\s+["'][^"']*compramelafoto[^"']*["']/,
  /from\s+["']@\/lib\/cuantocobro/,
  /require\(\s*["'][^"']*compramelafoto[^"']*["']\s*\)/,
  /import\(\s*["'][^"']*compramelafoto[^"']*["']\s*\)/,
];

describe("arquitectura — sin imports cruzados a ComprameLaFoto", () => {
  it("ningún módulo de producción importa ComprameLaFoto", () => {
    const offenders: string[] = [];
    for (const file of walkTsFiles(srcRoot)) {
      const text = readFileSync(file, "utf8");
      for (const pattern of IMPORT_PATTERNS) {
        if (pattern.test(text)) {
          offenders.push(`${relative(srcRoot, file)} → ${pattern}`);
        }
      }
    }
    assert.deepEqual(offenders, []);
  });
});
