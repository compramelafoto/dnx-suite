import type { QuoteRequestDraft } from "../../quote-request/models.js";
import type { PricingReviewHints } from "../adapters/review-hints.js";
import type { PricingProfile } from "../../pricing/models.js";

export type PricingReviewScenario = {
  id: string;
  title: string;
  description: string;
  draft?: QuoteRequestDraft;
  hints?: PricingReviewHints;
  useSynthetic?: boolean;
  syntheticProfileOverrides?: Partial<PricingProfile>;
  forceEngineFailure?: boolean;
  /** Si true, no usa perfil (NOT_CONFIGURED). */
  skipConfig?: boolean;
  expectStatus?: Array<
    "READY" | "INCOMPLETE" | "FAILED" | "NOT_CONFIGURED"
  >;
};

export const PRICING_REVIEW_SCENARIOS: PricingReviewScenario[] = [
  {
    id: "pr-wedding-complete",
    title: "Casamiento completo",
    description: "Casamiento con duración y ciudad.",
    useSynthetic: true,
    draft: {
      serviceType: "WEDDING",
      eventDate: "2026-11-20",
      city: "Rosario",
      durationHours: 8,
    },
    expectStatus: ["READY"],
  },
  {
    id: "pr-wedding-no-duration",
    title: "Casamiento sin duración",
    description: "Falta duración → incompleto.",
    useSynthetic: true,
    draft: {
      serviceType: "WEDDING",
      eventDate: "2026-11-20",
      city: "Rosario",
    },
    expectStatus: ["INCOMPLETE"],
  },
  {
    id: "pr-event-second-photographer",
    title: "Evento con segundo fotógrafo",
    description: "Hint de dos fotógrafos.",
    useSynthetic: true,
    draft: {
      serviceType: "WEDDING",
      eventDate: "2026-12-01",
      city: "Córdoba",
      durationHours: 10,
    },
    hints: { photographersCount: 2 },
    expectStatus: ["READY"],
  },
  {
    id: "pr-event-travel",
    title: "Evento con traslado",
    description: "Hint de traslado incluido.",
    useSynthetic: true,
    draft: {
      serviceType: "WEDDING",
      eventDate: "2026-12-10",
      city: "Funes",
      durationHours: 8,
    },
    hints: { travelIncluded: true },
    expectStatus: ["READY"],
  },
  {
    id: "pr-family-session",
    title: "Sesión familiar",
    description: "Sesión familiar sintética.",
    useSynthetic: true,
    draft: {
      serviceType: "FAMILY_SESSION",
      eventDate: "2026-08-15",
      city: "Rosario",
      durationHours: 2,
    },
    expectStatus: ["READY"],
  },
  {
    id: "pr-sports-event",
    title: "Evento deportivo",
    description: "Cobertura deportiva.",
    useSynthetic: true,
    draft: {
      serviceType: "SPORTS_EVENT",
      eventDate: "2026-09-01",
      city: "Santa Fe",
      durationHours: 4,
    },
    expectStatus: ["READY"],
  },
  {
    id: "pr-approx-duration",
    title: "Duración aproximada",
    description: "Advertencia de horas aproximadas.",
    useSynthetic: true,
    draft: {
      serviceType: "WEDDING",
      eventDate: "2026-11-20",
      city: "Rosario",
      durationHours: 8,
    },
    hints: { durationApproximate: true },
    expectStatus: ["READY"],
  },
  {
    id: "pr-duration-correction",
    title: "Corrección de duración",
    description: "Tras corrección a 10 horas.",
    useSynthetic: true,
    draft: {
      serviceType: "WEDDING",
      eventDate: "2026-11-20",
      city: "Rosario",
      durationHours: 10,
    },
    expectStatus: ["READY"],
  },
  {
    id: "pr-city-change",
    title: "Cambio de ciudad",
    description: "Ciudad actualizada.",
    useSynthetic: true,
    draft: {
      serviceType: "WEDDING",
      eventDate: "2026-11-20",
      city: "Buenos Aires",
      durationHours: 8,
    },
    expectStatus: ["READY"],
  },
  {
    id: "pr-profile-missing",
    title: "Perfil no configurado",
    description: "Sin .local ni sintético.",
    skipConfig: true,
    draft: {
      serviceType: "WEDDING",
      durationHours: 8,
      city: "Rosario",
      eventDate: "2026-11-20",
    },
    expectStatus: ["NOT_CONFIGURED"],
  },
  {
    id: "pr-engine-failure",
    title: "Fallo controlado del motor",
    description: "Simula FAILED.",
    useSynthetic: true,
    forceEngineFailure: true,
    draft: {
      serviceType: "WEDDING",
      durationHours: 8,
      city: "Rosario",
      eventDate: "2026-11-20",
    },
    expectStatus: ["FAILED"],
  },
  {
    id: "pr-recommended-equals-minimum",
    title: "Recomendado igual al mínimo",
    description: "Factor comercial 1 (starting).",
    useSynthetic: true,
    syntheticProfileOverrides: { commercialPositioningId: "starting" },
    draft: {
      serviceType: "WEDDING",
      durationHours: 8,
      city: "Rosario",
      eventDate: "2026-11-20",
    },
    expectStatus: ["READY"],
  },
  {
    id: "pr-custom-commercial-factor",
    title: "Factor comercial personalizado",
    description: "high-demand.",
    useSynthetic: true,
    syntheticProfileOverrides: { commercialPositioningId: "high-demand" },
    draft: {
      serviceType: "WEDDING",
      durationHours: 8,
      city: "Rosario",
      eventDate: "2026-11-20",
    },
    expectStatus: ["READY"],
  },
  {
    id: "pr-multiple-components",
    title: "Resultado con múltiples componentes",
    description: "Casamiento largo con varios conceptos.",
    useSynthetic: true,
    draft: {
      serviceType: "WEDDING",
      durationHours: 12,
      city: "Rosario",
      eventDate: "2026-11-20",
    },
    hints: { photographersCount: 2, travelIncluded: true },
    expectStatus: ["READY"],
  },
  {
    id: "pr-inferred-warning",
    title: "Dato inferido que debe advertirse",
    description: "Campo inferido con warning.",
    useSynthetic: true,
    draft: {
      serviceType: "WEDDING",
      durationHours: 8,
      city: "Rosario",
      eventDate: "2026-11-20",
    },
    hints: { inferredFieldCodes: ["DURATION_HOURS"] },
    expectStatus: ["READY"],
  },
];

export function getPricingReviewScenario(
  id: string,
): PricingReviewScenario | undefined {
  return PRICING_REVIEW_SCENARIOS.find((s) => s.id === id);
}
