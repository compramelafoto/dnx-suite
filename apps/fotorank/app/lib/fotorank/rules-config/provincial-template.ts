import { buildSantaFeEnFoco2026Configuration } from "./santa-fe-en-foco-2026";
import type { ContestRulesConfiguration } from "./types";

/**
 * Plantilla genérica: Concurso Fotográfico Provincial.
 * Sin nombre/fechas/premios/organizadores institucionales específicos.
 */
export function buildProvincialContestTemplateConfiguration(): ContestRulesConfiguration {
  const base = buildSantaFeEnFoco2026Configuration();
  return {
    ...base,
    identity: {
      ...base.identity,
      officialName: "Concurso Fotográfico Provincial",
      slug: "concurso-fotografico-provincial",
      description: "Plantilla genérica provincial de fotografía.",
      organizers: [],
      participatingInstitutions: [],
      territoryScope: null,
      province: null,
      contactEmail: null,
      siteUrl: null,
    },
    schedule: {
      ...base.schedule,
      registrationOpensAt: "1970-01-01T00:00:00.000Z",
      registrationClosesAtExclusive: "1970-01-02T00:00:00.000Z",
      submissionOpensAt: "1970-01-01T00:00:00.000Z",
      submissionClosesAtExclusive: "1970-01-02T00:00:00.000Z",
      replaceClosesAtExclusive: null,
      captureWindowStartsAt: null,
      captureWindowEndsExclusiveAt: null,
      publicScheduleNote: "Completar fechas del concurso.",
    },
    prizes: [],
    jury: {
      ...base.jury,
      maxJudges: null,
      judgesPendingHumanConfirmation: true,
      generalCriteria: null,
    },
    rights: {
      ...base.rights,
      legalReviewFlags: ["Completar datos institucionales y revisión jurídica local."],
    },
  };
}
