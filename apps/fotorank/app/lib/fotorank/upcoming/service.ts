/**
 * Servicio de concursos próximos — única capa con acceso a datos.
 *
 * Toda la política vive en los módulos puros (lifecycle, interest, pricing,
 * communications, publication-gates). Acá sólo se lee, se aplica y se persiste.
 */

import { Prisma, prisma } from "@repo/db";

import { CURRENT_CONSENT_VERSION } from "./consent";
import {
  computeInterestStats,
  decideCancelInterest,
  decideRegisterInterest,
  toPricingEligibility,
  type ExistingInterest,
  type InterestStats,
  type InterestStatus,
} from "./interest";
import {
  acceptsInterestRegistration,
  canTransition,
  isPubliclyVisibleStatus,
  PUBLICLY_VISIBLE_STATUSES,
  type ContestLifecyclePhase,
} from "./lifecycle";
import { resolvePrice, type PricePhase, type PriceResolution } from "./pricing";
import {
  evaluateGateForTarget,
  type ContestGateSnapshot,
  type ContestPaymentModel,
  type GateReport,
  type PrizeGateSnapshot,
} from "./publication-gates";
import { isDnxPaymentsEnabled } from "./payments-integration";
import { checkConfigReadiness } from "../checkout/config";
import { contentHasLegalPlaceholder } from "./contests/el-pais-que-miramos/rules-draft";

// ---------------------------------------------------------------------------
// Configuración del concurso guardada en rulesData (JSON)
// ---------------------------------------------------------------------------

/**
 * Bloque `concursoProximo` dentro de `FotorankContest.rulesData`.
 * Convive con `premiosRecompensas` (ya existente) sin pisarlo.
 */
export type UpcomingConfig = {
  /** Cierre de captación de interesados con beneficio (ISO UTC). */
  interestBenefitCutoffAt?: string | null;
  /** Fecha límite para pagar con el precio promocional (ISO UTC). */
  benefitDeadlineAt?: string | null;
  privacyPolicyUrl?: string | null;
  interestConfirmationTemplateValidated?: boolean;
  communicationsSafeModeConfigured?: boolean;
  previewApprovedAt?: string | null;
  cardBadge?: string | null;
  cardSummary?: string | null;
  contestType?: string | null;
  edition?: string | null;
  scope?: string | null;
  /** Datos legales del organizador. Nunca se inventan. */
  organizerLegal?: {
    legalName?: string | null;
    taxId?: string | null;
    legalAddress?: string | null;
    contactEmail?: string | null;
    jurisdiction?: string | null;
  };
  /** Premio con sus campos obligatorios. */
  prize?: Partial<PrizeGateSnapshot> & { provisionalDescription?: string | null };
  judgesConfirmed?: boolean;
  juryPositions?: Array<{ code: string; label: string; profile: string; confirmed?: boolean }>;
  evaluationCriteria?: Array<{ code: string; label: string; weightPercent: number }>;
  cancellationAndRefundPolicyDefined?: boolean;
  /** Modelo de cobro. Por defecto DIRECT (una sola cuenta cobra). */
  paymentModel?: ContestPaymentModel;
  dnxSplitConfigValidated?: boolean;
  purchaseTestApproved?: boolean;
  photoEnablementTestApproved?: boolean;
  transactionalEmailsValidated?: boolean;
  brief?: { title: string; text: string } | null;
  technicalRequirements?: Record<string, unknown> | null;
  awards?: Record<string, unknown> | null;
  /** Banderas administrativas visibles en el panel. */
  adminFlags?: string[];
};

const EMPTY_PRIZE: PrizeGateSnapshot = {
  brand: null,
  model: null,
  includedLens: null,
  isNewProduct: null,
  warranty: null,
  referenceValue: null,
  supplier: null,
  deliveryMethod: null,
  shippingResponsible: null,
  shippingCostCoverage: null,
  officialImageUrl: null,
  outOfStockAlternative: null,
  technicalSponsor: null,
  modelPendingConfirmation: true,
};

export function parseUpcomingConfig(rulesData: unknown): UpcomingConfig {
  if (!rulesData || typeof rulesData !== "object" || Array.isArray(rulesData)) return {};
  const root = rulesData as { concursoProximo?: UpcomingConfig };
  return root.concursoProximo && typeof root.concursoProximo === "object"
    ? root.concursoProximo
    : {};
}

/** Fusiona el bloque `concursoProximo` sin tocar el resto de `rulesData`. */
export function mergeUpcomingConfig(
  rulesData: unknown,
  config: UpcomingConfig,
): Record<string, unknown> {
  const base =
    rulesData && typeof rulesData === "object" && !Array.isArray(rulesData)
      ? (rulesData as Record<string, unknown>)
      : {};
  return { ...base, concursoProximo: config };
}

function toDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function resolvePrizeSnapshot(config: UpcomingConfig): PrizeGateSnapshot {
  return { ...EMPTY_PRIZE, ...(config.prize ?? {}) } as PrizeGateSnapshot;
}

// ---------------------------------------------------------------------------
// Tarjetas públicas
// ---------------------------------------------------------------------------

export type UpcomingContestCard = {
  id: string;
  slug: string;
  title: string;
  tagline: string | null;
  summary: string | null;
  badge: string;
  contestType: string | null;
  organizerName: string;
  coverImageUrl: string | null;
  status: string;
  showNotifyButton: boolean;
};

function toCard(contest: {
  id: string;
  slug: string;
  title: string;
  shortDescription: string | null;
  fullDescription: string | null;
  coverImageUrl: string | null;
  status: string;
  rulesData: Prisma.JsonValue | null;
  organization: { name: string };
}): UpcomingContestCard {
  const config = parseUpcomingConfig(contest.rulesData);
  return {
    id: contest.id,
    slug: contest.slug,
    title: contest.title,
    tagline: contest.shortDescription,
    summary: config.cardSummary ?? contest.fullDescription,
    badge: config.cardBadge ?? "PRÓXIMAMENTE",
    contestType: config.contestType ?? null,
    organizerName: contest.organization.name,
    coverImageUrl: contest.coverImageUrl,
    status: contest.status,
    showNotifyButton: acceptsInterestRegistration(contest.status),
  };
}

const CARD_SELECT = {
  id: true,
  slug: true,
  title: true,
  shortDescription: true,
  fullDescription: true,
  coverImageUrl: true,
  status: true,
  rulesData: true,
  organization: { select: { name: true } },
} as const;

/**
 * Concursos próximos visibles públicamente.
 * Un concurso en DRAFT nunca entra: el filtro deriva de las capacidades.
 */
export async function listPublicUpcomingContests(limit = 12): Promise<UpcomingContestCard[]> {
  const rows = await prisma.fotorankContest.findMany({
    where: {
      visibility: "PUBLIC",
      status: "UPCOMING",
    },
    select: CARD_SELECT,
    orderBy: [{ registrationOpensAt: "asc" }, { createdAt: "desc" }],
    take: limit,
  });
  // Doble verificación: la política manda por sobre el filtro de la consulta.
  return rows.filter((r) => isPubliclyVisibleStatus(r.status)).map(toCard);
}

/** Tarjeta pública por slug. Devuelve null si el concurso no es visible. */
export async function getPublicContestCardBySlug(slug: string): Promise<UpcomingContestCard | null> {
  const row = await prisma.fotorankContest.findFirst({
    where: {
      slug,
      visibility: "PUBLIC",
      status: { in: PUBLICLY_VISIBLE_STATUSES as unknown as Prisma.EnumFotorankContestStatusFilter["in"] },
    },
    select: CARD_SELECT,
  });
  if (!row || !isPubliclyVisibleStatus(row.status)) return null;
  return toCard(row);
}

/**
 * Vista previa administrativa de la tarjeta. Ignora el filtro de visibilidad
 * porque el llamador ya verificó permisos sobre la organización.
 */
export async function getAdminContestCardPreview(input: {
  contestId: string;
  organizationId: string;
}): Promise<UpcomingContestCard | null> {
  const row = await prisma.fotorankContest.findFirst({
    where: { id: input.contestId, organizationId: input.organizationId },
    select: CARD_SELECT,
  });
  if (!row) return null;
  return {
    ...toCard(row),
    // En el preview siempre se muestra el botón, aunque el estado real sea DRAFT.
    showNotifyButton: true,
  };
}

// ---------------------------------------------------------------------------
// Registro de interés
// ---------------------------------------------------------------------------

export type RegisterInterestResult =
  | { ok: true; created: boolean; benefitEligible: boolean; benefitDeadlineAt: Date | null }
  | { ok: false; error: string };

async function loadExistingInterest(
  contestId: string,
  userId: number,
): Promise<ExistingInterest | null> {
  const row = await prisma.fotorankContestInterest.findUnique({
    where: { contestId_userId: { contestId, userId } },
    select: {
      id: true,
      status: true,
      registeredAt: true,
      benefitDeadlineAt: true,
      benefitEligible: true,
      consentVersion: true,
      generalOptIn: true,
    },
  });
  if (!row) return null;
  return { ...row, status: row.status as InterestStatus };
}

/**
 * Registra (o reactiva) el interés de un usuario autenticado.
 * Idempotente por (contestId, userId). Nunca extiende la fecha del beneficio.
 */
export async function registerInterest(input: {
  contestId: string;
  userId: number;
  consent: { contestSpecificOptIn: boolean; generalOptIn: boolean };
  source?: string;
  utm?: { source?: string | null; medium?: string | null; campaign?: string | null };
  ip?: string | null;
  userAgent?: string | null;
  now?: Date;
}): Promise<RegisterInterestResult> {
  const now = input.now ?? new Date();

  const contest = await prisma.fotorankContest.findUnique({
    where: { id: input.contestId },
    select: { id: true, status: true, rulesData: true },
  });
  if (!contest) return { ok: false, error: "Concurso no encontrado." };

  const config = parseUpcomingConfig(contest.rulesData);
  const existing = await loadExistingInterest(input.contestId, input.userId);

  const decision = decideRegisterInterest({
    now,
    contest: {
      contestId: contest.id,
      status: contest.status,
      interestBenefitCutoffAt: toDate(config.interestBenefitCutoffAt),
      benefitDeadlineAt: toDate(config.benefitDeadlineAt),
    },
    existing,
    consent: input.consent,
    source: input.source,
    utm: input.utm,
  });

  if (decision.action === "REJECT") return { ok: false, error: decision.error };

  const audit = (interestId: string | null, action: string, metadata?: Prisma.InputJsonValue) =>
    prisma.fotorankContestInterestAuditEvent.create({
      data: {
        contestId: input.contestId,
        interestId,
        actorUserId: input.userId,
        action,
        ip: input.ip ?? null,
        userAgent: input.userAgent ?? null,
        metadataJson: metadata,
      },
    });

  if (decision.action === "CREATE") {
    const d = decision.data;
    try {
      const created = await prisma.$transaction(async (tx) => {
        const row = await tx.fotorankContestInterest.create({
          data: {
            contestId: input.contestId,
            userId: input.userId,
            status: "ACTIVE",
            registeredAt: d.registeredAt,
            benefitEligible: d.benefitEligible,
            benefitDeadlineAt: d.benefitDeadlineAt,
            source: d.source,
            consentVersion: d.consentVersion,
            consentAcceptedAt: d.consentAcceptedAt,
            contestSpecificOptIn: true,
            generalOptIn: d.generalOptIn,
            generalOptInAt: d.generalOptInAt,
            utmSource: d.utmSource,
            utmMedium: d.utmMedium,
            utmCampaign: d.utmCampaign,
          },
          select: { id: true },
        });
        await tx.fotorankContestInterestAuditEvent.create({
          data: {
            contestId: input.contestId,
            interestId: row.id,
            actorUserId: input.userId,
            action: decision.auditAction,
            ip: input.ip ?? null,
            userAgent: input.userAgent ?? null,
            metadataJson: {
              benefitEligible: d.benefitEligible,
              consentVersion: d.consentVersion,
              generalOptIn: d.generalOptIn,
              source: d.source,
            },
          },
        });
        return row;
      });
      void created;
      return {
        ok: true,
        created: true,
        benefitEligible: d.benefitEligible,
        benefitDeadlineAt: d.benefitDeadlineAt,
      };
    } catch (e) {
      // Carrera contra la restricción única: el segundo clic simultáneo no duplica.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        const again = await loadExistingInterest(input.contestId, input.userId);
        return {
          ok: true,
          created: false,
          benefitEligible: again?.benefitEligible ?? false,
          benefitDeadlineAt: again?.benefitDeadlineAt ?? null,
        };
      }
      throw e;
    }
  }

  if (decision.action === "NOOP") {
    if (decision.generalOptInChanged) {
      await prisma.$transaction([
        prisma.fotorankContestInterest.update({
          where: { contestId_userId: { contestId: input.contestId, userId: input.userId } },
          data: {
            generalOptIn: decision.generalOptIn,
            generalOptInAt: decision.generalOptIn ? now : null,
          },
        }),
        prisma.fotorankContestInterestAuditEvent.create({
          data: {
            contestId: input.contestId,
            interestId: existing!.id,
            actorUserId: input.userId,
            action: decision.auditAction,
            ip: input.ip ?? null,
            userAgent: input.userAgent ?? null,
            metadataJson: { generalOptIn: decision.generalOptIn },
          },
        }),
      ]);
    } else {
      await audit(existing!.id, decision.auditAction);
    }
    return {
      ok: true,
      created: false,
      benefitEligible: existing!.benefitEligible,
      benefitDeadlineAt: existing!.benefitDeadlineAt,
    };
  }

  // REACTIVATE — conserva registeredAt, benefitEligible y benefitDeadlineAt.
  const d = decision.data;
  await prisma.$transaction([
    prisma.fotorankContestInterest.update({
      where: { contestId_userId: { contestId: input.contestId, userId: input.userId } },
      data: {
        status: "ACTIVE",
        cancelledAt: null,
        generalOptIn: d.generalOptIn,
        generalOptInAt: d.generalOptInAt,
        consentVersion: d.consentVersion,
        consentAcceptedAt: d.consentAcceptedAt,
      },
    }),
    prisma.fotorankContestInterestAuditEvent.create({
      data: {
        contestId: input.contestId,
        interestId: existing!.id,
        actorUserId: input.userId,
        action: decision.auditAction,
        ip: input.ip ?? null,
        userAgent: input.userAgent ?? null,
        metadataJson: { consentVersion: d.consentVersion },
      },
    }),
  ]);
  return {
    ok: true,
    created: false,
    benefitEligible: existing!.benefitEligible,
    benefitDeadlineAt: existing!.benefitDeadlineAt,
  };
}

/** Cancela la notificación. Conserva la fila y toda la auditoría. */
export async function cancelInterest(input: {
  contestId: string;
  userId: number;
  ip?: string | null;
  userAgent?: string | null;
  now?: Date;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const now = input.now ?? new Date();
  const existing = await loadExistingInterest(input.contestId, input.userId);
  const decision = decideCancelInterest({ now, existing });

  if (decision.action === "REJECT") return { ok: false, error: decision.error };
  if (decision.action === "NOOP") return { ok: true };

  await prisma.$transaction([
    prisma.fotorankContestInterest.update({
      where: { contestId_userId: { contestId: input.contestId, userId: input.userId } },
      data: { status: "CANCELLED", cancelledAt: decision.cancelledAt },
    }),
    prisma.fotorankContestInterestAuditEvent.create({
      data: {
        contestId: input.contestId,
        interestId: existing!.id,
        actorUserId: input.userId,
        action: decision.auditAction,
        ip: input.ip ?? null,
        userAgent: input.userAgent ?? null,
      },
    }),
  ]);
  return { ok: true };
}

export async function getInterestForUser(contestId: string, userId: number) {
  return loadExistingInterest(contestId, userId);
}

// ---------------------------------------------------------------------------
// Panel administrativo de interesados
// ---------------------------------------------------------------------------

export type AdminInterestRow = {
  id: string;
  userId: number;
  displayName: string;
  status: InterestStatus;
  registeredAt: Date;
  benefitEligible: boolean;
  benefitDeadlineAt: Date | null;
  source: string;
  contestSpecificOptIn: boolean;
  generalOptIn: boolean;
  province: string | null;
  city: string | null;
  selectedPackageCode: string | null;
  convertedAt: Date | null;
};

export type AdminInterestPanel = {
  stats: InterestStats;
  rows: AdminInterestRow[];
  /** Recaudación real: requiere DNX Payments. */
  revenue: { potentialMinor: number | null; realMinor: number | null; available: boolean };
};

/**
 * Lista los interesados de un concurso. Exige que el concurso pertenezca a la
 * organización indicada: sin ese filtro habría fuga entre organizadores.
 */
export async function getAdminInterestPanel(input: {
  contestId: string;
  organizationId: string;
  limit?: number;
}): Promise<AdminInterestPanel | null> {
  const contest = await prisma.fotorankContest.findFirst({
    where: { id: input.contestId, organizationId: input.organizationId },
    select: { id: true },
  });
  if (!contest) return null;

  const rows = await prisma.fotorankContestInterest.findMany({
    where: { contestId: input.contestId },
    select: {
      id: true,
      userId: true,
      status: true,
      registeredAt: true,
      benefitEligible: true,
      benefitDeadlineAt: true,
      source: true,
      contestSpecificOptIn: true,
      generalOptIn: true,
      selectedPackageCode: true,
      convertedAt: true,
      // Sólo los datos de perfil estrictamente necesarios. Sin email ni documento.
      user: { select: { name: true, province: true, city: true } },
    },
    orderBy: { registeredAt: "desc" },
    take: input.limit ?? 500,
  });

  const stats = computeInterestStats(
    rows.map((r) => ({ status: r.status as InterestStatus, benefitEligible: r.benefitEligible })),
  );

  return {
    stats,
    rows: rows.map((r) => ({
      id: r.id,
      userId: r.userId,
      displayName: r.user.name?.trim() || `Usuario #${r.userId}`,
      status: r.status as InterestStatus,
      registeredAt: r.registeredAt,
      benefitEligible: r.benefitEligible,
      benefitDeadlineAt: r.benefitDeadlineAt,
      source: r.source,
      contestSpecificOptIn: r.contestSpecificOptIn,
      generalOptIn: r.generalOptIn,
      province: r.user.province,
      city: r.user.city,
      selectedPackageCode: r.selectedPackageCode,
      convertedAt: r.convertedAt,
    })),
    revenue: {
      potentialMinor: null,
      realMinor: null,
      // Se habilita junto con DNX Payments.
      available: isDnxPaymentsEnabled(),
    },
  };
}

/** Escapa un campo para CSV. Previene inyección de fórmulas en planillas. */
export function toCsvField(value: unknown): string {
  const raw = value === null || value === undefined ? "" : String(value);
  const guarded = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  return `"${guarded.replace(/"/g, '""')}"`;
}

/** CSV administrativo. Sólo los campos necesarios: sin email ni documento. */
export function buildInterestCsv(rows: AdminInterestRow[]): string {
  const header = [
    "id",
    "usuario",
    "estado",
    "registrado_en",
    "elegible_beneficio",
    "vence_beneficio",
    "origen",
    "consentimiento_concurso",
    "consentimiento_general",
    "provincia",
    "localidad",
    "paquete",
    "convertido_en",
  ];
  const lines = [header.map(toCsvField).join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.id,
        r.displayName,
        r.status,
        r.registeredAt.toISOString(),
        r.benefitEligible ? "si" : "no",
        r.benefitDeadlineAt ? r.benefitDeadlineAt.toISOString() : "",
        r.source,
        r.contestSpecificOptIn ? "si" : "no",
        r.generalOptIn ? "si" : "no",
        r.province ?? "",
        r.city ?? "",
        r.selectedPackageCode ?? "",
        r.convertedAt ? r.convertedAt.toISOString() : "",
      ]
        .map(toCsvField)
        .join(","),
    );
  }
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Precios
// ---------------------------------------------------------------------------

export async function loadPricePhases(contestId: string): Promise<PricePhase[]> {
  const rows = await prisma.fotorankContestPricePhase.findMany({
    where: { contestId },
    include: { tiers: { orderBy: { sortOrder: "asc" } } },
    orderBy: [{ priority: "asc" }, { startsAt: "asc" }],
  });
  return rows.map((p) => ({
    code: p.code,
    name: p.name,
    audience: p.audience as PricePhase["audience"],
    startsAt: p.startsAt,
    endsAt: p.endsAt,
    currency: p.currency,
    priority: p.priority,
    isActive: p.isActive,
    tiers: p.tiers.map((t) => ({
      quantity: t.quantity,
      amountMinor: t.amountMinor,
      label: t.label,
    })),
  }));
}

/**
 * Precio efectivo calculado íntegramente en el servidor.
 * El cliente no aporta ningún importe: sólo la cantidad de fotografías.
 */
export async function resolveServerPrice(input: {
  contestId: string;
  userId: number | null;
  quantity: number;
  now?: Date;
}): Promise<PriceResolution> {
  const now = input.now ?? new Date();
  const [phases, interest] = await Promise.all([
    loadPricePhases(input.contestId),
    input.userId ? loadExistingInterest(input.contestId, input.userId) : Promise.resolve(null),
  ]);
  return resolvePrice({
    now,
    quantity: input.quantity,
    phases,
    eligibility: toPricingEligibility(interest),
  });
}

// ---------------------------------------------------------------------------
// Gates y transiciones de fase
// ---------------------------------------------------------------------------

/** Snapshot para evaluar los gates. Lee todo lo necesario en una sola pasada. */
export async function buildGateSnapshot(input: {
  contestId: string;
  organizationId: string;
}): Promise<ContestGateSnapshot | null> {
  const contest = await prisma.fotorankContest.findFirst({
    where: { id: input.contestId, organizationId: input.organizationId },
    select: {
      title: true,
      shortDescription: true,
      fullDescription: true,
      coverImageUrl: true,
      timezone: true,
      rulesData: true,
      registrationOpensAt: true,
      submissionDeadline: true,
      organization: { select: { name: true } },
      rulesVersions: {
        where: { status: "PUBLISHED" },
        select: { id: true, content: true, legalReviewStatus: true, approvedAt: true },
        orderBy: { versionNumber: "desc" },
        take: 1,
      },
      pricePhases: { select: { id: true }, take: 1 },
    },
  });
  if (!contest) return null;

  const config = parseUpcomingConfig(contest.rulesData);
  const publishedRules = contest.rulesVersions[0] ?? null;
  const legal = config.organizerLegal ?? {};

  const scheduleConsistent =
    !contest.registrationOpensAt ||
    !contest.submissionDeadline ||
    contest.registrationOpensAt.getTime() < contest.submissionDeadline.getTime();

  return {
    title: contest.title,
    shortDescription: contest.shortDescription,
    fullDescription: contest.fullDescription,
    coverImageUrl: contest.coverImageUrl,
    organizationName: contest.organization.name,
    timezone: contest.timezone,
    interestBenefitCutoffAt: toDate(config.interestBenefitCutoffAt),
    benefitDeadlineAt: toDate(config.benefitDeadlineAt),
    consentVersion: CURRENT_CONSENT_VERSION,
    privacyPolicyUrl: config.privacyPolicyUrl ?? null,
    interestConfirmationTemplateValidated: Boolean(config.interestConfirmationTemplateValidated),
    communicationsSafeModeConfigured: Boolean(config.communicationsSafeModeConfigured),
    previewApprovedAt: toDate(config.previewApprovedAt),
    organizerLegalName: legal.legalName ?? null,
    organizerTaxId: legal.taxId ?? null,
    organizerLegalAddress: legal.legalAddress ?? null,
    organizerContactEmail: legal.contactEmail ?? null,
    rulesPublishedVersionId: publishedRules?.id ?? null,
    // "Aprobada" = revisada por legales, con aprobación registrada y sin
    // marcadores `[[PENDIENTE: …]]` en el texto publicado.
    rulesLegalReviewApproved:
      publishedRules?.legalReviewStatus === "REVIEWED" &&
      publishedRules.approvedAt !== null &&
      !contentHasLegalPlaceholder(publishedRules.content),
    judgesConfirmed: Boolean(config.judgesConfirmed),
    prize: resolvePrizeSnapshot(config),
    pricePhasesConfigured: contest.pricePhases.length > 0,
    // Cobro directo por defecto: sólo un concurso que reparta con terceros
    // necesita el modelo SPLIT_1N.
    paymentModel: config.paymentModel ?? "DIRECT",
    checkoutConfigured: checkConfigReadiness().ready,
    dnxPaymentsEnabled: isDnxPaymentsEnabled(),
    dnxSplitConfigValidated: Boolean(config.dnxSplitConfigValidated),
    cancellationAndRefundPolicyDefined: Boolean(config.cancellationAndRefundPolicyDefined),
    purchaseTestApproved: Boolean(config.purchaseTestApproved),
    photoEnablementTestApproved: Boolean(config.photoEnablementTestApproved),
    transactionalEmailsValidated: Boolean(config.transactionalEmailsValidated),
    scheduleConsistent,
  };
}

export type TransitionResult =
  | { ok: true; from: string; to: ContestLifecyclePhase }
  | { ok: false; error: string; gate?: GateReport };

/**
 * Cambia la fase del concurso. Acción administrativa explícita: valida la
 * transición, evalúa el gate correspondiente y audita el resultado.
 *
 * `override` sólo lo puede pasar un llamador autorizado y queda registrado.
 */
export async function transitionContestPhase(input: {
  contestId: string;
  organizationId: string;
  actorUserId: number;
  target: ContestLifecyclePhase;
  override?: boolean;
  overrideReason?: string;
  ip?: string | null;
  userAgent?: string | null;
}): Promise<TransitionResult> {
  const contest = await prisma.fotorankContest.findFirst({
    where: { id: input.contestId, organizationId: input.organizationId },
    select: { id: true, status: true },
  });
  if (!contest) return { ok: false, error: "Concurso no encontrado." };

  const transition = canTransition(contest.status, input.target);
  if (!transition.allowed) return { ok: false, error: transition.reason };

  const snapshot = await buildGateSnapshot({
    contestId: input.contestId,
    organizationId: input.organizationId,
  });
  if (!snapshot) return { ok: false, error: "No se pudo leer la configuración del concurso." };

  const gate = evaluateGateForTarget(input.target, snapshot, { override: input.override });
  if (gate && !gate.passed) {
    return {
      ok: false,
      error: `Faltan datos obligatorios: ${gate.missing.join(", ")}.`,
      gate,
    };
  }

  if (input.override && !input.overrideReason?.trim()) {
    return { ok: false, error: "La anulación administrativa requiere un motivo registrado." };
  }

  await prisma.$transaction([
    prisma.fotorankContest.update({
      where: { id: input.contestId },
      data: { status: input.target },
    }),
    prisma.fotorankPlatformAuditEvent.create({
      data: {
        actorUserId: input.actorUserId,
        action: `FOTORANK_CONTEST_PHASE_${contest.status}_TO_${input.target}`,
        organizationId: input.organizationId,
        contestId: input.contestId,
        ip: input.ip ?? null,
        userAgent: input.userAgent ?? null,
        metadataJson: {
          from: contest.status,
          to: input.target,
          override: Boolean(input.override),
          overrideReason: input.overrideReason ?? null,
          missingAtTransition: gate?.missing ?? [],
        },
      },
    }),
  ]);

  return { ok: true, from: contest.status, to: input.target };
}
