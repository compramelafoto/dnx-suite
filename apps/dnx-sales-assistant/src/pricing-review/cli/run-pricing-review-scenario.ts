import { getPricingReviewScenario } from "../scenarios/catalog.js";
import { runPricingReview } from "../adapters/run-pricing-review.js";
import { sanitizePricingReviewForLab } from "../sanitization/sanitize-pricing-review.js";

export async function runPricingReviewScenario(scenarioId: string): Promise<{
  exitCode: number;
  lines: string[];
}> {
  const scenario = getPricingReviewScenario(scenarioId);
  if (!scenario) {
    return {
      exitCode: 1,
      lines: [`Escenario no encontrado: ${scenarioId}`],
    };
  }

  const { review, configSource, usedSynthetic } = await runPricingReview({
    draft: scenario.draft,
    useSynthetic: scenario.useSynthetic === true && !scenario.skipConfig,
    skipConfig: scenario.skipConfig,
    syntheticProfileOverrides: scenario.syntheticProfileOverrides,
    forceEngineFailure: scenario.forceEngineFailure,
    hints: scenario.hints,
    amountsVisible: false,
  });

  const safe = sanitizePricingReviewForLab(review, { revealAmounts: false });
  const lines = [
    `Escenario: ${scenario.id} — ${scenario.title}`,
    `Estado: ${safe.status}`,
    `Config: ${configSource}${usedSynthetic ? " (TEST_ONLY_SYNTHETIC_PROFILE)" : ""}`,
    `Versión motor: ${safe.calculationVersion ?? "—"}`,
    `Versión explicación: ${safe.explanationVersion}`,
    "Campos utilizados:",
    ...safe.inputSummary.fields.map(
      (f) => `  - [${f.origin}] ${f.label}: ${f.valueDescription}`,
    ),
    "Faltantes:",
    ...(safe.missingInformation.length
      ? safe.missingInformation.map(
          (m) =>
            `  - ${m.label} · ${m.expectedOrigin} · Acción: ${m.action}`,
        )
      : ["  - (ninguno)"]),
    "Supuestos:",
    ...(safe.assumptions.length
      ? safe.assumptions.map((a) => `  - ${a.label}: ${a.valueDescription}`)
      : ["  - (ninguno)"]),
    "Resultados:",
    safe.result
      ? `  - Moneda: ${safe.result.currency} · Factor: ${safe.result.commercialFactor} · Importes: ocultos (sin reveal)`
      : "  - (sin resultado numérico)",
    "Explicación Dani:",
    `  ${safe.explanationDani}`,
    "Advertencias:",
    ...(safe.warnings.length
      ? safe.warnings.map((w) => `  - [${w.severity}] ${w.message}`)
      : ["  - (ninguna)"]),
  ];

  return { exitCode: 0, lines };
}
