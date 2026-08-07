/**
 * Reaceptación explícita de Bases cuando hay una versión PUBLISHED más nueva
 * que la aceptada en la inscripción.
 *
 * - Nunca acepta automáticamente.
 * - Preserva historial en answersJson.rulesAcceptanceHistory (sin borrar el vínculo
 *   previo al actualizar el puntero vigente de la inscripción).
 */
import { prisma, type Prisma } from "@repo/db";
import { RegistrationError } from "./errors";
import { getCurrentPublishedRules } from "./rules-service";

export type RulesAcceptanceHistoryEntry = {
  rulesVersionId: string;
  rulesAcceptedAt: string;
  rulesContentHashSnapshot: string | null;
  supersededAt: string;
  reason: "SUBSTANTIAL_RULES_UPDATE";
};

export type RulesReacceptanceStatus = {
  needsReacceptance: boolean;
  registrationId: string;
  acceptedRulesVersionId: string;
  currentRulesVersionId: string | null;
  currentRulesTitle: string | null;
  currentRulesContent: string | null;
  currentVersionNumber: number | null;
};

function asHistory(raw: unknown): RulesAcceptanceHistoryEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((item): item is RulesAcceptanceHistoryEntry => {
    if (!item || typeof item !== "object") return false;
    const o = item as Record<string, unknown>;
    return (
      typeof o.rulesVersionId === "string" &&
      typeof o.rulesAcceptedAt === "string" &&
      typeof o.supersededAt === "string"
    );
  });
}

export function registrationNeedsRulesReacceptance(input: {
  acceptedRulesVersionId: string;
  currentPublishedRulesVersionId: string | null;
}): boolean {
  if (!input.currentPublishedRulesVersionId) return false;
  return input.acceptedRulesVersionId !== input.currentPublishedRulesVersionId;
}

export async function getRulesReacceptanceStatus(input: {
  contestId: string;
  participantUserId: number;
}): Promise<RulesReacceptanceStatus | null> {
  const reg = await prisma.fotorankContestRegistration.findUnique({
    where: {
      contestId_participantUserId: {
        contestId: input.contestId,
        participantUserId: input.participantUserId,
      },
    },
    select: { id: true, rulesVersionId: true },
  });
  if (!reg) return null;

  const current = await getCurrentPublishedRules(input.contestId);
  const needs = registrationNeedsRulesReacceptance({
    acceptedRulesVersionId: reg.rulesVersionId,
    currentPublishedRulesVersionId: current?.id ?? null,
  });

  return {
    needsReacceptance: needs,
    registrationId: reg.id,
    acceptedRulesVersionId: reg.rulesVersionId,
    currentRulesVersionId: current?.id ?? null,
    currentRulesTitle: current?.title ?? null,
    currentRulesContent: needs ? (current?.content ?? null) : null,
    currentVersionNumber: current?.versionNumber ?? null,
  };
}

/**
 * Aceptación explícita de la versión PUBLISHED vigente por un participante ya inscripto.
 * No crea inscripciones nuevas ni altera obras.
 */
export async function acceptCurrentPublishedRules(input: {
  contestId: string;
  participantUserId: number;
  rulesVersionId: string;
  rulesAccepted: boolean;
  licenseAccepted: boolean;
  acceptanceIp?: string | null;
  acceptanceUserAgent?: string | null;
}): Promise<{
  registrationId: string;
  previousRulesVersionId: string;
  rulesVersionId: string;
  rulesAcceptedAt: Date;
}> {
  if (!input.rulesAccepted) {
    throw new RegistrationError(
      "RULES_NOT_ACCEPTED",
      "Debés aceptar expresamente las Bases y Condiciones vigentes.",
      400,
    );
  }
  if (!input.licenseAccepted) {
    throw new RegistrationError(
      "LICENSE_NOT_ACCEPTED",
      "Debés aceptar expresamente la licencia asociada a las Bases vigentes.",
      400,
    );
  }

  const current = await getCurrentPublishedRules(input.contestId);
  if (!current) {
    throw new RegistrationError(
      "RULES_VERSION_MISSING",
      "No hay bases publicadas para este concurso.",
      409,
    );
  }
  if (input.rulesVersionId !== current.id) {
    throw new RegistrationError(
      "RULES_VERSION_MISMATCH",
      "La versión de bases aceptada ya no es la vigente. Recargá la página.",
      409,
    );
  }

  const now = new Date();

  return prisma.$transaction(async (tx) => {
    const reg = await tx.fotorankContestRegistration.findUnique({
      where: {
        contestId_participantUserId: {
          contestId: input.contestId,
          participantUserId: input.participantUserId,
        },
      },
      select: {
        id: true,
        rulesVersionId: true,
        rulesAcceptedAt: true,
        rulesContentHashSnapshot: true,
        answersJson: true,
        status: true,
      },
    });
    if (!reg) {
      throw new RegistrationError("REGISTRATION_NOT_FOUND", "Inscripción no encontrada.", 404);
    }
    if (reg.status === "CANCELLED" || reg.status === "DISQUALIFIED") {
      throw new RegistrationError(
        "FORBIDDEN",
        "La inscripción no admite reaceptación de bases en su estado actual.",
        403,
      );
    }

    if (reg.rulesVersionId === current.id) {
      return {
        registrationId: reg.id,
        previousRulesVersionId: reg.rulesVersionId,
        rulesVersionId: current.id,
        rulesAcceptedAt: reg.rulesAcceptedAt,
      };
    }

    const prevAnswers =
      reg.answersJson && typeof reg.answersJson === "object" && !Array.isArray(reg.answersJson)
        ? (reg.answersJson as Record<string, unknown>)
        : {};
    const history = asHistory(prevAnswers.rulesAcceptanceHistory);
    history.push({
      rulesVersionId: reg.rulesVersionId,
      rulesAcceptedAt: reg.rulesAcceptedAt.toISOString(),
      rulesContentHashSnapshot: reg.rulesContentHashSnapshot,
      supersededAt: now.toISOString(),
      reason: "SUBSTANTIAL_RULES_UPDATE",
    });

    const updated = await tx.fotorankContestRegistration.update({
      where: { id: reg.id },
      data: {
        rulesVersionId: current.id,
        rulesAcceptedAt: now,
        rulesAcceptanceIp: input.acceptanceIp ?? null,
        rulesAcceptanceUserAgent: input.acceptanceUserAgent ?? null,
        rulesContentHashSnapshot: current.contentHash,
        licenseAccepted: true,
        licenseAcceptedAt: now,
        answersJson: {
          ...prevAnswers,
          rulesAcceptanceHistory: history,
        } as Prisma.InputJsonValue,
      },
      select: {
        id: true,
        rulesVersionId: true,
        rulesAcceptedAt: true,
      },
    });

    await tx.fotorankContestRulesAuditEvent.create({
      data: {
        contestId: input.contestId,
        rulesVersionId: current.id,
        actorUserId: input.participantUserId,
        action: "PARTICIPANT_REACCEPT",
        notes: `Reaceptación explícita. Versión previa: ${reg.rulesVersionId}`,
        metadataJson: {
          registrationId: reg.id,
          previousRulesVersionId: reg.rulesVersionId,
          previousRulesAcceptedAt: reg.rulesAcceptedAt.toISOString(),
          previousRulesContentHashSnapshot: reg.rulesContentHashSnapshot,
        },
      },
    });

    return {
      registrationId: updated.id,
      previousRulesVersionId: reg.rulesVersionId,
      rulesVersionId: updated.rulesVersionId,
      rulesAcceptedAt: updated.rulesAcceptedAt,
    };
  });
}

/** Gate para upload/confirm: bloquea si la inscripción no aceptó la vigente. */
export async function assertRegistrationAcceptedCurrentRules(input: {
  contestId: string;
  registrationId: string;
  acceptedRulesVersionId: string;
}): Promise<void> {
  const current = await getCurrentPublishedRules(input.contestId);
  if (
    registrationNeedsRulesReacceptance({
      acceptedRulesVersionId: input.acceptedRulesVersionId,
      currentPublishedRulesVersionId: current?.id ?? null,
    })
  ) {
    throw new RegistrationError(
      "RULES_VERSION_MISMATCH",
      "Hay una nueva versión de Bases y Condiciones. Debés leerla y aceptarla expresamente antes de continuar.",
      409,
    );
  }
}
