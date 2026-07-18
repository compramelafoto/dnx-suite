import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const pricingRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

function walkTs(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      out.push(...walkTs(full));
      continue;
    }
    if (name.endsWith(".ts") && !name.endsWith(".test.ts")) out.push(full);
  }
  return out;
}

const FORBIDDEN = [
  /function\s+calculateCuantoCobro\b/,
  /getProfileMonthlyNeed\b/,
  /getProfileCostHour\b/,
  /computeRecommendedBusinessPrice\b/,
  /computeMinimumSustainablePrice\b/,
  /CUANTO_COBRO_RECOMMENDED_MULTIPLIER/,
  /Math\.max\s*\(\s*minimumSustainable/,
  /monthlyNeed\s*\/\s*monthlyHours/,
];

describe("anti-copia de fórmulas del motor", () => {
  it("src/pricing no contiene fórmulas de cálculo de ¿Cuánto Cobro?", () => {
    const offenders: string[] = [];
    for (const file of walkTs(pricingRoot)) {
      const text = readFileSync(file, "utf8");
      for (const pattern of FORBIDDEN) {
        if (pattern.test(text)) {
          offenders.push(`${relative(pricingRoot, file)} → ${pattern}`);
        }
      }
    }
    assert.deepEqual(offenders, []);
  });
});
