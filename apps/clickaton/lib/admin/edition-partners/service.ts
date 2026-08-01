import { prisma } from "@repo/db";
import {
  CLICKATON_AUDIENCE_OPTIONS,
  PartnersDomainError,
  resolveClickatonParticipationType,
  type CreateBenefitInput,
  type CreateContributionInput,
  type CreateParticipationInput,
  type PartnerActor,
  type ParticipationRecord,
} from "@repo/partners";
import { getClickatonPartnersService } from "@/lib/admin/partners/runtime";

export type EditionSponsorsSummary = {
  partnersCount: number;
  activeParticipations: number;
  pendingContributions: number;
  deliveredContributions: number;
  prizeLinkedContributions: number;
  activeBenefits: number;
  withPayment: number;
  withoutPayment: number;
};

export type EditionParticipationRow = {
  participation: ParticipationRecord;
  partnerName: string;
  partnerSlug: string;
  partnerLogoUrl: string | null;
  contributionsCount: number;
  benefitsCount: number;
};

function assertEditionParticipation(p: ParticipationRecord, editionId: string) {
  if (p.application !== "CLICKATON") {
    throw new PartnersDomainError("VALIDATION", "La participación no pertenece a Clickatón.");
  }
  if (p.contextType !== "EDITION" && p.contextType !== "CATEGORY" && p.contextType !== "VENUE") {
    throw new PartnersDomainError("VALIDATION", "Contexto inválido para edición Clickatón.");
  }
  if (p.contextType === "EDITION" && p.contextId !== editionId) {
    throw new PartnersDomainError("VALIDATION", "La participación no pertenece a esta edición.");
  }
}

export async function ensureEditionExists(editionId: string) {
  const edition = await prisma.clickatonEdition.findUnique({
    where: { id: editionId },
    select: { id: true, name: true, slug: true },
  });
  if (!edition) {
    throw new PartnersDomainError("NOT_FOUND", "Edición no encontrada.");
  }
  return edition;
}

export async function listEditionPartners(
  actor: PartnerActor,
  editionId: string,
): Promise<EditionParticipationRow[]> {
  await ensureEditionExists(editionId);
  const svc = getClickatonPartnersService();
  const participations = await svc.listParticipationsByContext(actor, {
    application: "CLICKATON",
    contextType: "EDITION",
    contextId: editionId,
    includeArchived: false,
  });

  const rows: EditionParticipationRow[] = [];
  for (const participation of participations) {
    const [partner, contributions, benefits] = await Promise.all([
      svc.getPartner(actor, participation.partnerId),
      svc.listContributions(actor, participation.id),
      svc.listBenefits(actor, participation.partnerId),
    ]);
    const benefitsForParticipation = benefits.filter(
      (b) => b.participationId === participation.id || b.participationId == null,
    );
    rows.push({
      participation,
      partnerName: partner.name,
      partnerSlug: partner.slug,
      partnerLogoUrl: partner.logoUrl,
      contributionsCount: contributions.length,
      benefitsCount: benefitsForParticipation.filter((b) => b.participationId === participation.id)
        .length,
    });
  }
  return rows;
}

export async function getEditionSponsorsSummary(
  actor: PartnerActor,
  editionId: string,
): Promise<EditionSponsorsSummary> {
  const rows = await listEditionPartners(actor, editionId);
  const svc = getClickatonPartnersService();
  const partnerIds = new Set(rows.map((r) => r.participation.partnerId));
  let pendingContributions = 0;
  let deliveredContributions = 0;
  let prizeLinkedContributions = 0;
  let activeBenefits = 0;

  for (const row of rows) {
    const contributions = await svc.listContributions(actor, row.participation.id);
    for (const c of contributions) {
      if (c.status === "PENDING" || c.status === "CONFIRMED") pendingContributions += 1;
      if (c.status === "DELIVERED" || c.status === "PARTIALLY_DELIVERED") {
        deliveredContributions += 1;
      }
      if (c.prizeBundleId) prizeLinkedContributions += 1;
    }
    const benefits = await svc.listBenefits(actor, row.participation.partnerId);
    activeBenefits += benefits.filter(
      (b) => b.participationId === row.participation.id && b.status === "ACTIVE",
    ).length;
  }

  return {
    partnersCount: partnerIds.size,
    activeParticipations: rows.filter((r) =>
      ["CONFIRMED", "ACTIVE"].includes(r.participation.status),
    ).length,
    pendingContributions,
    deliveredContributions,
    prizeLinkedContributions,
    activeBenefits,
    withPayment: rows.filter((r) => r.participation.requiresPayment).length,
    withoutPayment: rows.filter((r) => !r.participation.requiresPayment).length,
  };
}

export async function createEditionPartnerParticipation(
  actor: PartnerActor,
  editionId: string,
  input: {
    partnerId: string;
    role: string;
    title?: string | null;
    description?: string | null;
    status?: CreateParticipationInput["status"];
    startsAt?: Date | null;
    endsAt?: Date | null;
    requiresPayment?: boolean;
    paymentMode?: CreateParticipationInput["paymentMode"];
    paymentAmountMinor?: number | null;
    paymentCurrency?: string | null;
    paymentNotes?: string | null;
    estimatedValueMinor?: number | null;
    currency?: string | null;
    notes?: string | null;
    allowDuplicateActive?: boolean;
    categoryId?: string | null;
    venueId?: string | null;
  },
) {
  await ensureEditionExists(editionId);
  const partner = await getClickatonPartnersService().getPartner(actor, input.partnerId);
  void partner;

  const resolved = resolveClickatonParticipationType(input.role);

  // Contexto canónico de edición: siempre EDITION + editionId.
  // Sponsor de categoría/sede se expresa en título + notes (sin perder el vínculo a la edición).
  const roleNotes: string[] = [];
  if (input.categoryId?.trim()) roleNotes.push(`categoryId=${input.categoryId.trim()}`);
  if (input.venueId?.trim()) {
    const venue = await prisma.clickatonVenue.findFirst({
      where: { id: input.venueId.trim(), editionId },
      select: { id: true },
    });
    if (!venue) {
      throw new PartnersDomainError("VALIDATION", "La sede no pertenece a esta edición.", {
        venueId: "Sede inválida.",
      });
    }
    roleNotes.push(`venueId=${venue.id}`);
  }
  const notesParts = [input.notes?.trim(), roleNotes.length ? roleNotes.join(" ") : null].filter(
    Boolean,
  );

  const svc = getClickatonPartnersService();
  return svc.createParticipation(actor, {
    partnerId: input.partnerId,
    application: "CLICKATON",
    organizationId: null,
    contextType: "EDITION",
    contextId: editionId,
    participationType: resolved.participationType,
    title:
      input.title?.trim() ||
      resolved.titleHint ||
      (input.role === "SPONSOR_CATEGORY"
        ? "Sponsor de categoría"
        : input.role === "SPONSOR_VENUE"
          ? "Sponsor de sede"
          : null),
    description: input.description ?? null,
    status: input.status ?? "DRAFT",
    startsAt: input.startsAt ?? null,
    endsAt: input.endsAt ?? null,
    requiresPayment: input.requiresPayment,
    paymentMode: input.paymentMode,
    paymentAmountMinor: input.paymentAmountMinor,
    paymentCurrency: input.paymentCurrency,
    paymentNotes: input.paymentNotes,
    estimatedValueMinor: input.estimatedValueMinor,
    currency: input.currency,
    notes: notesParts.length ? notesParts.join("\n") : null,
    allowDuplicateActive: input.allowDuplicateActive,
  });
}

export async function updateEditionPartnerParticipation(
  actor: PartnerActor,
  editionId: string,
  participationId: string,
  input: Parameters<ReturnType<typeof getClickatonPartnersService>["updateParticipation"]>[2],
) {
  const svc = getClickatonPartnersService();
  const listed = await svc.listParticipationsByContext(actor, {
    application: "CLICKATON",
    contextType: "EDITION",
    contextId: editionId,
    includeArchived: true,
  });
  const fromList = listed.find((p) => p.id === participationId);
  const row =
    fromList ??
    ((await prisma.dnxPartnerParticipation.findUnique({
      where: { id: participationId },
    })) as ParticipationRecord | null);
  if (!row) {
    throw new PartnersDomainError("NOT_FOUND", "Participación no encontrada.");
  }
  assertEditionParticipation(row, editionId);
  return svc.updateParticipation(actor, participationId, input);
}

export async function archiveEditionPartnerParticipation(
  actor: PartnerActor,
  editionId: string,
  participationId: string,
) {
  const svc = getClickatonPartnersService();
  const participation = await prisma.dnxPartnerParticipation.findUnique({
    where: { id: participationId },
  });
  if (!participation) {
    throw new PartnersDomainError("NOT_FOUND", "Participación no encontrada.");
  }
  assertEditionParticipation(participation as ParticipationRecord, editionId);
  return svc.archiveParticipation(actor, participationId);
}

export async function createEditionPartnerContribution(
  actor: PartnerActor,
  editionId: string,
  input: CreateContributionInput,
) {
  const svc = getClickatonPartnersService();
  const participation = await prisma.dnxPartnerParticipation.findUnique({
    where: { id: input.participationId },
  });
  if (!participation) {
    throw new PartnersDomainError("NOT_FOUND", "Participación no encontrada.");
  }
  assertEditionParticipation(participation as ParticipationRecord, editionId);
  if (input.prizeBundleId) {
    await assertPrizeBelongsToEdition(input.prizeBundleId, editionId);
  }
  return svc.createContribution(actor, input);
}

export async function linkContributionToPrize(
  actor: PartnerActor,
  editionId: string,
  contributionId: string,
  prizeBundleId: string,
) {
  await assertPrizeBelongsToEdition(prizeBundleId, editionId);
  const svc = getClickatonPartnersService();
  const contribution = await prisma.dnxPartnerContribution.findUnique({
    where: { id: contributionId },
    include: { participation: true },
  });
  if (!contribution) {
    throw new PartnersDomainError("NOT_FOUND", "Aporte no encontrado.");
  }
  assertEditionParticipation(contribution.participation as ParticipationRecord, editionId);
  return svc.linkContributionToPrize(actor, contributionId, prizeBundleId);
}

async function assertPrizeBelongsToEdition(prizeBundleId: string, editionId: string) {
  const bundle = await prisma.clickatonPrizeBundle.findUnique({
    where: { id: prizeBundleId },
    select: { id: true, editionId: true, name: true },
  });
  if (!bundle) {
    throw new PartnersDomainError("NOT_FOUND", "Premio Clickatón no encontrado.", {
      prizeBundleId: "No existe.",
    });
  }
  if (bundle.editionId !== editionId) {
    throw new PartnersDomainError(
      "VALIDATION",
      "El premio pertenece a otra edición.",
      { prizeBundleId: "Edición incorrecta." },
    );
  }
  return bundle;
}

export async function listEditionPrizeBundles(editionId: string) {
  return prisma.clickatonPrizeBundle.findMany({
    where: { editionId },
    orderBy: { slot: "asc" },
    select: {
      id: true,
      slot: true,
      name: true,
      sponsor: true,
      status: true,
      referentialValueMinor: true,
    },
  });
}

export async function createEditionPartnerBenefit(
  actor: PartnerActor,
  editionId: string,
  input: CreateBenefitInput & {
    audienceKey?: string;
    categoryId?: string | null;
    manualUserId?: number | null;
  },
) {
  await ensureEditionExists(editionId);
  const svc = getClickatonPartnersService();
  if (input.participationId) {
    const participation = await prisma.dnxPartnerParticipation.findUnique({
      where: { id: input.participationId },
    });
    if (!participation) {
      throw new PartnersDomainError("NOT_FOUND", "Participación no encontrada.");
    }
    assertEditionParticipation(participation as ParticipationRecord, editionId);
    if (participation.partnerId !== input.partnerId) {
      throw new PartnersDomainError(
        "VALIDATION",
        "El beneficio debe pertenecer al mismo partner que la participación.",
      );
    }
  }

  const benefit = await svc.createBenefit(actor, {
    ...input,
    status: input.status ?? "DRAFT",
    isPublic: false,
  });

  const audienceKey = input.audienceKey ?? "EDITION_PARTICIPANTS";
  const opt = CLICKATON_AUDIENCE_OPTIONS.find((o) => o.value === audienceKey);
  const audienceType = opt?.audienceType ?? "EDITION_PARTICIPANTS";
  const groupKey = opt && "groupKey" in opt ? opt.groupKey : undefined;

  await svc.assignAudience(actor, {
    benefitId: benefit.id,
    audienceType,
    contextType: "EDITION",
    contextId: editionId,
    organizationId: null,
    manualUserId: input.manualUserId ?? null,
    label: groupKey ?? opt?.label ?? audienceKey,
    metadata: {
      clickatonAudienceKey: audienceKey,
      ...(input.categoryId ? { categoryId: input.categoryId } : {}),
      eligibilityNote:
        "Evaluación diferida — ver docs/partners/PARTNERS_STAGE_02_IMPLEMENTATION_01_RESULT.md",
    },
  });

  return benefit;
}

export async function activateEditionBenefit(
  actor: PartnerActor,
  editionId: string,
  benefitId: string,
) {
  await assertBenefitInEditionScope(actor, editionId, benefitId);
  return getClickatonPartnersService().activateBenefit(actor, benefitId);
}

export async function pauseEditionBenefit(
  actor: PartnerActor,
  editionId: string,
  benefitId: string,
) {
  await assertBenefitInEditionScope(actor, editionId, benefitId);
  return getClickatonPartnersService().pauseBenefit(actor, benefitId);
}

export async function archiveEditionBenefit(
  actor: PartnerActor,
  editionId: string,
  benefitId: string,
) {
  await assertBenefitInEditionScope(actor, editionId, benefitId);
  return getClickatonPartnersService().archiveBenefit(actor, benefitId);
}

export async function grantEditionBenefitManually(
  actor: PartnerActor,
  editionId: string,
  benefitId: string,
  userId: number,
  notes?: string | null,
) {
  await assertBenefitInEditionScope(actor, editionId, benefitId);
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });
  if (!user) {
    throw new PartnersDomainError("VALIDATION", "Usuario DNX inexistente.", {
      userId: "No existe ese userId.",
    });
  }
  return getClickatonPartnersService().grantBenefitAccess(actor, {
    benefitId,
    userId,
    reason: "MANUAL",
    notes: notes ?? null,
  });
}

export async function revokeEditionBenefitGrant(
  actor: PartnerActor,
  editionId: string,
  benefitId: string,
  userId: number,
) {
  await assertBenefitInEditionScope(actor, editionId, benefitId);
  return getClickatonPartnersService().revokeBenefitAccess(actor, benefitId, userId);
}

async function assertBenefitInEditionScope(
  _actor: PartnerActor,
  editionId: string,
  benefitId: string,
) {
  const row = await prisma.dnxPartnerBenefit.findUnique({
    where: { id: benefitId },
    include: { participation: true, audiences: true },
  });
  if (!row) throw new PartnersDomainError("NOT_FOUND", "Beneficio no encontrado.");

  const tiedToEditionParticipation =
    row.participation &&
    row.participation.application === "CLICKATON" &&
    ((row.participation.contextType === "EDITION" &&
      row.participation.contextId === editionId) ||
      row.participation.contextType === "CATEGORY" ||
      row.participation.contextType === "VENUE");

  const audienceEdition = row.audiences.some(
    (a) => a.contextType === "EDITION" && a.contextId === editionId,
  );

  if (!tiedToEditionParticipation && !audienceEdition) {
    throw new PartnersDomainError(
      "VALIDATION",
      "El beneficio no está vinculado a esta edición.",
    );
  }
  return row;
}
