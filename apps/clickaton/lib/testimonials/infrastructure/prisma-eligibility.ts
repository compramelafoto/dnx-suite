import "server-only";

/**
 * Busca en la base los hechos que deciden si alguien puede testimoniar.
 *
 * Las tres consultas son independientes y se resuelven juntas. El jurado se
 * lee de la ficha espejo que vive en la base de Clickatón (la que escribe
 * `mirrorJudgeAccount`), no del padrón maestro: así la pantalla no depende de
 * que la conexión al padrón esté configurada.
 */
import { prisma } from "@repo/db";
import type { EligibilityFacts } from "../domain/eligibility";

export type EligibilityLookup = {
  userId: number;
  email: string;
  emailVerified: boolean;
  editionId: string;
  fotorankContestId: string | null;
};

export async function loadEligibilityFacts(
  lookup: EligibilityLookup,
): Promise<EligibilityFacts> {
  const email = lookup.email.trim();

  const [registration, venue, assignment] = await Promise.all([
    prisma.clickatonRegistration.findFirst({
      where: {
        editionId: lookup.editionId,
        status: "CONFIRMED",
        isOpsTest: false,
        OR: [
          { userId: lookup.userId },
          { email: { equals: email, mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        userId: true,
        firstName: true,
        lastName: true,
        profilePhotoAssetId: true,
        instagramUrl: true,
      },
      // Si hay más de una, gana la que está atada a la cuenta.
      orderBy: [{ userId: "desc" }, { createdAt: "asc" }],
    }),
    prisma.clickatonVenue.findFirst({
      where: {
        editionId: lookup.editionId,
        isActive: true,
        contactEmail: { equals: email, mode: "insensitive" },
      },
      select: { id: true, name: true },
    }),
    lookup.fotorankContestId
      ? prisma.fotorankJudgeAssignment.findFirst({
          where: {
            contestId: lookup.fotorankContestId,
            judgeAccount: { email: { equals: email, mode: "insensitive" } },
          },
          select: {
            judgeAccount: {
              select: {
                email: true,
                profile: { select: { firstName: true, lastName: true } },
              },
            },
          },
        })
      : Promise.resolve(null),
  ]);

  const juror = assignment
    ? {
        name:
          [
            assignment.judgeAccount.profile?.firstName?.trim(),
            assignment.judgeAccount.profile?.lastName?.trim(),
          ]
            .filter(Boolean)
            .join(" ") || assignment.judgeAccount.email,
        photoAssetId: null,
      }
    : null;

  // El rol que va a ganar decide si el vínculo fue sólo por correo.
  // Jurado y sede se identifican siempre por correo; la inscripción puede
  // estar atada a la cuenta, que es un vínculo más fuerte.
  const matchedByEmailOnly = registration
    ? registration.userId !== lookup.userId
    : true;

  return {
    confirmedRegistration: registration
      ? {
          id: registration.id,
          firstName: registration.firstName,
          lastName: registration.lastName,
          profilePhotoAssetId: registration.profilePhotoAssetId,
          instagramUrl: registration.instagramUrl,
        }
      : null,
    venue,
    juror,
    emailVerified: lookup.emailVerified,
    matchedByEmailOnly,
  };
}
