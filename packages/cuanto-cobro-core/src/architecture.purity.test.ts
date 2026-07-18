/**
 * Verifica pureza del package: sin React/Next/Prisma/apps/browser storage.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const srcRoot = path.join(path.dirname(fileURLToPath(import.meta.url)));

const FORBIDDEN = [
  { name: "next", re: /from\s+["']next(?:\/|"|')|require\(\s*["']next/ },
  { name: "react", re: /from\s+["']react(?:\/|"|')|require\(\s*["']react/ },
  { name: "@prisma", re: /from\s+["']@prisma|require\(\s*["']@prisma/ },
  { name: "@repo/db", re: /from\s+["']@repo\/db|require\(\s*["']@repo\/db/ },
  { name: "next-auth", re: /from\s+["']next-auth|require\(\s*["']next-auth/ },
  { name: "apps/", re: /from\s+["'][^"']*apps\/|require\(\s*["'][^"']*apps\// },
  // Solo uso de API (comentarios legacy pueden mencionar el nombre).
  {
    name: "localStorage",
    re: /(?:window\.|globalThis\.)?localStorage\s*[.[\(]/,
  },
  {
    name: "sessionStorage",
    re: /(?:window\.|globalThis\.)?sessionStorage\s*[.[\(]/,
  },
];

function walkTs(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    if (name === "__fixtures__") continue;
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) {
      out.push(...walkTs(full));
      continue;
    }
    if (name.endsWith(".ts") && !name.endsWith(".test.ts")) out.push(full);
  }
  return out;
}

describe("package purity", () => {
  it("src de producción no importa deps prohibidas", () => {
    const offenders: string[] = [];
    for (const file of walkTs(srcRoot)) {
      const text = readFileSync(file, "utf8");
      for (const rule of FORBIDDEN) {
        if (rule.re.test(text)) {
          offenders.push(`${path.relative(srcRoot, file)} → ${rule.name}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
