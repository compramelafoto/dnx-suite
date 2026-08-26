import { prisma, type Prisma } from "@repo/db";
import { frLog } from "../observability/structured-log";
import { enqueueTransactionalEmail } from "../notifications/outbox";
import {
  assertOpenParticipation,
  categoryRequiresArgra,
  normalizeArgraMembershipNumber,
  redactArgraForLog,
  validateArgraMembershipNumber,
  type RegistrationAnswers,
} from "../eligibility";
import type { ContestRulesConfiguration } from "../rules-config/types";
import { RegistrationError } from "./errors";
import { resolveFinancePolicy } from "./finance";
import { buildRegistrationNumber } from "./registration-number";
import { getCurrentPublishedRules } from "./rules-service";
import { assertRegistrationWindowOpen } from "./windows";

export type CreateRegistrationInput = {
  contestId: string;
  participantUserId: number;
  categoryId: string;
  rulesVersionId: string;
  rulesAccepted: boolean;
  /** Aceptación obligatoria de licencia (separada de bases y de marketing). */
  licenseAccepted: boolean;
  /** Edad declarada en años (gate menores 16–17). */
  declaredAgeYears?: number | null;
  minorAuthorization?: {
    guardianName: string;
    relationship: string;
    declarationAccepted: boolean;
  } | null;
  /** Opcional; nunca sustituye aceptación de bases/licencia. */
  promotionalOptIn?: boolean;
  /** Número de socio ARGRA (obligatorio solo si la categoría lo exige). */
  argraMembershipNumber?: string | null;
  rulesAcceptanceIp?: string | null;
  rulesAcceptanceUserAgent?: string | null;
  now?: Date;
};

export type RegistrationDTO = {
  id: string;
  contestId: string;
  contestTitle: string;
  contestSlug: string;
  categoryId: string;
  categoryName: string;
  status: string;
  paymentStatus: string;
  registrationNumber: string;
  registeredAt: Date | null;
  confirmedAt: Date | null;
  cancelledAt: Date | null;
  rulesVersionId: string;
  rulesVersionNumber: number;
  rulesAcceptedAt: Date;
  paymentModeSnapshot: string;
  registrationPriceSnapshot: number;
  currencySnapshot: string;
  platformFeeBpsSnapshot: number;
  organizerNetBpsSnapshot: number;
  feeSourceSnapshot: string;
  paymentOrderId: string | null;
  /** P0-01: upload aún no implementado. */
  photoUploadStatus: "pending";
  checkoutUrl: string | null;
  paymentRequired: boolean;
};

function toDTO(
  row: {
    id: string;
    contestId: string;
    categoryId: string;
    status: string;
    paymentStatus: string;
    registrationNumber: string;
    registeredAt: Date | null;
    confirmedAt: Date | null;
    cancelledAt: Date | null;
    rulesVersionId: string;
    rulesAcceptedAt: Date;
    paymentModeSnapshot: string;
    registrationPriceSnapshot: number;
    currencySnapshot: string;
    platformFeeBpsSnapshot: number;
    organizerNetBpsSnapshot: number;
    feeSourceSnapshot: string;
    paymentOrderId: string | null;
    contest: { title: string; slug: string };
    category: { name: string };
    rulesVersion: { versionNumber: number };
  },
): RegistrationDTO {
  const paymentRequired = row.paymentModeSnapshot === "PAID" && row.paymentStatus === "PENDING";
  return {
    id: row.id,
    contestId: row.contestId,
    contestTitle: row.contest.title,
    contestSlug: row.contest.slug,
    categoryId: row.categoryId,
    categoryName: row.category.name,
    status: row.status,
    paymentStatus: row.paymentStatus,
    registrationNumber: row.registrationNumber,
    registeredAt: row.registeredAt,
    confirmedAt: row.confirmedAt,
    cancelledAt: row.cancelledAt,
    rulesVersionId: row.rulesVersionId,
    rulesVersionNumber: row.rulesVersion.versionNumber,
    rulesAcceptedAt: row.rulesAcceptedAt,
    paymentModeSnapshot: row.paymentModeSnapshot,
    registrationPriceSnapshot: row.registrationPriceSnapshot,
    currencySnapshot: row.currencySnapshot,
    platformFeeBpsSnapshot: row.platformFeeBpsSnapshot,
    organizerNetBpsSnapshot: row.organizerNetBpsSnapshot,
    feeSourceSnapshot: row.feeSourceSnapshot,
    paymentOrderId: row.paymentOrderId,
    photoUploadStatus: "pending",
    // 09B2: cablear @repo/payments. FREE nunca tiene checkout.
    checkoutUrl: null,
    paymentRequired,
  };
}

const registrationInclude = {
  contest: { select: { title: true, slug: true } },
  category: { select: { name: true } },
  rulesVersion: { select: { versionNumber: true } },
} satisfies Prisma.FotorankContestRegistrationInclude;

/**
 * Crea inscripción FREE (CONFIRMED, sin DnxPaymentOrder) o PAID (PENDING_PAYMENT, sin checkout aún).
 * Idempotente: si ya existe inscripción activa del usuario, la devuelve (doble clic).
 */
export async function createContestRegistration(input: CreateRegistrationInput): Promise<{
  registration: RegistrationDTO;
  created: boolean;
  idempotentReplay: boolean;
}> {
  if (!input.participantUserId) {
    throw new RegistrationError("UNAUTHENTICATED", "Debés iniciar sesión.", 401);
  }
  if (!input.rulesAccepted) {
    throw new RegistrationError("RULES_NOT_ACCEPTED", "Debés aceptar las bases del concurso.");
  }
  if (!input.licenseAccepted) {
    throw new RegistrationError(
      "LICENSE_NOT_ACCEPTED",
      "Debés aceptar la licencia necesaria para participar.",
    );
  }

  const age = input.declaredAgeYears;
  if (age != null && (age < 16 || age > 120)) {
    throw new RegistrationError("AGE_INVALID", "La edad declarada no es válida para este concurso.");
  }
  if (age != null && age >= 16 && age < 18) {
    const auth = input.minorAuthorization;
    if (!auth?.declarationAccepted || !auth.guardianName?.trim() || !auth.relationship?.trim()) {
      throw new RegistrationError(
        "MINOR_AUTH_REQUIRED",
        "Para participantes menores de 18 años, la inscripción requiere autorización de padre, madre o tutor legal.",
      );
    }
  }

  const now = input.now ?? new Date();

  const existing = await prisma.fotorankContestRegistration.findUnique({
    where: {
      contestId_participantUserId: {
        contestId: input.contestId,
        participantUserId: input.participantUserId,
      },
    },
    include: registrationInclude,
  });

  if (existing && existing.status !== "CANCELLED" && existing.status !== "DISQUALIFIED") {
    return {
      registration: toDTO(existing),
      created: false,
      idempotentReplay: true,
    };
  }

  const contest = await prisma.fotorankContest.findUnique({
    where: { id: input.contestId },
    include: {
      organization: { select: { id: true, platformFeeBps: true } },
    },
  });
  if (!contest) {
    throw new RegistrationError("CONTEST_NOT_FOUND", "Concurso no encontrado.", 404);
  }

  const confirmedCount = await prisma.fotorankContestRegistration.count({
    where: { contestId: contest.id, status: "CONFIRMED" },
  });
  assertRegistrationWindowOpen(contest, confirmedCount, now);

  const category = await prisma.fotorankContestCategory.findFirst({
    where: {
      id: input.categoryId,
      contestId: contest.id,
      status: "ACTIVE",
    },
  });
  if (!category) {
    throw new RegistrationError(
      "CATEGORY_INVALID",
      "La categoría no es válida o no pertenece a este concurso.",
    );
  }

  // Participación abierta: residencia del participante nunca bloquea (aunque el texto viejo diga lo contrario).
  void assertOpenParticipation();

  const publishedCfgRow = await prisma.fotorankContestConfigurationVersion.findFirst({
    where: { contestId: contest.id, status: "PUBLISHED" },
    orderBy: { versionNumber: "desc" },
    select: { configurationJson: true },
  });
  const publishedCfg = publishedCfgRow?.configurationJson as ContestRulesConfiguration | null;
  const cfgCategory = publishedCfg?.categories?.find((c) => c.slug === category.slug);
  const requiresArgra =
    cfgCategory?.membershipRestriction === "ARGRA" || categoryRequiresArgra(category.slug);

  let answersJson: RegistrationAnswers = {
    openParticipationAcknowledged: true,
    argraVerificationStatus: "NOT_REQUIRED",
  };
  if (requiresArgra) {
    const argraCheck = validateArgraMembershipNumber(input.argraMembershipNumber);
    if (argraCheck.decision === "NOT_ELIGIBLE") {
      throw new RegistrationError("ARGRA_REQUIRED", argraCheck.publicMessage, 400);
    }
    const normalized = normalizeArgraMembershipNumber(input.argraMembershipNumber);
    answersJson = {
      openParticipationAcknowledged: true,
      argraMembershipNumber: normalized,
      argraVerificationStatus: "PENDING_VERIFICATION",
      argraDeclaredOwn: true,
    };
    frLog("registration.created", {
      contestId: contest.id,
      categorySlug: category.slug,
      argraPresent: true,
      argraRedacted: redactArgraForLog(normalized),
    });
  }

  const currentRules = await getCurrentPublishedRules(contest.id);
  if (!currentRules) {
    throw new RegistrationError(
      "RULES_VERSION_MISSING",
      "No hay bases publicadas para este concurso.",
      409,
    );
  }
  if (input.rulesVersionId !== currentRules.id) {
    throw new RegistrationError(
      "RULES_VERSION_MISMATCH",
      "La versión de bases aceptada ya no es la vigente. Recargá la página.",
      409,
    );
  }

  // Snapshot de configuración estructurada vigente (P0-09A/B).
  const publishedConfig = await prisma.fotorankContestConfigurationVersion.findFirst({
    where: { contestId: contest.id, status: "PUBLISHED" },
    orderBy: { versionNumber: "desc" },
    select: { id: true, configurationHash: true },
  });
  const configurationVersionId =
    currentRules.configurationVersionId ?? publishedConfig?.id ?? null;
  const configurationHashSnapshot = publishedConfig?.configurationHash ?? null;
  const rulesContentHashSnapshot = currentRules.contentHash;

  const finance = resolveFinancePolicy(
    {
      paymentMode: contest.registrationPricingMode,
      registrationPriceAmountMinor: contest.registrationPriceAmountMinor,
      currency: contest.registrationCurrency,
      contestPlatformFeeBps: contest.platformFeeBps,
      organizationPlatformFeeBps: contest.organization.platformFeeBps,
    },
    now,
  );

  // PAID: dejar PENDING_PAYMENT + snapshot. No crear DnxPaymentOrder hasta 09B2.
  // FREE: CONFIRMED + NOT_REQUIRED, sin orden.
  const isFree = finance.paymentMode === "FREE";
  if (!isFree && finance.paymentMode === "PAID") {
    // Preparación correcta: inscripción creada, checkout aún no cableado.
    // El cliente debe mostrar que el pago está pendiente de integración.
  }

  let created: { row: Parameters<typeof toDTO>[0]; created: boolean };
  try {
    created = await prisma.$transaction(async (tx) => {
      // Serializa altas concurrentes por concurso (evita colisión de registrationNumber).
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${contest.id}))`;

      const again = await tx.fotorankContestRegistration.findUnique({
        where: {
          contestId_participantUserId: {
            contestId: contest.id,
            participantUserId: input.participantUserId,
          },
        },
        include: registrationInclude,
      });
      if (again && again.status !== "CANCELLED" && again.status !== "DISQUALIFIED") {
        return { row: again, created: false as const };
      }

      const seq = (await tx.fotorankContestRegistration.count({ where: { contestId: contest.id } })) + 1;
      let registrationNumber = buildRegistrationNumber(contest.slug, seq);
      for (let i = 0; i < 8; i++) {
        const clash = await tx.fotorankContestRegistration.findUnique({
          where: {
            contestId_registrationNumber: {
              contestId: contest.id,
              registrationNumber,
            },
          },
          select: { id: true },
        });
        if (!clash) break;
        registrationNumber = buildRegistrationNumber(contest.slug, seq + i + 1);
      }

      const status = isFree ? "CONFIRMED" : "PENDING_PAYMENT";
      const paymentStatus = isFree ? "NOT_REQUIRED" : "PENDING";

      const row = await tx.fotorankContestRegistration.create({
        data: {
          contestId: contest.id,
          participantUserId: input.participantUserId,
          categoryId: category.id,
          status,
          paymentStatus,
          registrationNumber,
          registeredAt: now,
          confirmedAt: isFree ? now : null,
          rulesVersionId: currentRules.id,
          rulesAcceptedAt: now,
          rulesAcceptanceIp: input.rulesAcceptanceIp ?? null,
          rulesAcceptanceUserAgent: input.rulesAcceptanceUserAgent ?? null,
          configurationVersionId,
          rulesContentHashSnapshot,
          configurationHashSnapshot,
          licenseAccepted: true,
          licenseAcceptedAt: now,
          promotionalOptIn: input.promotionalOptIn === true,
          declaredAgeYears: age ?? null,
          paymentModeSnapshot: finance.paymentMode,
          registrationPriceSnapshot: finance.registrationPriceMinor,
          currencySnapshot: finance.currency,
          platformFeeBpsSnapshot: finance.platformFeeBps,
          organizerNetBpsSnapshot: finance.organizerNetBps,
          feeSourceSnapshot: finance.feeSource,
          financialPolicySnapshot: finance.policySnapshot,
          paymentOrderId: null,
          categoryLockedAt: now,
          answersJson: answersJson as Prisma.InputJsonValue,
        },
        include: registrationInclude,
      });

      if (age != null && age >= 16 && age < 18 && input.minorAuthorization) {
        const { MINOR_CONSENT_VERSION } = await import("../rules-lifecycle/minors");
        await tx.fotorankMinorAuthorization.create({
          data: {
            registrationId: row.id,
            contestId: contest.id,
            participantUserId: input.participantUserId,
            guardianName: input.minorAuthorization.guardianName.trim(),
            relationship: input.minorAuthorization.relationship.trim(),
            declarationTextVersion: MINOR_CONSENT_VERSION,
            declarationAccepted: true,
            acceptedAt: now,
            acceptanceIp: input.rulesAcceptanceIp ?? null,
            acceptanceUserAgent: input.rulesAcceptanceUserAgent ?? null,
          },
        });
      }

      return { row, created: true as const };
    });
  } catch (err) {
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code?: string }).code === "P2002"
    ) {
      const replay = await prisma.fotorankContestRegistration.findUnique({
        where: {
          contestId_participantUserId: {
            contestId: contest.id,
            participantUserId: input.participantUserId,
          },
        },
        include: registrationInclude,
      });
      if (replay && replay.status !== "CANCELLED" && replay.status !== "DISQUALIFIED") {
        created = { row: replay, created: false };
      } else {
        throw new RegistrationError(
          "REGISTRATION_CONFLICT",
          "No se pudo completar la inscripción. Reintentá en unos segundos.",
          409,
        );
      }
    } else {
      throw err;
    }
  }

  const dto = toDTO(created.row);
  const correlationId = `reg_${dto.id}`;
  frLog(created.created ? "registration.created" : "registration.confirmed", {
    correlationId,
    contestId: input.contestId,
    registrationId: dto.id,
    created: created.created,
    idempotentReplay: !created.created,
    paymentMode: dto.paymentModeSnapshot ?? null,
  });
  if (created.created && isFree) {
    void enqueueTransactionalEmail({
      kind: "REGISTRATION_CONFIRMED",
      toUserId: input.participantUserId,
      contestId: input.contestId,
      registrationId: dto.id,
      payload: {
        contestTitle: created.row.contest?.title ?? contest.title,
        registrationNumber: dto.registrationNumber,
      },
    }).catch(() => {
      frLog("email.failed", { correlationId, kind: "REGISTRATION_CONFIRMED" });
    });
  }

  return {
    registration: dto,
    created: created.created,
    idempotentReplay: !created.created,
  };
}

export async function getMyContestRegistration(
  contestId: string,
  participantUserId: number,
): Promise<RegistrationDTO | null> {
  const row = await prisma.fotorankContestRegistration.findUnique({
    where: {
      contestId_participantUserId: { contestId, participantUserId },
    },
    include: registrationInclude,
  });
  return row ? toDTO(row) : null;
}

export async function listMyRegistrations(participantUserId: number): Promise<RegistrationDTO[]> {
  const rows = await prisma.fotorankContestRegistration.findMany({
    where: { participantUserId },
    include: registrationInclude,
    orderBy: { createdAt: "desc" },
  });
  return rows.map(toDTO);
}

export async function cancelMyContestRegistration(
  contestId: string,
  participantUserId: number,
  now = new Date(),
): Promise<RegistrationDTO> {
  const contest = await prisma.fotorankContest.findUnique({
    where: { id: contestId },
    select: { id: true, allowRegistrationCancellation: true },
  });
  if (!contest) {
    throw new RegistrationError("CONTEST_NOT_FOUND", "Concurso no encontrado.", 404);
  }
  if (!contest.allowRegistrationCancellation) {
    throw new RegistrationError(
      "CANCELLATION_NOT_ALLOWED",
      "Este concurso no permite cancelar la inscripción.",
      403,
    );
  }

  const row = await prisma.fotorankContestRegistration.findUnique({
    where: {
      contestId_participantUserId: { contestId, participantUserId },
    },
    include: registrationInclude,
  });
  if (!row) {
    throw new RegistrationError("REGISTRATION_NOT_FOUND", "No tenés inscripción en este concurso.", 404);
  }
  if (row.status === "CANCELLED") {
    return toDTO(row);
  }
  if (row.status === "DISQUALIFIED") {
    throw new RegistrationError("CANCELLATION_NOT_ALLOWED", "La inscripción no se puede cancelar.", 403);
  }

  const updated = await prisma.fotorankContestRegistration.update({
    where: { id: row.id },
    data: {
      status: "CANCELLED",
      cancelledAt: now,
    },
    include: registrationInclude,
  });
  return toDTO(updated);
}

/** Contador público de confirmadas (para capacity / Public API). */
export async function countConfirmedRegistrations(contestId: string): Promise<number> {
  return prisma.fotorankContestRegistration.count({
    where: { contestId, status: "CONFIRMED" },
  });
}

/**
 * Verifica acceso organizador al concurso.
 * Super Admin (`User.globalRole` / role legado) entra sin membresía de org.
 */
export async function assertOrganizerCanAccessContest(
  contestId: string,
  userId: number,
): Promise<{ organizationId: string; viaSuperAdmin?: boolean }> {
  const contest = await prisma.fotorankContest.findUnique({
    where: { id: contestId },
    select: { organizationId: true },
  });
  if (!contest) {
    throw new RegistrationError("CONTEST_NOT_FOUND", "Concurso no encontrado.", 404);
  }

  const actor = await prisma.user.findUnique({
    where: { id: userId },
    select: { globalRole: true, role: true },
  });
  if (actor?.globalRole === "SUPER_ADMIN" || actor?.role === "SUPER_ADMIN") {
    try {
      const { recordPlatformAudit } = await import("../access/super-admin");
      await recordPlatformAudit({
        actorUserId: userId,
        action: "SUPER_ADMIN_CONTEST_ACCESS",
        organizationId: contest.organizationId,
        contestId,
      });
    } catch {
      // no bloquear acceso por fallo de auditoría
    }
    return { organizationId: contest.organizationId, viaSuperAdmin: true };
  }

  const member = await prisma.contestOrganizationMember.findFirst({
    where: {
      organizationId: contest.organizationId,
      userId,
      status: "ACTIVE",
      role: { in: ["OWNER", "ADMIN", "EDITOR", "VIEWER"] },
    },
    select: { id: true },
  });
  if (!member) {
    throw new RegistrationError("FORBIDDEN", "No tenés acceso a este concurso.", 403);
  }
  return { organizationId: contest.organizationId };
}
