/**
 * Upsert de la edici?n comercial Clickat?n Argentina 2026.
 * Estado seguro por defecto: DRAFT, no publicada, registrationEnabled=false.
 * Etapa 8B: Remera en ClickatonPricePhaseItem (Fase 1), no en ticket GENERAL.
 * Ticket base = acceso/inscripci?n; merch comercial depende de la fase.
 *
 * Usage:
 *   CLICKATON_SEED_ARGENTINA_2026=1 pnpm --filter clickaton seed:argentina-2026
 *
 * Pre-launch landing (publicado, inscripciones cerradas):
 *   CLICKATON_SEED_ARGENTINA_2026=1 CLICKATON_SEED_PUBLISH_LANDING=1 \
 *     pnpm --filter clickaton seed:argentina-2026
 */

import { pathToFileURL } from "node:url";
import { prisma } from "@repo/db";
import {
  ARGENTINA_2026_MERCH,
  ARGENTINA_2026_RULES,
  ARGENTINA_2026_SCHEDULE,
  ARGENTINA_2026_SHIRT_SIZES,
  argentina2026EventEndAt,
  argentina2026EventStartAt,
  CLICKATON_ARGENTINA_2026,
  CLICKATON_TERMS_VERSION,
} from "../config/editions/argentina-2026";
import {
  ARGENTINA_2026_FEE_POLICY,
  CLICKATON_PRODUCT_KEY,
  DEFAULT_ROUNDING_POLICY,
  EDITION_SCOPE_TYPE,
  FINANCE_SEED_EMAILS,
  PERCENTAGE_BPS_TOTAL,
} from "../lib/admin/edition-finance/constants";
import { pesosToMinorUnits } from "../lib/pricing/domain/resolve-price-phase";
const CAPABILITY_MANAGE_TIMELINE = "canManageEditionTimeline";
const CAPABILITY_RELEASE_PROMPTS = "canReleaseEditionPrompts";

const S = ARGENTINA_2026_SCHEDULE;

/** Horarios Schedule V2 (10G.3) ? ISO con offset ?03:00. Captura ? upload. */
const TIMELINE_BASE_EVENTS = [
  { eventType: "REGISTRATION_OPEN" as const, name: "Apertura de inscripciones", sequence: 10, isCritical: true, startsAt: null as string | null, endsAt: null as string | null },
  { eventType: "REGISTRATION_CLOSE" as const, name: "Cierre de inscripciones", sequence: 20, isCritical: true, startsAt: null, endsAt: null },
  { eventType: "ACCREDITATION_OPEN" as const, name: "Apertura de acreditaciùn", sequence: 30, isCritical: true, startsAt: S.accreditationOpenIso, endsAt: S.accreditationCloseIso },
  { eventType: "ACCREDITATION_CLOSE" as const, name: "Cierre de acreditaciùn", sequence: 35, isCritical: true, startsAt: S.accreditationCloseIso, endsAt: S.accreditationCloseIso },
  { eventType: "CUSTOM" as const, name: "Charla introductoria", sequence: 37, isCritical: false, startsAt: S.talkOpenIso, endsAt: S.talkCloseIso },
  { eventType: "MARATHON_START" as const, name: "Inicio oficial ù captura y carga", sequence: 40, isCritical: true, startsAt: S.marathonStartIso, endsAt: S.marathonEndIso },
  { eventType: "PROMPT_RELEASE" as const, name: "Reveal de las 10 consignas", sequence: 50, isCritical: true, startsAt: S.promptsRevealIso, endsAt: S.uploadCloseIso },
  { eventType: "UPLOAD_WINDOW_OPEN" as const, name: "Apertura de subida (16:00)", sequence: 70, isCritical: true, startsAt: S.uploadOpenIso, endsAt: S.uploadCloseIso },
  { eventType: "CAPTURE_WINDOW_CLOSE" as const, name: "Cierre de captura (20:00 exclusive)", sequence: 75, isCritical: false, startsAt: S.captureCloseIso, endsAt: S.captureCloseIso },
  { eventType: "UPLOAD_WINDOW_CLOSE" as const, name: "Cierre de entrega (22:00 exclusive)", sequence: 80, isCritical: true, startsAt: S.uploadCloseIso, endsAt: S.uploadCloseIso },
  { eventType: "MARATHON_END" as const, name: "Fin del perùodo de entrega", sequence: 90, isCritical: true, startsAt: S.marathonEndIso, endsAt: S.marathonEndIso },
  { eventType: "JUDGING_OPEN" as const, name: "Apertura de jurado", sequence: 95, isCritical: true, startsAt: null, endsAt: null },
  { eventType: "JUDGING_CLOSE" as const, name: "Cierre de jurado", sequence: 98, isCritical: true, startsAt: null, endsAt: null },
  { eventType: "RESULTS_RELEASE" as const, name: "Resultados", sequence: 100, isCritical: false, startsAt: null, endsAt: null },
];

async function seedFinanceGrantsAndDraft(editionId: string): Promise<{
  grantsUpserted: number;
  agreementId: string | null;
  versionId: string | null;
  tammyUserId: number | null;
  tammyIdentityId: string | null;
  tammyPaymentAccountId: string | null;
  distributionActivated: boolean;
}> {
  const findUser = (email: string) =>
    prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      select: { id: true },
    });

  const daniel = await findUser(FINANCE_SEED_EMAILS.daniel);
  const rodri = await findUser(FINANCE_SEED_EMAILS.rodri);
  const tammy = await findUser(FINANCE_SEED_EMAILS.tammy);

  let grantsUpserted = 0;
  async function ensureGrant(
    userId: number,
    capability: "DNX_FINANCE_OWNER" | "PRODUCT_FINANCE_VIEWER" | "PRODUCT_FINANCE_MANAGER",
    productKey: string | null,
  ) {
    const existing = await prisma.dnxFinanceGrant.findFirst({
      where: { userId, capability, productKey, status: "ACTIVE" },
    });
    if (existing) return;
    await prisma.dnxFinanceGrant.create({
      data: {
        userId,
        capability,
        productKey,
        scopeType: productKey ? EDITION_SCOPE_TYPE : null,
        scopeId: null,
        status: "ACTIVE",
        grantedByUserId: daniel?.id ?? null,
      },
    });
    grantsUpserted += 1;
  }

  if (daniel) {
    await ensureGrant(daniel.id, "DNX_FINANCE_OWNER", null);
    await ensureGrant(daniel.id, "PRODUCT_FINANCE_MANAGER", CLICKATON_PRODUCT_KEY);
  }
  if (rodri) await ensureGrant(rodri.id, "PRODUCT_FINANCE_VIEWER", CLICKATON_PRODUCT_KEY);
  if (tammy) await ensureGrant(tammy.id, "PRODUCT_FINANCE_VIEWER", CLICKATON_PRODUCT_KEY);

  if (!tammy || !daniel) {
    return {
      grantsUpserted,
      agreementId: null,
      versionId: null,
      tammyUserId: tammy?.id ?? null,
      tammyIdentityId: null,
      tammyPaymentAccountId: null,
      distributionActivated: false,
    };
  }

  let identity = await prisma.dnxFinancialIdentity.findFirst({
    where: { ownerUserId: tammy.id, subjectType: "PERSON" },
  });
  if (!identity) {
    identity = await prisma.dnxFinancialIdentity.create({
      data: {
        subjectType: "PERSON",
        ownerUserId: tammy.id,
        isPrimary: true,
        legalName: "Tammy",
        countryCode: "AR",
        status: "ACTIVE",
      },
    });
  }

  const account = await prisma.dnxPaymentAccount.findFirst({
    where: {
      financialIdentityId: identity.id,
      status: "ACTIVE",
    },
    orderBy: { updatedAt: "desc" },
  });

  let agreement = await prisma.dnxEconomicAgreement.findUnique({
    where: {
      productKey_scopeType_scopeId: {
        productKey: CLICKATON_PRODUCT_KEY,
        scopeType: EDITION_SCOPE_TYPE,
        scopeId: editionId,
      },
    },
  });
  if (!agreement) {
    agreement = await prisma.dnxEconomicAgreement.create({
      data: {
        productKey: CLICKATON_PRODUCT_KEY,
        scopeType: EDITION_SCOPE_TYPE,
        scopeId: editionId,
        name: "Clickat?n Argentina 2026 ??? Tammy 100%",
        countryCode: "AR",
        currency: "ARS",
        status: "DRAFT",
        createdByUserId: daniel.id,
      },
    });
  }

  let version = await prisma.dnxDistributionVersion.findFirst({
    where: { agreementId: agreement.id, status: "DRAFT" },
  });
  if (!version) {
    const max = await prisma.dnxDistributionVersion.aggregate({
      where: { agreementId: agreement.id },
      _max: { versionNumber: true },
    });
    version = await prisma.dnxDistributionVersion.create({
      data: {
        agreementId: agreement.id,
        versionNumber: (max._max.versionNumber ?? 0) + 1,
        status: "DRAFT",
        roundingPolicy: DEFAULT_ROUNDING_POLICY,
        feePolicy: ARGENTINA_2026_FEE_POLICY,
      },
    });
  }

  const participant = await prisma.dnxAgreementParticipant.upsert({
    where: {
      agreementId_financialIdentityId: {
        agreementId: agreement.id,
        financialIdentityId: identity.id,
      },
    },
    create: {
      agreementId: agreement.id,
      financialIdentityId: identity.id,
      paymentAccountId: account?.id ?? null,
      roleLabel: "ORGANIZER",
      status: "ACCEPTED",
      invitedByUserId: daniel.id,
      acceptedAt: new Date(),
    },
    update: {
      paymentAccountId: account?.id ?? null,
      status: "ACCEPTED",
    },
  });

  const rule = await prisma.dnxDistributionRule.findFirst({
    where: {
      distributionVersionId: version.id,
      agreementParticipantId: participant.id,
    },
  });
  if (!rule) {
    await prisma.dnxDistributionRule.create({
      data: {
        distributionVersionId: version.id,
        agreementParticipantId: participant.id,
        kind: "PERCENTAGE",
        value: BigInt(PERCENTAGE_BPS_TOTAL),
        priority: 10,
      },
    });
  }

  await prisma.clickatonEdition.update({
    where: { id: editionId },
    data: {
      paymentBeneficiaryConfig: {
        agreementId: agreement.id,
        productKey: CLICKATON_PRODUCT_KEY,
        scopeType: EDITION_SCOPE_TYPE,
        policy: "edition_scoped_dnx",
        beneficiaryHint: "tammy_100_distributable_after_provider_fee",
      },
    },
  });

  // Nunca activar autom?ticamente sin conexi?n MP v?lida.
  const distributionActivated = false;

  return {
    grantsUpserted,
    agreementId: agreement.id,
    versionId: version.id,
    tammyUserId: tammy.id,
    tammyIdentityId: identity.id,
    tammyPaymentAccountId: account?.id ?? null,
    distributionActivated,
  };
}

/** Ventanas iniciales editables desde admin (TZ Argentina). */
const DEFAULT_PHASES = [
  {
    name: "Primera etapa",
    amountPesos: 25_000,
    startsAt: "2026-07-31T00:00:00-03:00",
    endsAt: "2026-08-20T23:59:59-03:00",
    priority: 10,
  },
  {
    name: "Segunda etapa",
    amountPesos: 30_000,
    startsAt: "2026-08-21T00:00:00-03:00",
    endsAt: "2026-09-05T23:59:59-03:00",
    priority: 20,
  },
  {
    name: "Tercera etapa",
    amountPesos: 35_000,
    startsAt: "2026-09-06T00:00:00-03:00",
    endsAt: "2026-09-18T23:59:59-03:00",
    priority: 30,
  },
] as const;

export async function seedArgentina2026Edition(): Promise<{
  editionId: string;
  slug: string;
  status: string;
  registrationEnabled: boolean;
  isPublished: boolean;
  startAt: string;
  pricePhaseCount: number;
  productId: string;
  productCode: string;
  variantCount: number;
  ticketTypeId: string;
  ticketCode: string;
  /** null tras migraci?n 8B (remera ya no vive en ticket base). */
  ticketItemId: string | null;
  phaseItemIds: string[];
  phasesWithShirt: string[];
  finance: {
    grantsUpserted: number;
    agreementId: string | null;
    versionId: string | null;
    tammyUserId: number | null;
    tammyIdentityId: string | null;
    tammyPaymentAccountId: string | null;
    distributionActivated: boolean;
  };
  timeline: {
    id: string;
    version: number;
    status: string;
    timezone: string;
    activated: boolean;
    placeholderPromptCount: number;
    capabilityGrantsUpserted: number;
  };
  uploadConfig: {
    uploadsEnabled: boolean;
    captureClockToleranceMinutes: number;
    defaultGpsMode: string;
  };
  accreditationConfig: {
    accreditationEnabled: boolean;
    identityMode: string;
    geofenceMode: string;
  };
  admissionConfig: {
    admissionEnabled: boolean;
    accreditationRequiredForAdmission: string;
    rulesVersion: string;
  };
  juryScoring: {
    scoringEnabled: boolean;
    live: boolean;
    note: string;
  };
  rankingResults: {
    rankingEnabled: boolean;
    published: boolean;
    note: string;
  };
}> {
  const cfg = CLICKATON_ARGENTINA_2026;
  const merch = ARGENTINA_2026_MERCH;
  const startAt = argentina2026EventStartAt();
  const endAt = argentina2026EventEndAt();
  /** Landing p?blica sin abrir cobro: isPublished=true, registrationEnabled=false. */
  const publishLanding = process.env.CLICKATON_SEED_PUBLISH_LANDING === "1";

  const edition = await prisma.clickatonEdition.upsert({
    where: { slug: cfg.slug },
    create: {
      name: cfg.name,
      slug: cfg.slug,
      shortDescription: cfg.shortDescription,
      description: cfg.description,
      status: cfg.status,
      isPublished: publishLanding ? true : cfg.isPublished,
      registrationEnabled: false,
      timezone: cfg.timezone,
      startAt,
      endAt,
      registrationOpenAt: null,
      registrationCloseAt: null,
      defaultCapacity: null,
      location: cfg.location,
      city: cfg.city,
      provinceOrState: cfg.provinceOrState,
      country: cfg.country,
      currency: cfg.currency,
      visibleCodePrefix: cfg.visibleCodePrefix,
      // Etapa 7: sync OFF hasta validar concurso real.
      fotorankContestId: null,
      fotoRankSyncEnabled: false,
      fotoRankSyncMode: "DISABLED",
      fotoRankValidationStatus: "NOT_CONFIGURED",
      fotoRankValidationError: null,
    },
    update: {
      name: cfg.name,
      shortDescription: cfg.shortDescription,
      description: cfg.description,
      timezone: cfg.timezone,
      startAt,
      endAt,
      location: cfg.location,
      country: cfg.country,
      currency: cfg.currency,
      visibleCodePrefix: cfg.visibleCodePrefix,
      // No forzar OPEN/cobro. Landing pre-launch opcional.
      ...(publishLanding
        ? { isPublished: true, registrationEnabled: false }
        : {}),
    },
  });

  const existingPhases = await prisma.clickatonRegistrationPricePhase.count({
    where: { editionId: edition.id },
  });
  if (existingPhases === 0) {
    await prisma.clickatonRegistrationPricePhase.createMany({
      data: DEFAULT_PHASES.map((p) => ({
        editionId: edition.id,
        name: p.name,
        description: "Fase inicial ??? fechas editables desde administraci?n.",
        amount: pesosToMinorUnits(p.amountPesos),
        currency: "ARS",
        startsAt: new Date(p.startsAt),
        endsAt: new Date(p.endsAt),
        capacity: null,
        priority: p.priority,
        isActive: true,
      })),
    });
  }

  const product = await prisma.clickatonProduct.upsert({
    where: {
      editionId_code: { editionId: edition.id, code: merch.productCode },
    },
    create: {
      editionId: edition.id,
      name: merch.productName,
      description: merch.productDescription,
      code: merch.productCode,
      isActive: true,
      isStoreEnabled: false,
      storeStatus: "DRAFT",
      storeSlug: merch.storeSlug,
      storeTitle: merch.storeTitle,
      storeDescription: merch.storeDescription,
      storePrice: pesosToMinorUnits(merch.storePricePesos),
      storeCurrency: "ARS",
      allowPickup: true,
      requiresShipping: false,
    },
    update: {
      name: merch.productName,
      description: merch.productDescription,
      isActive: true,
      storeSlug: merch.storeSlug,
      storeTitle: merch.storeTitle,
      storeDescription: merch.storeDescription,
      // No forzar storePrice/isStoreEnabled en re-runs (admin puede haber ajustado).
    },
  });

  for (const size of ARGENTINA_2026_SHIRT_SIZES) {
    const sku = `CKA26-${merch.productCode}-${size.code}`;
    await prisma.clickatonProductVariant.upsert({
      where: {
        productId_code: { productId: product.id, code: size.code },
      },
      create: {
        productId: product.id,
        code: size.code,
        name: size.name,
        sku,
        stock: merch.placeholderStockPerSize,
        reservedStock: 0,
        priceAmount: null,
        currency: null,
        sortOrder: size.sortOrder,
        isActive: true,
      },
      update: {
        name: size.name,
        sku,
        sortOrder: size.sortOrder,
        isActive: true,
        // No resetear stock/reserved en re-runs (preserva holds reales).
      },
    });
  }

  const variantCount = await prisma.clickatonProductVariant.count({
    where: { productId: product.id, isActive: true },
  });

  const ticket = await prisma.clickatonTicketType.upsert({
    where: {
      editionId_code: { editionId: edition.id, code: merch.ticketCode },
    },
    create: {
      editionId: edition.id,
      venueId: null,
      name: merch.ticketName,
      description:
        "Inscripci?n general. Los art?culos promocionales (remera, etc.) dependen de la fase de precio vigente.",
      code: merch.ticketCode,
      priceAmount: pesosToMinorUnits(merch.ticketPricePesos),
      currency: "ARS",
      capacity: null,
      holdMinutes: 20,
      isActive: true,
      salesStartAt: null,
      salesEndAt: null,
    },
    update: {
      name: merch.ticketName,
      description:
        "Inscripci?n general. Los art?culos promocionales (remera, etc.) dependen de la fase de precio vigente.",
      // Conservar priceAmount/capacity/active si ya se ajust? en admin.
    },
  });

  // Pack 4 maratones ($100.000 / 4 crÈditos / 2 aÒos) ó oferta global por ediciÛn.
  const { ensureMarathonPackTicket } = await import("@/lib/packs/ensure-pack-ticket");
  await ensureMarathonPackTicket(edition.id);

  // Migraci?n 8B: quitar Remera del ticket base (no tocar RegistrationItem hist?ricos).
  await prisma.clickatonTicketTypeItem.deleteMany({
    where: { ticketTypeId: ticket.id, productId: product.id },
  });

  const phases = await prisma.clickatonRegistrationPricePhase.findMany({
    where: { editionId: edition.id },
    orderBy: [{ priority: "asc" }, { startsAt: "asc" }],
  });

  const shirtAmounts = new Set(
    merch.includeShirtInPhaseAmountPesos.map((p) => pesosToMinorUnits(p)),
  );
  const phaseItemIds: string[] = [];
  const phasesWithShirt: string[] = [];

  for (const phase of phases) {
    const shouldInclude = shirtAmounts.has(phase.amount);
    const existingPhaseItem = await prisma.clickatonPricePhaseItem.findUnique({
      where: {
        pricePhaseId_productId: { pricePhaseId: phase.id, productId: product.id },
      },
    });

    if (shouldInclude) {
      const benefitDeadlineAt = new Date(merch.benefitDeadlineIso);
      const benefitCopy =
        "Remera Clickat?n incluida para los primeros 100 inscriptos con pago confirmado o hasta el 30 de agosto, lo que ocurra primero.";
      const item = existingPhaseItem
        ? await prisma.clickatonPricePhaseItem.update({
            where: { id: existingPhaseItem.id },
            data: {
              quantity: merch.includedQuantity,
              requiresVariantChoice: true,
              isIncluded: true,
              fulfillmentRequired: true,
              sortOrder: 10,
              stockLimit: merch.firstNBenefitLimit,
              benefitDeadlineAt,
              displayTitle: merch.productName,
              displayDescription: benefitCopy,
            },
          })
        : await prisma.clickatonPricePhaseItem.create({
            data: {
              pricePhaseId: phase.id,
              productId: product.id,
              quantity: merch.includedQuantity,
              requiresVariantChoice: true,
              isIncluded: true,
              fulfillmentRequired: true,
              sortOrder: 10,
              stockLimit: merch.firstNBenefitLimit,
              benefitDeadlineAt,
              displayTitle: merch.productName,
              displayDescription: benefitCopy,
            },
          });
      phaseItemIds.push(item.id);
      phasesWithShirt.push(phase.name);
    } else if (existingPhaseItem && existingPhaseItem.isIncluded) {
      // No forzar baja si admin ya configur? Fase 2/3 con remera.
      // Solo omitir creaci?n; no desactivar configuraciones manuales.
    }
  }

  const pricePhaseCount = phases.length;

  const finance = await seedFinanceGrantsAndDraft(edition.id);

  // Etapa 10 ??? timeline DRAFT (sin horarios inventados) + prompts vac?os + grants.
  const timelineActor =
    (await prisma.user.findFirst({
      where: { email: { equals: FINANCE_SEED_EMAILS.daniel, mode: "insensitive" } },
      select: { id: true },
    })) ?? null;

  await prisma.clickatonEdition.update({
    where: { id: edition.id },
    data: {
      timezone: CLICKATON_ARGENTINA_2026.timezone,
      startAt: argentina2026EventStartAt(),
      endAt: argentina2026EventEndAt(),
      rulesConfig: {
        termsVersion: CLICKATON_TERMS_VERSION,
        schedule: ARGENTINA_2026_SCHEDULE,
        rules: ARGENTINA_2026_RULES,
        cameraClockWarningEs: ARGENTINA_2026_RULES.cameraClockWarningEs,
      },
    },
  });

  let timeline = await prisma.clickatonEditionTimeline.findFirst({
    where: { editionId: edition.id, status: "DRAFT" },
  });
  if (!timeline) {
    const last = await prisma.clickatonEditionTimeline.findFirst({
      where: { editionId: edition.id },
      orderBy: { version: "desc" },
    });
    timeline = await prisma.clickatonEditionTimeline.create({
      data: {
        editionId: edition.id,
        version: (last?.version ?? 0) + 1,
        status: "DRAFT",
        timezone: CLICKATON_ARGENTINA_2026.timezone,
        createdByUserId: timelineActor?.id ?? null,
        events: {
          create: TIMELINE_BASE_EVENTS.map((e) => ({
            eventType: e.eventType,
            name: e.name,
            sequence: e.sequence,
            isCritical: e.isCritical,
            startsAt: e.startsAt ? new Date(e.startsAt) : null,
            endsAt: e.endsAt ? new Date(e.endsAt) : null,
            visibilityPolicy: "PUBLIC_SAFE",
            triggerMode: "SCHEDULED",
          })),
        },
      },
    });
  } else {
    await prisma.clickatonEditionTimeline.update({
      where: { id: timeline.id },
      data: { timezone: CLICKATON_ARGENTINA_2026.timezone },
    });
    for (const e of TIMELINE_BASE_EVENTS) {
      const existing = await prisma.clickatonTimelineEvent.findFirst({
        where: { timelineId: timeline.id, sequence: e.sequence },
      });
      if (existing) {
        await prisma.clickatonTimelineEvent.update({
          where: { id: existing.id },
          data: {
            eventType: e.eventType,
            name: e.name,
            isCritical: e.isCritical,
            startsAt: e.startsAt ? new Date(e.startsAt) : null,
            endsAt: e.endsAt ? new Date(e.endsAt) : null,
          },
        });
      } else {
        await prisma.clickatonTimelineEvent.create({
          data: {
            timelineId: timeline.id,
            eventType: e.eventType,
            name: e.name,
            sequence: e.sequence,
            isCritical: e.isCritical,
            startsAt: e.startsAt ? new Date(e.startsAt) : null,
            endsAt: e.endsAt ? new Date(e.endsAt) : null,
            visibilityPolicy: "PUBLIC_SAFE",
            triggerMode: "SCHEDULED",
          },
        });
      }
    }
  }

  const PLACEHOLDER_PROMPTS = ARGENTINA_2026_RULES.totalPrompts;
  const captureOpen = new Date(S.captureOpenIso);
  const captureClose = new Date(S.captureCloseIso);
  const uploadOpen = new Date(S.uploadOpenIso);
  const uploadClose = new Date(S.uploadCloseIso);
  for (let i = 1; i <= PLACEHOLDER_PROMPTS; i += 1) {
    await prisma.clickatonPrompt.upsert({
      where: { editionId_sequence: { editionId: edition.id, sequence: i } },
      create: {
        editionId: edition.id,
        sequence: i,
        internalName: `argentina-2026-prompt-${i}`,
        title: null,
        instructions: null,
        status: "DRAFT",
        releaseMode: "SCHEDULED",
        minEntries: 0,
        maxEntries: 1,
        allowReplacement: true,
        required: i <= ARGENTINA_2026_RULES.competitiveMinValidPrompts,
        gpsMode: "OPTIONAL",
        captureStartsAt: captureOpen,
        captureEndsAt: captureClose,
        uploadStartsAt: uploadOpen,
        uploadEndsAt: uploadClose,
        createdByUserId: timelineActor?.id ?? null,
      },
      update: {
        internalName: `argentina-2026-prompt-${i}`,
        maxEntries: 1,
        gpsMode: "OPTIONAL",
        required: i <= ARGENTINA_2026_RULES.competitiveMinValidPrompts,
        captureStartsAt: captureOpen,
        captureEndsAt: captureClose,
        uploadStartsAt: uploadOpen,
        uploadEndsAt: uploadClose,
      },
    });
  }

  for (let slot = 1; slot <= ARGENTINA_2026_RULES.prizeBundleCount; slot += 1) {
    await prisma.clickatonPrizeBundle.upsert({
      where: { editionId_slot: { editionId: edition.id, slot } },
      create: {
        editionId: edition.id,
        slot,
        name: `Premio bundle ${slot}`,
        description: "Contenido definitivo pendiente de sponsors (no bloquea inscripci?n).",
        status: "DRAFT",
      },
      update: {
        name: `Premio bundle ${slot}`,
      },
    });
  }

  const uploadConfig = await prisma.clickatonEditionUploadConfig.upsert({
    where: { editionId: edition.id },
    create: {
      editionId: edition.id,
      uploadsEnabled: false,
      captureClockToleranceMinutes: 5,
      defaultGpsMode: "OPTIONAL",
      allowCrossPromptDuplicate: false,
      reviewCrossParticipantDuplicate: true,
      rulesDeclarationVersion: CLICKATON_TERMS_VERSION,
    },
    update: {
      uploadsEnabled: false,
      allowCrossPromptDuplicate: false,
      rulesDeclarationVersion: CLICKATON_TERMS_VERSION,
    },
  });

  const accreditationConfig = await prisma.clickatonEditionAccreditationConfig.upsert({
    where: { editionId: edition.id },
    create: {
      editionId: edition.id,
      accreditationEnabled: false,
      identityMode: "VISUAL",
      geofenceMode: "OFF",
      allowOfflineEvents: true,
      shortCodeEnabled: true,
    },
    update: {
      accreditationEnabled: false,
      geofenceMode: "OFF",
    },
  });

  const ACCREDITATION_CAPS = [
    "canViewEditionAccreditation",
    "canCheckInParticipants",
    "canVerifyParticipantIdentity",
    "canDeliverEditionKit",
    "canReverseAccreditation",
    "canGrantAccreditationException",
    "canManageAccreditationDevices",
  ] as const;

  const admissionConfig = await prisma.clickatonEditionAdmissionConfig.upsert({
    where: { editionId: edition.id },
    create: {
      editionId: edition.id,
      admissionEnabled: false,
      accreditationRequiredForAdmission: "NOT_REQUIRED",
      rulesVersion: "clickaton-admission-rules-draft-v1",
      engineVersion: "clickaton-admission-v1",
      requireDeclaration: true,
      allowAppealOnReject: false,
    },
    update: {
      admissionEnabled: false,
      accreditationRequiredForAdmission: "NOT_REQUIRED",
    },
  });

  const ADMISSION_CAPS = [
    "canViewTechnicalAdmission",
    "canReviewTechnicalAdmission",
    "canAdmitEntries",
    "canRejectEntries",
    "canExcludeEntries",
    "canCloseAdmissionBatch",
    "canReopenAdmissionBatch",
    "canResolveEntryIdentity",
  ] as const;

  let capabilityGrantsUpserted = 0;
  async function ensureCapability(userId: number, capability: string) {
    const existing = await prisma.clickatonEditionCapabilityGrant.findUnique({
      where: {
        editionId_userId_capability: {
          editionId: edition.id,
          userId,
          capability,
        },
      },
    });
    if (existing) return;
    await prisma.clickatonEditionCapabilityGrant.create({
      data: { editionId: edition.id, userId, capability },
    });
    capabilityGrantsUpserted += 1;
  }
  if (timelineActor) {
    await ensureCapability(timelineActor.id, CAPABILITY_MANAGE_TIMELINE);
    await ensureCapability(timelineActor.id, CAPABILITY_RELEASE_PROMPTS);
    for (const cap of ACCREDITATION_CAPS) {
      await ensureCapability(timelineActor.id, cap);
    }
    for (const cap of ADMISSION_CAPS) {
      await ensureCapability(timelineActor.id, cap);
    }
  }
  for (const email of [FINANCE_SEED_EMAILS.tammy, FINANCE_SEED_EMAILS.rodri]) {
    const u = await prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      select: { id: true },
    });
    if (u) {
      await ensureCapability(u.id, CAPABILITY_MANAGE_TIMELINE);
      await ensureCapability(u.id, CAPABILITY_RELEASE_PROMPTS);
      for (const cap of ACCREDITATION_CAPS) {
        await ensureCapability(u.id, cap);
      }
      for (const cap of ADMISSION_CAPS) {
        await ensureCapability(u.id, cap);
      }
    }
  }

  return {
    editionId: edition.id,
    slug: edition.slug,
    status: edition.status,
    registrationEnabled: edition.registrationEnabled,
    isPublished: edition.isPublished,
    startAt: startAt.toISOString(),
    pricePhaseCount,
    productId: product.id,
    productCode: product.code,
    variantCount,
    ticketTypeId: ticket.id,
    ticketCode: ticket.code,
    ticketItemId: null,
    phaseItemIds,
    phasesWithShirt,
    finance,
    timeline: {
      id: timeline.id,
      version: timeline.version,
      status: timeline.status,
      timezone: CLICKATON_ARGENTINA_2026.timezone,
      activated: false,
      placeholderPromptCount: PLACEHOLDER_PROMPTS,
      capabilityGrantsUpserted,
    },
    uploadConfig: {
      uploadsEnabled: uploadConfig.uploadsEnabled,
      captureClockToleranceMinutes: uploadConfig.captureClockToleranceMinutes,
      defaultGpsMode: uploadConfig.defaultGpsMode,
    },
    accreditationConfig: {
      accreditationEnabled: accreditationConfig.accreditationEnabled,
      identityMode: accreditationConfig.identityMode,
      geofenceMode: accreditationConfig.geofenceMode,
    },
    admissionConfig: {
      admissionEnabled: admissionConfig.admissionEnabled,
      accreditationRequiredForAdmission: admissionConfig.accreditationRequiredForAdmission,
      rulesVersion: admissionConfig.rulesVersion,
    },
    /** Etapa 14: scoring/jurado LIVE deshabilitado; vive en FotoRank sobre batch FROZEN. */
    juryScoring: {
      scoringEnabled: false,
      live: false,
      note: "Sin invitaciones reales ni scores en seed Clickat?n.",
    },
    rankingResults: {
      rankingEnabled: false,
      published: false,
      note: "Etapa 15: sin ganadores ni publicaci?n LIVE en seed.",
    },
  };
}

async function main() {
  if (process.env.CLICKATON_SEED_ARGENTINA_2026 !== "1") {
    console.error("Set CLICKATON_SEED_ARGENTINA_2026=1 to run.");
    process.exit(1);
  }
  const result = await seedArgentina2026Edition();
  const publishLanding = process.env.CLICKATON_SEED_PUBLISH_LANDING === "1";
  console.log(
    JSON.stringify(
      {
        ok: true,
        ...result,
        publishLanding,
        note: publishLanding
          ? "Landing publicada con registrationEnabled=false (kill switch cerrado)."
          : "Commercial edition upserted in safe DRAFT. Remera en Fase 1 via PricePhaseItem. No abrir inscripci?n.",
      },
      null,
      2,
    ),
  );
}

const isMain =
  process.argv[1] != null && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
