import { prisma } from "@repo/db";
import type { BenefitAudienceScopeHint } from "@repo/partners";

/**
 * Carga hints de audiencia para beneficios ACTIVE de una edición Clickatón.
 */
export async function loadEditionAudienceHints(
  editionId: string,
): Promise<BenefitAudienceScopeHint[]> {
  const participations = await prisma.dnxPartnerParticipation.findMany({
    where: {
      application: "CLICKATON",
      contextType: "EDITION",
      contextId: editionId,
      status: { not: "ARCHIVED" },
    },
    select: { id: true, application: true },
  });
  const benefits = await prisma.dnxPartnerBenefit.findMany({
    where: {
      OR: [
        { participationId: { in: participations.map((p) => p.id) } },
        {
          audiences: {
            some: { contextType: "EDITION", contextId: editionId },
          },
        },
      ],
      status: "ACTIVE",
      archivedAt: null,
    },
    include: { audiences: true, participation: { select: { application: true } } },
  });

  return benefits.map((b) => {
    const audienceKeys: string[] = [];
    const categoryIds: string[] = [];
    const prizeBundleIds: string[] = [];
    for (const a of b.audiences) {
      const meta =
        a.metadata && typeof a.metadata === "object" && !Array.isArray(a.metadata)
          ? (a.metadata as Record<string, unknown>)
          : null;
      const key =
        (typeof meta?.clickatonAudienceKey === "string"
          ? meta.clickatonAudienceKey
          : null) ??
        a.label ??
        a.audienceType;
      audienceKeys.push(key);
      if (typeof meta?.categoryId === "string") categoryIds.push(meta.categoryId);
      if (typeof meta?.prizeBundleId === "string") prizeBundleIds.push(meta.prizeBundleId);
      if (Array.isArray(meta?.prizeBundleIds)) {
        for (const id of meta.prizeBundleIds) {
          if (typeof id === "string") prizeBundleIds.push(id);
        }
      }
    }
    return {
      benefitId: b.id,
      audienceKeys,
      categoryIds,
      prizeBundleIds,
      application: b.participation?.application ?? "CLICKATON",
    };
  });
}
