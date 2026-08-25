/**
 * Seed idempotente — "El País que Miramos", Primera Edición 2026.
 *
 * Deja el concurso estrictamente en DRAFT y visibilidad PRIVATE.
 * No publica, no envía correos, no habilita pagos, no crea interesados,
 * participantes, jurados ni pagos ficticios, y no toca ningún otro concurso.
 *
 * Uso:
 *   pnpm --filter fotorank db:seed:el-pais-que-miramos
 *
 * Guardias de entorno:
 *   - Aborta si NODE_ENV/VERCEL_ENV indican producción.
 *   - Aborta si DATABASE_URL no supera `assertSafeFotoRankDatabaseUrl`
 *     (las bases contienen marcadores legales sin completar).
 *   - `--dry-run` imprime el plan sin escribir nada.
 */

import { Prisma, prisma } from "@repo/db";

import { assertSafeFotoRankDatabaseUrl } from "./assert-safe-database-url";
import {
  AWARDS,
  BRIEF,
  CONTEST_SLUG,
  EVALUATION_CRITERIA,
  IDENTITY,
  JURY_PENDING_FLAG,
  JURY_POSITIONS,
  ORGANIZATION_SLUG,
  PARTICIPATION,
  PAYMENT_DEPENDENT_COMMUNICATIONS,
  PRICE_PHASES,
  PRIZE_PENDING_FLAG,
  PRIZE_PROVISIONAL_DESCRIPTION,
  PRIZE_SNAPSHOT,
  RULES,
  SCHEDULED_COMMUNICATIONS,
  SCHEDULE_UTC,
  TECHNICAL_REQUIREMENTS,
  TIMEZONE,
  local,
} from "../app/lib/fotorank/upcoming/contests/el-pais-que-miramos/definition";
import { mergeUpcomingConfig, type UpcomingConfig } from "../app/lib/fotorank/upcoming/service";

const DRY_RUN = process.argv.includes("--dry-run");

function log(message: string) {
  console.log(`${DRY_RUN ? "[dry-run] " : ""}${message}`);
}

/** SHA-256 del contenido normalizado, igual que el resto de las bases del repo. */
async function hashContent(content: string): Promise<string> {
  const { createHash } = await import("node:crypto");
  const normalized = content.replace(/\r\n/g, "\n").replace(/\s+$/u, "");
  return createHash("sha256").update(normalized, "utf8").digest("hex");
}

function assertNotProduction() {
  if (process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production") {
    throw new Error(
      "ABORT: seed bloqueado en producción. Las bases incluyen marcadores legales sin completar.",
    );
  }
  const check = assertSafeFotoRankDatabaseUrl();
  log(`Base de datos verificada: host=${check.host} db=${check.database} (${check.reason})`);
}

/** Configuración administrativa del concurso, guardada en rulesData.concursoProximo. */
function buildUpcomingConfig(): UpcomingConfig {
  return {
    interestBenefitCutoffAt: SCHEDULE_UTC.interestBenefitCutoffAt.toISOString(),
    benefitDeadlineAt: SCHEDULE_UTC.promoPriceEndsAt.toISOString(),
    // Pendientes deliberados: bloquean la publicación hasta que se completen.
    privacyPolicyUrl: null,
    interestConfirmationTemplateValidated: false,
    communicationsSafeModeConfigured: true,
    previewApprovedAt: null,
    cardBadge: IDENTITY.cardBadge,
    cardSummary: IDENTITY.cardSummary,
    contestType: IDENTITY.contestType,
    edition: IDENTITY.edition,
    scope: IDENTITY.scope,
    organizerLegal: {
      // No se inventan datos legales.
      legalName: null,
      taxId: null,
      legalAddress: null,
      contactEmail: null,
      jurisdiction: null,
    },
    prize: { ...PRIZE_SNAPSHOT, provisionalDescription: PRIZE_PROVISIONAL_DESCRIPTION },
    judgesConfirmed: false,
    juryPositions: JURY_POSITIONS.map((j) => ({ ...j, confirmed: false })),
    evaluationCriteria: EVALUATION_CRITERIA.map((c) => ({ ...c })),
    cancellationAndRefundPolicyDefined: false,
    dnxSplitConfigValidated: false,
    purchaseTestApproved: false,
    photoEnablementTestApproved: false,
    transactionalEmailsValidated: false,
    brief: { title: BRIEF.title, text: BRIEF.text },
    technicalRequirements: { ...TECHNICAL_REQUIREMENTS },
    awards: JSON.parse(JSON.stringify(AWARDS)) as Record<string, unknown>,
    adminFlags: [
      PRIZE_PENDING_FLAG,
      JURY_PENDING_FLAG,
      "BASES PENDIENTES DE REVISIÓN LEGAL",
      "DATOS LEGALES DEL ORGANIZADOR PENDIENTES",
      "IMÁGENES PENDIENTES DE CARGA",
      "DNX PAYMENTS NO INTEGRADO",
    ],
  };
}

async function main() {
  assertNotProduction();

  const admin =
    (await prisma.user.findUnique({ where: { email: "admin@fotorank.com" } })) ??
    (await prisma.user.findFirst({ orderBy: { id: "asc" } }));
  if (!admin) {
    throw new Error(
      "No hay usuarios en la base. Corré primero el seed principal: el seed no crea usuarios ficticios.",
    );
  }
  log(`Usuario responsable del alta: #${admin.id}`);

  // -------------------------------------------------------------------------
  // 1. Organización FotoRank
  // -------------------------------------------------------------------------
  const existingOrg = await prisma.contestOrganization.findUnique({
    where: { slug: ORGANIZATION_SLUG },
    select: { id: true, name: true },
  });

  let organizationId: string;
  if (existingOrg) {
    organizationId = existingOrg.id;
    log(`Organización existente reutilizada: ${existingOrg.name} (${organizationId})`);
  } else if (DRY_RUN) {
    organizationId = "<nueva-organizacion>";
    log(`Se crearía la organización "${IDENTITY.organizerDisplayName}" (slug ${ORGANIZATION_SLUG}).`);
  } else {
    const created = await prisma.contestOrganization.create({
      data: {
        name: IDENTITY.organizerDisplayName,
        slug: ORGANIZATION_SLUG,
        shortDescription: "Plataforma de concursos fotográficos.",
        createdByUserId: admin.id,
      },
      select: { id: true },
    });
    organizationId = created.id;
    log(`Organización creada: ${IDENTITY.organizerDisplayName} (${organizationId})`);
  }

  // -------------------------------------------------------------------------
  // 2. Concurso — sólo los campos administrados por este seed
  // -------------------------------------------------------------------------
  const existingContest = existingOrg
    ? await prisma.fotorankContest.findUnique({
        where: { organizationId_slug: { organizationId, slug: CONTEST_SLUG } },
        select: { id: true, status: true, visibility: true, rulesData: true },
      })
    : null;

  if (existingContest && existingContest.status !== "DRAFT") {
    throw new Error(
      `ABORT: el concurso ya existe en estado "${existingContest.status}". ` +
        "El seed no degrada un concurso ya activado. Revisalo manualmente antes de reejecutar.",
    );
  }

  const config = buildUpcomingConfig();
  const rulesData = mergeUpcomingConfig(existingContest?.rulesData ?? null, config);

  /** Campos administrados por este seed. Todo lo demás queda como esté. */
  const managedFields = {
    title: IDENTITY.title,
    shortDescription: IDENTITY.tagline,
    fullDescription: `${IDENTITY.contestType} · ${IDENTITY.edition} · ${IDENTITY.scope}. ${IDENTITY.cardSummary}`,
    // Estado obligatorio de esta tarea.
    status: "DRAFT" as const,
    visibility: "PRIVATE" as const,
    experienceType: "CONTEST" as const,
    // Portal general de FotoRank: nunca Clickatón.
    distributionChannel: null,
    // Sin inscripción operativa: DNX Payments está diferido.
    registrationEnabled: false,
    registrationPricingMode: null,
    registrationPriceAmountMinor: null,
    registrationCurrency: "ARS",
    registrationOpensAt: SCHEDULE_UTC.registrationOpensAt,
    registrationClosesAt: SCHEDULE_UTC.submissionsCloseAt,
    submissionOpensAt: SCHEDULE_UTC.registrationOpensAt,
    submissionDeadline: SCHEDULE_UTC.submissionsCloseAt,
    startAt: SCHEDULE_UTC.registrationOpensAt,
    judgingStartAt: SCHEDULE_UTC.judgingStartAt,
    judgingEndAt: SCHEDULE_UTC.judgingEndAt,
    resultsAt: SCHEDULE_UTC.resultsAt,
    timezone: TIMEZONE,
    prizesSummary: PRIZE_PROVISIONAL_DESCRIPTION,
    rulesData: rulesData as Prisma.InputJsonValue,
    // Imagen pendiente: no se publica un placeholder como si fuera definitivo.
    coverImageUrl: null,
  };

  let contestId: string;
  if (DRY_RUN) {
    contestId = existingContest?.id ?? "<nuevo-concurso>";
    log(
      existingContest
        ? `Se actualizarían los campos administrados del concurso ${contestId}.`
        : `Se crearía el concurso "${IDENTITY.title}" (${CONTEST_SLUG}) en DRAFT/PRIVATE.`,
    );
  } else if (existingContest) {
    await prisma.fotorankContest.update({
      where: { id: existingContest.id },
      data: managedFields,
    });
    contestId = existingContest.id;
    log(`Concurso actualizado (idempotente): ${contestId}`);
  } else {
    const created = await prisma.fotorankContest.create({
      data: {
        organizationId,
        slug: CONTEST_SLUG,
        createdByUserId: admin.id,
        ...managedFields,
      },
      select: { id: true },
    });
    contestId = created.id;
    log(`Concurso creado: ${IDENTITY.title} (${contestId}) — DRAFT / PRIVATE`);
  }

  // -------------------------------------------------------------------------
  // 3. Fases de precio (configuración; sin checkout)
  // -------------------------------------------------------------------------
  for (const phase of PRICE_PHASES) {
    if (DRY_RUN) {
      log(`  precio: ${phase.code} (${phase.tiers.length} paquetes)`);
      continue;
    }
    const saved = await prisma.fotorankContestPricePhase.upsert({
      where: { contestId_code: { contestId, code: phase.code } },
      update: {
        name: phase.name,
        description: phase.description,
        audience: phase.audience,
        startsAt: local(phase.startsAtLocal),
        endsAt: local(phase.endsAtLocal),
        currency: "ARS",
        priority: phase.priority,
        isActive: true,
      },
      create: {
        contestId,
        code: phase.code,
        name: phase.name,
        description: phase.description,
        audience: phase.audience,
        startsAt: local(phase.startsAtLocal),
        endsAt: local(phase.endsAtLocal),
        currency: "ARS",
        priority: phase.priority,
        isActive: true,
      },
      select: { id: true },
    });

    for (const tier of phase.tiers) {
      await prisma.fotorankContestPriceTier.upsert({
        where: {
          pricePhaseId_quantity: { pricePhaseId: saved.id, quantity: tier.quantity },
        },
        update: { amountMinor: tier.amountMinor, label: tier.label, sortOrder: tier.quantity },
        create: {
          pricePhaseId: saved.id,
          quantity: tier.quantity,
          amountMinor: tier.amountMinor,
          label: tier.label,
          sortOrder: tier.quantity,
        },
      });
    }
  }
  log(`Etapas de precio configuradas: ${PRICE_PHASES.length}`);

  // -------------------------------------------------------------------------
  // 4. Calendario de comunicaciones (declarativo; no dispara envíos)
  // -------------------------------------------------------------------------
  const allCommunications = [...SCHEDULED_COMMUNICATIONS, ...PAYMENT_DEPENDENT_COMMUNICATIONS];
  for (const comm of allCommunications) {
    const scheduledAt = comm.scheduledLocal ? local(comm.scheduledLocal) : null;
    if (DRY_RUN) {
      log(`  email: ${comm.code} — "${comm.subject}"`);
      continue;
    }
    const data = {
      eventType: comm.eventType,
      subject: comm.subject,
      bodyOutline: comm.bodyOutline,
      scheduledLocal: comm.scheduledLocal,
      scheduledAt,
      isDateDriven: comm.scheduledLocal !== null,
      category: comm.category,
      audience: comm.audience,
      isEnabled: true,
      blockedReason: comm.blockedReason ?? null,
    };
    await prisma.fotorankContestScheduledCommunication.upsert({
      where: { contestId_code: { contestId, code: comm.code } },
      update: data,
      create: { contestId, code: comm.code, ...data },
    });
  }
  log(`Comunicaciones programadas: ${allCommunications.length} (ninguna se despacha)`);

  // -------------------------------------------------------------------------
  // 5. Bases en borrador legal
  // -------------------------------------------------------------------------
  const contentHash = await hashContent(RULES.content);
  if (DRY_RUN) {
    log(`  bases: "${RULES.title}" (hash ${contentHash.slice(0, 12)}…) estado DRAFT`);
  } else {
    const existingVersion = await prisma.fotorankContestRulesVersion.findFirst({
      where: { contestId, contentHash },
      select: { id: true, versionNumber: true },
    });

    if (existingVersion) {
      log(`Bases ya cargadas sin cambios (versión ${existingVersion.versionNumber}).`);
    } else {
      const last = await prisma.fotorankContestRulesVersion.findFirst({
        where: { contestId },
        orderBy: { versionNumber: "desc" },
        select: { versionNumber: true },
      });
      const versionNumber = (last?.versionNumber ?? 0) + 1;
      await prisma.fotorankContestRulesVersion.create({
        data: {
          contestId,
          versionNumber,
          title: RULES.title,
          content: RULES.content,
          contentHash,
          // Nunca PUBLISHED desde el seed.
          status: "DRAFT",
          contentFormat: "markdown",
          generatedBy: "MANUAL",
          legalReviewStatus: "PENDING",
          legalReviewNotes: RULES.legalReviewNote,
          createdByUserId: admin.id,
        },
      });
      log(`Bases cargadas como BORRADOR — versión ${versionNumber} (PENDIENTE DE REVISIÓN LEGAL).`);
    }
  }

  // -------------------------------------------------------------------------
  // Resumen
  // -------------------------------------------------------------------------
  log("");
  log("RESUMEN");
  log(`  Concurso:      ${IDENTITY.title}`);
  log(`  Slug:          ${CONTEST_SLUG}`);
  log(`  Id:            ${contestId}`);
  log(`  Organizador:   ${IDENTITY.organizerDisplayName} (${organizationId})`);
  log(`  Estado:        DRAFT`);
  log(`  Visibilidad:   PRIVATE`);
  log(`  Pagos:         deshabilitados (DNX Payments diferido)`);
  log(`  Correos:       ninguno enviado`);
  log(`  Máx. fotos:    ${PARTICIPATION.maxPhotosPerParticipant} por participante`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error instanceof Error ? error.message : error);
    await prisma.$disconnect();
    process.exit(1);
  });
