/**
 * Resume divergencias de shadow mode desde un archivo de log local.
 *
 * Uso:
 *   npx tsx scripts/summarize-checkout-fee-shadow-logs.ts ./staging.log
 *   cat staging.log | npx tsx scripts/summarize-checkout-fee-shadow-logs.ts
 */
import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import { CHECKOUT_FEE_SHADOW_LOG_TAG } from "@/lib/pricing/checkout-fee-shadow";
import type { CheckoutFeeShadowLogPayload } from "@/lib/pricing/checkout-fee-shadow";

type Agg = {
  count: number;
  sumAbsDiffPercent: number;
  sumAbsDiffArs: number;
  diffArsCount: number;
  samples: CheckoutFeeShadowLogPayload[];
};

function parsePayloadFromLine(line: string): CheckoutFeeShadowLogPayload | null {
  if (!line.includes(CHECKOUT_FEE_SHADOW_LOG_TAG)) return null;
  const jsonStart = line.indexOf("{");
  if (jsonStart < 0) return null;
  try {
    const raw = line.slice(jsonStart);
    const parsed = JSON.parse(raw) as CheckoutFeeShadowLogPayload;
    if (typeof parsed.legacyFeePercent !== "number") return null;
    return parsed;
  } catch {
    return null;
  }
}

function aggregate(rows: CheckoutFeeShadowLogPayload[]) {
  const bySite = new Map<string, Agg>();
  const byFlow = new Map<string, Agg>();

  for (const row of rows) {
    for (const [map, key] of [
      [bySite, row.site] as const,
      [byFlow, row.flow] as const,
    ]) {
      const prev = map.get(key) ?? {
        count: 0,
        sumAbsDiffPercent: 0,
        sumAbsDiffArs: 0,
        diffArsCount: 0,
        samples: [],
      };
      prev.count += 1;
      prev.sumAbsDiffPercent += Math.abs(row.diffPercent);
      if (row.estimatedDiffArs != null) {
        prev.sumAbsDiffArs += Math.abs(row.estimatedDiffArs);
        prev.diffArsCount += 1;
      }
      if (prev.samples.length < 3) prev.samples.push(row);
      map.set(key, prev);
    }
  }

  return { bySite, byFlow, total: rows.length };
}

function printGroup(title: string, map: Map<string, Agg>) {
  console.log(`\n${title}`);
  console.log("-".repeat(72));
  const sorted = [...map.entries()].sort((a, b) => b[1].count - a[1].count);
  for (const [key, agg] of sorted) {
    const avgPct = (agg.sumAbsDiffPercent / agg.count).toFixed(2);
    const avgArs =
      agg.diffArsCount > 0
        ? Math.round(agg.sumAbsDiffArs / agg.diffArsCount)
        : "n/a";
    console.log(
      `${key.padEnd(40)} | n=${String(agg.count).padStart(4)} | avg |diff%|=${avgPct} | avg |diff ARS|=${avgArs}`
    );
  }
}

async function readLines(path?: string): Promise<string[]> {
  if (path) {
    const lines: string[] = [];
    const rl = createInterface({ input: createReadStream(path), crlfDelay: Infinity });
    for await (const line of rl) lines.push(line);
    return lines;
  }
  const chunks: string[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(String(chunk));
  }
  return chunks.join("").split("\n");
}

async function main() {
  const path = process.argv[2];
  const lines = await readLines(path);
  const rows = lines
    .map(parsePayloadFromLine)
    .filter((r): r is CheckoutFeeShadowLogPayload => r != null);

  if (rows.length === 0) {
    console.log("No se encontraron entradas", CHECKOUT_FEE_SHADOW_LOG_TAG);
    process.exit(0);
  }

  const { bySite, byFlow, total } = aggregate(rows);
  console.log("══════════════════════════════════════════════════════════════");
  console.log(" Resumen shadow mode — checkout fee divergences");
  console.log("══════════════════════════════════════════════════════════════");
  console.log(`Total divergencias parseadas: ${total}`);
  printGroup("Por site", bySite);
  printGroup("Por flow", byFlow);

  const top = [...rows].sort(
    (a, b) => Math.abs(b.estimatedDiffArs ?? 0) - Math.abs(a.estimatedDiffArs ?? 0)
  )[0];
  if (top) {
    console.log("\nMayor |estimatedDiffArs|:");
    console.log(JSON.stringify(top, null, 2));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
