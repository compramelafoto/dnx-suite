import { PRICING_REVIEW_SCENARIOS } from "../scenarios/catalog.js";
import { runPricingReview } from "../adapters/run-pricing-review.js";

export async function runPricingReviewReport(): Promise<{
  exitCode: number;
  lines: string[];
}> {
  const lines = [
    "DNX pricing-review:report",
    `Total escenarios: ${PRICING_REVIEW_SCENARIOS.length}`,
    "",
  ];

  const byStatus: Record<string, number> = {};
  for (const scenario of PRICING_REVIEW_SCENARIOS) {
    const { review } = await runPricingReview({
      draft: scenario.draft,
      useSynthetic: scenario.useSynthetic === true && !scenario.skipConfig,
      skipConfig: scenario.skipConfig,
      syntheticProfileOverrides: scenario.syntheticProfileOverrides,
      forceEngineFailure: scenario.forceEngineFailure,
      hints: scenario.hints,
      amountsVisible: false,
    });
    byStatus[review.status] = (byStatus[review.status] ?? 0) + 1;
    lines.push(
      `${scenario.id.padEnd(36)} ${review.status.padEnd(16)} components=${review.components.length}`,
    );
  }

  lines.push("");
  lines.push("Por estado:");
  for (const [status, count] of Object.entries(byStatus)) {
    lines.push(`  ${status}: ${count}`);
  }
  lines.push("");
  lines.push(
    "La revisión de presupuesto existe únicamente para verificar el funcionamiento del motor y la claridad de sus explicaciones antes de habilitar resultados económicos para usuarios.",
  );

  return { exitCode: 0, lines };
}
