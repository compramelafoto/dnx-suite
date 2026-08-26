/**
 * Suspende análisis PENDING/PROCESSING de fotos más viejas que N días.
 *
 * Uso:
 *   npx tsx scripts/suspend-old-analysis.ts 7
 */
import { loadAnalysisEnv } from "./load-env-for-analysis";
loadAnalysisEnv();

async function main() {
  const days = Number(process.argv[2] || "7");
  if (!Number.isFinite(days) || days < 1) {
    throw new Error("Uso: npx tsx scripts/suspend-old-analysis.ts <days>");
  }
  const { suspendOldPendingAnalysis } = await import(
    "../lib/analysis/suspend-old-pending"
  );
  const result = await suspendOldPendingAnalysis(Math.floor(days));
  console.log(JSON.stringify(result, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
