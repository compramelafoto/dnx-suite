import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL(".", import.meta.url));

const FORBIDDEN = [
  /compramelafoto/i,
  /#c27b3d/i,
  /\/api\/admin\/blog/,
  /@\//,
  /apps\//,
];

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    if (name.endsWith(".test.ts")) continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...walk(full));
    else if (/\.(ts|tsx|md|json)$/.test(name)) out.push(full);
  }
  return out;
}

describe("content-ui neutrality", () => {
  it("source tree has no CLF/brand/API hardcoding", () => {
    const files = [
      ...walk(ROOT).filter((f) => !f.endsWith("neutrality.test.ts")),
      join(ROOT, "..", "README.md"),
      join(ROOT, "..", "package.json"),
    ];
    assert.ok(files.length > 5, "expected package source files");

    const violations: string[] = [];
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      for (const pattern of FORBIDDEN) {
        if (pattern.test(text)) {
          violations.push(`${file}: matched ${pattern}`);
        }
      }
    }
    assert.deepEqual(violations, []);
  });
});
