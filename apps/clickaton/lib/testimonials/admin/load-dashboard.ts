import "server-only";

/**
 * Los números de calidad de una edición, y la comparativa entre ediciones.
 */
import { prisma } from "@repo/db";
import {
  averageAspect,
  calculateNps,
  wouldReturnRate,
  type AspectAverage,
  type NpsBreakdown,
  type WouldReturnBreakdown,
} from "../domain/metrics";
import {
  SURVEY_ASPECTS,
  type SurveyAspectField,
} from "../domain/survey-definition";

export type EditionQuality = {
  editionId: string;
  editionName: string;
  nps: NpsBreakdown;
  aspects: Array<{ field: SurveyAspectField; label: string } & AspectAverage>;
  wouldReturn: WouldReturnBreakdown;
  responses: number;
  invited: number;
  responded: number;
  /** Porcentaje de invitados que contestaron. */
  responseRate: number;
  testimonials: { pending: number; published: number; rejected: number };
};

async function qualityForEdition(edition: {
  id: string;
  name: string;
}): Promise<EditionQuality> {
  const [responses, invites, testimonials] = await Promise.all([
    prisma.clickatonSurveyResponse.findMany({
      where: { editionId: edition.id },
      select: {
        npsScore: true,
        wouldReturn: true,
        scoreOrganization: true,
        scorePrompts: true,
        scoreVenue: true,
        scoreKit: true,
        scoreAccreditation: true,
        scoreCommunication: true,
        scoreValueForMoney: true,
      },
    }),
    prisma.clickatonTestimonialInvite.findMany({
      where: { editionId: edition.id },
      select: { status: true },
    }),
    prisma.clickatonTestimonial.groupBy({
      by: ["status"],
      where: { editionId: edition.id },
      _count: { _all: true },
    }),
  ]);

  const countByStatus = (status: string) =>
    testimonials.find((row) => row.status === status)?._count._all ?? 0;

  const responded = invites.filter((i) => i.status === "RESPONDED").length;

  return {
    editionId: edition.id,
    editionName: edition.name,
    nps: calculateNps(responses.map((r) => r.npsScore)),
    aspects: SURVEY_ASPECTS.map((aspect) => ({
      field: aspect.field,
      label: aspect.label,
      ...averageAspect(responses.map((r) => r[aspect.field])),
    })),
    wouldReturn: wouldReturnRate(responses.map((r) => r.wouldReturn)),
    responses: responses.length,
    invited: invites.length,
    responded,
    responseRate:
      invites.length === 0 ? 0 : Math.round((responded / invites.length) * 100),
    testimonials: {
      pending: countByStatus("PENDING"),
      published: countByStatus("PUBLISHED"),
      rejected: countByStatus("REJECTED"),
    },
  };
}

export type EditionModuleSettings = {
  id: string;
  name: string;
  slug: string;
  testimonialsEnabled: boolean;
  testimonialInviteDelayDays: number;
};

export type TestimonialDashboard = {
  editions: EditionQuality[];
  /** Todas las ediciones, para los interruptores del módulo. */
  allEditions: EditionModuleSettings[];
  /** Ediciones con el módulo encendido, para el botón de invitar. */
  enabledEditions: EditionModuleSettings[];
};

export async function loadTestimonialDashboard(
  editionId?: string,
): Promise<TestimonialDashboard> {
  const editions = await prisma.clickatonEdition.findMany({
    where: {
      isOpsFixture: false,
      ...(editionId ? { id: editionId } : {}),
    },
    select: {
      id: true,
      name: true,
      slug: true,
      testimonialsEnabled: true,
      testimonialInviteDelayDays: true,
    },
    orderBy: { startAt: "desc" },
    take: 12,
  });

  const quality = await Promise.all(
    editions.map((edition) => qualityForEdition(edition)),
  );

  return {
    // Las ediciones sin una sola respuesta no ensucian la comparativa.
    editions: quality.filter((q) => q.responses > 0 || q.invited > 0),
    allEditions: editions,
    enabledEditions: editions.filter((e) => e.testimonialsEnabled),
  };
}
