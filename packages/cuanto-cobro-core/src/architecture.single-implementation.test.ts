/**
 * Detecta implementaciones duplicadas fuera del package.
 * Wrappers/reexports en apps/compramelafoto/lib/cuantocobro están permitidos.
 */
import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);

const SYMBOLS = [
  "export function calculateCuantoCobro",
  "export function getProfileMonthlyNeed",
  "export function getFullyLoadedHourlyRate",
  "export function computeRecommendedBusinessPrice",
  "export function roundCuantoCobroPrice",
  "export function calculateConceptCameraWear",
  "export function calculateQuoteItem",
];

function rg(pattern: string): string[] {
  try {
    const out = execSync(
      `rg -l --glob '!**/node_modules/**' --glob '!**/dist/**' --glob '!**/.next/**' ${JSON.stringify(pattern)} ${JSON.stringify(repoRoot)}`,
      { encoding: "utf8" },
    );
    return out
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
  } catch (err) {
    const e = err as { status?: number; stdout?: string };
    if (e.status === 1) return [];
    throw err;
  }
}

function isAllowedDuplicate(file: string): boolean {
  const rel = path.relative(repoRoot, file);
  if (rel.startsWith(`packages/cuanto-cobro-core${path.sep}`)) return true;
  // Wrappers CLF: solo reexport (archivo corto)
  if (rel.startsWith(`apps/compramelafoto/lib/cuantocobro${path.sep}`)) {
    return true;
  }
  return false;
}

describe("single implementation", () => {
  it("símbolos principales no se reimplementan fuera del core", () => {
    const offenders: string[] = [];
    for (const symbol of SYMBOLS) {
      for (const file of rg(symbol)) {
        if (!isAllowedDuplicate(file)) {
          offenders.push(`${path.relative(repoRoot, file)} → ${symbol}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
