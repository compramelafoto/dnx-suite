import { PRICING_REVIEW_SCENARIOS } from "../scenarios/catalog.js";
import { runPricingReview } from "../adapters/run-pricing-review.js";
import { DANI_PRICING_EXPLANATION_VERSION } from "../explanation/dani-pricing-explanation-v1.js";

export async function runPricingReviewValidate(): Promise<{
  exitCode: number;
  lines: string[];
}> {
  const lines: string[] = [
    "DNX pricing-review:validate",
    `Escenarios: ${PRICING_REVIEW_SCENARIOS.length}`,
    `Explicación: ${DANI_PRICING_EXPLANATION_VERSION}`,
  ];

  let failed = 0;
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

    const expected = scenario.expectStatus ?? [];
    const ok =
      expected.length === 0 || expected.includes(review.status);
    if (!ok) {
      failed += 1;
      lines.push(
        `FAIL ${scenario.id}: status=${review.status} expected=${expected.join("|")}`,
      );
    } else {
      lines.push(`OK ${scenario.id}: ${review.status}`);
    }

    if (review.result && review.amountsVisible) {
      failed += 1;
      lines.push(`FAIL ${scenario.id}: amounts visibles por defecto`);
    }
  }

  lines.push(failed === 0 ? "Resultado: OK" : `Resultado: ${failed} fallos`);
  return { exitCode: failed === 0 ? 0 : 1, lines };
}
