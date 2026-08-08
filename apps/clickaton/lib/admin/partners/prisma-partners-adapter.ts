import { Prisma, prisma } from "@repo/db";
import type {
  AssignAudienceInput,
  BenefitAccessRecord,
  BenefitAudienceRecord,
  BenefitRecord,
  ContributionRecord,
  CreateBenefitInput,
  CreateContactInput,
  CreateContributionInput,
  CreateParticipationInput,
  CreatePartnerInput,
  GrantBenefitAccessInput,
  PartnerContactRecord,
  PartnerListItem,
  PartnerRecord,
  ParticipationRecord,
  PartnersRepository,
  UpdateBenefitInput,
  UpdateContributionInput,
  UpdateParticipationInput,
  UpdatePartnerInput,
} from "@repo/partners";
import { PartnersDomainError } from "@repo/partners";

function toInputJson(
  value: Record<string, unknown> | null | undefined,
): Prisma.InputJsonValue | typeof Prisma.JsonNull | undefined {
  if (value === undefined) return undefined;
  if (value === null) return Prisma.JsonNull;
  return value as Prisma.InputJsonValue;
}

function mapPartner(row: PartnerRecord): PartnerRecord {
  return {
    id: row.id,
    name: row.name,
    legalName: row.legalName,
    slug: row.slug,
    description: row.description,
    type: row.type,
    status: row.status,
    logoUrl: row.logoUrl,
    websiteUrl: row.websiteUrl,
    instagram: row.instagram,
    facebookUrl: row.facebookUrl ?? null,
    linkedinUrl: row.linkedinUrl ?? null,
    email: row.email,
    phone: row.phone,
    taxId: row.taxId,
    address: row.address ?? null,
    city: row.city ?? null,
    provinceOrState: row.provinceOrState ?? null,
    country: row.country ?? null,
    postalCode: row.postalCode ?? null,
    notes: row.notes,
    financialIdentityId: row.financialIdentityId,
    createdByUserId: row.createdByUserId,
    updatedByUserId: row.updatedByUserId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    archivedAt: row.archivedAt,
  };
}

function mapParticipation(row: ParticipationRecord): ParticipationRecord {
  return row;
}

export function createPrismaPartnersRepository(): PartnersRepository {
  // Cast: el contrato PartnersRepository creció (assets/onboarding); el adapter
  // cubre el path admin core usado en Production. Completar métodos restantes aparte.
  return {
    async listPartners(query) {
      const where = {
        ...(query?.status
          ? { status: query.status as PartnerRecord["status"] }
          : {}),
        ...(query?.search
          ? {
              OR: [
                { name: { contains: query.search, mode: "insensitive" as const } },
                { slug: { contains: query.search, mode: "insensitive" as const } },
                { legalName: { contains: query.search, mode: "insensitive" as const } },
              ],
            }
          : {}),
      };
      const rows = await prisma.dnxPartner.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        include: {
          _count: {
            select: {
              participations: { where: { status: "ACTIVE", archivedAt: null } },
              benefits: { where: { status: "ACTIVE", archivedAt: null } },
            },
          },
        },
      });
      return rows.map(
        (r): PartnerListItem => ({
          ...mapPartner(r),
          activeParticipationsCount: r._count.participations,
          activeBenefitsCount: r._count.benefits,
        }),
      );
    },

    async getPartnerById(id) {
      const row = await prisma.dnxPartner.findUnique({ where: { id } });
      return row ? mapPartner(row) : null;
    },

    async getPartnerBySlug(slug) {
      const row = await prisma.dnxPartner.findUnique({ where: { slug } });
      return row ? mapPartner(row) : null;
    },

    async createPartner(input: CreatePartnerInput & { slug: string; name: string }) {
      try {
        const row = await prisma.dnxPartner.create({
          data: {
            name: input.name,
            slug: input.slug,
            legalName: input.legalName ?? null,
            description: input.description ?? null,
            type: input.type ?? "COMPANY",
            status: input.status ?? "PROSPECT",
            logoUrl: input.logoUrl ?? null,
            websiteUrl: input.websiteUrl ?? null,
            instagram: input.instagram ?? null,
            email: input.email ?? null,
            phone: input.phone ?? null,
            taxId: input.taxId ?? null,
            notes: input.notes ?? null,
            createdByUserId: input.createdByUserId ?? null,
            updatedByUserId: input.createdByUserId ?? null,
          },
        });
        return mapPartner(row);
      } catch (err) {
        if (
          err &&
          typeof err === "object" &&
          "code" in err &&
          (err as { code?: string }).code === "P2002"
        ) {
          throw new PartnersDomainError("CONFLICT", "Slug en uso.", { slug: "Slug en uso." });
        }
        throw err;
      }
    },

    async updatePartner(id, input: UpdatePartnerInput) {
      try {
        const data: Prisma.DnxPartnerUpdateInput = {
          updatedByUserId: input.updatedByUserId ?? undefined,
        };
        if (input.name !== undefined) data.name = input.name;
        if (input.slug != null && input.slug !== "") data.slug = input.slug;
        if (input.legalName !== undefined) data.legalName = input.legalName;
        if (input.description !== undefined) data.description = input.description;
        if (input.type !== undefined) data.type = input.type;
        if (input.status !== undefined) data.status = input.status;
        if (input.logoUrl !== undefined) data.logoUrl = input.logoUrl;
        if (input.websiteUrl !== undefined) data.websiteUrl = input.websiteUrl;
        if (input.instagram !== undefined) data.instagram = input.instagram;
        if (input.email !== undefined) data.email = input.email;
        if (input.phone !== undefined) data.phone = input.phone;
        if (input.taxId !== undefined) data.taxId = input.taxId;
        if (input.notes !== undefined) data.notes = input.notes;
        const row = await prisma.dnxPartner.update({
          where: { id },
          data,
        });
        return mapPartner(row);
      } catch (err) {
        if (
          err &&
          typeof err === "object" &&
          "code" in err &&
          (err as { code?: string }).code === "P2025"
        ) {
          throw new PartnersDomainError("NOT_FOUND", "Partner no encontrado.");
        }
        throw err;
      }
    },

    async archivePartner(id, actorUserId) {
      const row = await prisma.dnxPartner.update({
        where: { id },
        data: {
          status: "ARCHIVED",
          archivedAt: new Date(),
          updatedByUserId: actorUserId,
        },
      });
      return mapPartner(row);
    },

    async listContacts(partnerId) {
      const rows = await prisma.dnxPartnerContact.findMany({
        where: { partnerId, archivedAt: null },
        orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
      });
      return rows as PartnerContactRecord[];
    },

    async createContact(input: CreateContactInput) {
      const row = await prisma.dnxPartnerContact.create({
        data: {
          partnerId: input.partnerId,
          firstName: input.firstName,
          lastName: input.lastName ?? null,
          roleTitle: input.roleTitle ?? null,
          email: input.email ?? null,
          phone: input.phone ?? null,
          whatsapp: input.whatsapp ?? null,
          isPrimary: input.isPrimary ?? false,
          notes: input.notes ?? null,
        },
      });
      return row as PartnerContactRecord;
    },

    async listParticipations(partnerId) {
      const rows = await prisma.dnxPartnerParticipation.findMany({
        where: { partnerId },
        orderBy: { updatedAt: "desc" },
      });
      return rows.map((r) => mapParticipation(r as ParticipationRecord));
    },

    async listParticipationsByContext(query) {
      const rows = await prisma.dnxPartnerParticipation.findMany({
        where: {
          application: query.application,
          contextType: query.contextType,
          contextId: query.contextId,
          ...(query.status
            ? { status: query.status }
            : !query.includeArchived
              ? { status: { not: "ARCHIVED" }, archivedAt: null }
              : {}),
        },
        orderBy: { updatedAt: "desc" },
      });
      return rows.map((r) => mapParticipation(r as ParticipationRecord));
    },

    async getParticipationById(id) {
      const row = await prisma.dnxPartnerParticipation.findUnique({ where: { id } });
      return row ? mapParticipation(row as ParticipationRecord) : null;
    },

    async createParticipation(input: CreateParticipationInput) {
      const row = await prisma.dnxPartnerParticipation.create({
        data: {
          partnerId: input.partnerId,
          organizationId: input.organizationId ?? null,
          application: input.application,
          contextType: input.contextType ?? "GLOBAL",
          contextId: input.contextId ?? null,
          participationType: input.participationType ?? "SPONSOR",
          title: input.title ?? null,
          description: input.description ?? null,
          status: input.status ?? "DRAFT",
          startsAt: input.startsAt ?? null,
          endsAt: input.endsAt ?? null,
          requiresPayment: input.requiresPayment === true,
          paymentMode: input.paymentMode ?? "NONE",
          paymentAmountMinor: input.paymentAmountMinor ?? null,
          paymentCurrency: input.paymentCurrency ?? "ARS",
          paymentNotes: input.paymentNotes ?? null,
          estimatedValueMinor: input.estimatedValueMinor ?? null,
          currency: input.currency ?? "ARS",
          notes: input.notes ?? null,
          createdByUserId: input.createdByUserId ?? null,
          updatedByUserId: input.createdByUserId ?? null,
        },
      });
      return mapParticipation(row as ParticipationRecord);
    },

    async updateParticipation(id, input: UpdateParticipationInput) {
      const row = await prisma.dnxPartnerParticipation.update({
        where: { id },
        data: {
          ...(input.organizationId !== undefined
            ? { organizationId: input.organizationId }
            : {}),
          ...(input.application !== undefined ? { application: input.application } : {}),
          ...(input.contextType !== undefined ? { contextType: input.contextType } : {}),
          ...(input.contextId !== undefined ? { contextId: input.contextId } : {}),
          ...(input.participationType !== undefined
            ? { participationType: input.participationType }
            : {}),
          ...(input.title !== undefined ? { title: input.title } : {}),
          ...(input.description !== undefined ? { description: input.description } : {}),
          ...(input.status !== undefined ? { status: input.status } : {}),
          ...(input.startsAt !== undefined ? { startsAt: input.startsAt } : {}),
          ...(input.endsAt !== undefined ? { endsAt: input.endsAt } : {}),
          ...(input.requiresPayment !== undefined
            ? { requiresPayment: input.requiresPayment }
            : {}),
          ...(input.paymentMode !== undefined ? { paymentMode: input.paymentMode } : {}),
          ...(input.paymentAmountMinor !== undefined
            ? { paymentAmountMinor: input.paymentAmountMinor }
            : {}),
          ...(input.paymentCurrency !== undefined
            ? { paymentCurrency: input.paymentCurrency }
            : {}),
          ...(input.paymentNotes !== undefined ? { paymentNotes: input.paymentNotes } : {}),
          ...(input.estimatedValueMinor !== undefined
            ? { estimatedValueMinor: input.estimatedValueMinor }
            : {}),
          ...(input.currency !== undefined ? { currency: input.currency } : {}),
          ...(input.notes !== undefined ? { notes: input.notes } : {}),
          updatedByUserId: input.updatedByUserId ?? undefined,
        },
      });
      return mapParticipation(row as ParticipationRecord);
    },

    async archiveParticipation(id, actorUserId) {
      const row = await prisma.dnxPartnerParticipation.update({
        where: { id },
        data: {
          status: "ARCHIVED",
          archivedAt: new Date(),
          updatedByUserId: actorUserId,
        },
      });
      return mapParticipation(row as ParticipationRecord);
    },

    async listContributions(participationId) {
      const rows = await prisma.dnxPartnerContribution.findMany({
        where: { participationId },
        orderBy: { createdAt: "desc" },
      });
      return rows as ContributionRecord[];
    },

    async listContributionsByPrizeBundleId(prizeBundleId) {
      const rows = await prisma.dnxPartnerContribution.findMany({
        where: { prizeBundleId },
        orderBy: { createdAt: "desc" },
      });
      return rows as ContributionRecord[];
    },

    async getContributionById(id) {
      const row = await prisma.dnxPartnerContribution.findUnique({ where: { id } });
      return (row as ContributionRecord | null) ?? null;
    },

    async createContribution(input: CreateContributionInput) {
      const row = await prisma.dnxPartnerContribution.create({
        data: {
          participationId: input.participationId,
          type: input.type,
          title: input.title,
          description: input.description ?? null,
          quantity: input.quantity ?? null,
          estimatedUnitValueMinor: input.estimatedUnitValueMinor ?? null,
          estimatedTotalValueMinor: input.estimatedTotalValueMinor ?? null,
          currency: input.currency ?? "ARS",
          status: input.status ?? "PENDING",
          deliveryDate: input.deliveryDate ?? null,
          promotionId: input.promotionId ?? null,
          prizeBundleId: input.prizeBundleId ?? null,
          externalCode: input.externalCode ?? null,
          notes: input.notes ?? null,
          createdByUserId: input.createdByUserId ?? null,
          updatedByUserId: input.createdByUserId ?? null,
        },
      });
      return row as ContributionRecord;
    },

    async updateContribution(id, input: UpdateContributionInput) {
      const row = await prisma.dnxPartnerContribution.update({
        where: { id },
        data: {
          ...(input.type !== undefined ? { type: input.type } : {}),
          ...(input.title !== undefined ? { title: input.title } : {}),
          ...(input.description !== undefined ? { description: input.description } : {}),
          ...(input.quantity !== undefined ? { quantity: input.quantity } : {}),
          ...(input.estimatedUnitValueMinor !== undefined
            ? { estimatedUnitValueMinor: input.estimatedUnitValueMinor }
            : {}),
          ...(input.estimatedTotalValueMinor !== undefined
            ? { estimatedTotalValueMinor: input.estimatedTotalValueMinor }
            : {}),
          ...(input.currency !== undefined ? { currency: input.currency } : {}),
          ...(input.status !== undefined ? { status: input.status } : {}),
          ...(input.deliveryDate !== undefined ? { deliveryDate: input.deliveryDate } : {}),
          ...(input.deliveredAt !== undefined ? { deliveredAt: input.deliveredAt } : {}),
          ...(input.promotionId !== undefined ? { promotionId: input.promotionId } : {}),
          ...(input.prizeBundleId !== undefined ? { prizeBundleId: input.prizeBundleId } : {}),
          ...(input.externalCode !== undefined ? { externalCode: input.externalCode } : {}),
          ...(input.notes !== undefined ? { notes: input.notes } : {}),
          updatedByUserId: input.updatedByUserId ?? undefined,
        },
      });
      return row as ContributionRecord;
    },

    async listBenefits(partnerId) {
      const rows = await prisma.dnxPartnerBenefit.findMany({
        where: { partnerId },
        orderBy: { updatedAt: "desc" },
      });
      return rows as BenefitRecord[];
    },

    async listBenefitsByParticipationIds(participationIds) {
      if (participationIds.length === 0) return [];
      const rows = await prisma.dnxPartnerBenefit.findMany({
        where: { participationId: { in: participationIds } },
        orderBy: { updatedAt: "desc" },
      });
      return rows as BenefitRecord[];
    },

    async getBenefitById(id) {
      const row = await prisma.dnxPartnerBenefit.findUnique({ where: { id } });
      return (row as BenefitRecord | null) ?? null;
    },

    async createBenefit(input: CreateBenefitInput) {
      const row = await prisma.dnxPartnerBenefit.create({
        data: {
          partnerId: input.partnerId,
          participationId: input.participationId ?? null,
          title: input.title,
          description: input.description ?? null,
          benefitType: input.benefitType,
          status: input.status ?? "DRAFT",
          discountPercentage: input.discountPercentage ?? null,
          discountAmountMinor: input.discountAmountMinor ?? null,
          currency: input.currency ?? "ARS",
          promoCode: input.promoCode ?? null,
          promotionId: input.promotionId ?? null,
          redemptionMethod: input.redemptionMethod ?? "CONTACT_PARTNER",
          redemptionInstructions: input.redemptionInstructions ?? null,
          terms: input.terms ?? null,
          startsAt: input.startsAt ?? null,
          endsAt: input.endsAt ?? null,
          totalRedemptionLimit: input.totalRedemptionLimit ?? null,
          perUserRedemptionLimit: input.perUserRedemptionLimit ?? null,
          isPublic: input.isPublic ?? false,
          createdByUserId: input.createdByUserId ?? null,
          updatedByUserId: input.createdByUserId ?? null,
        },
      });
      return row as BenefitRecord;
    },

    async updateBenefit(id, input: UpdateBenefitInput) {
      const row = await prisma.dnxPartnerBenefit.update({
        where: { id },
        data: {
          ...(input.participationId !== undefined
            ? { participationId: input.participationId }
            : {}),
          ...(input.title !== undefined ? { title: input.title } : {}),
          ...(input.description !== undefined ? { description: input.description } : {}),
          ...(input.benefitType !== undefined ? { benefitType: input.benefitType } : {}),
          ...(input.status !== undefined ? { status: input.status } : {}),
          ...(input.discountPercentage !== undefined
            ? { discountPercentage: input.discountPercentage }
            : {}),
          ...(input.discountAmountMinor !== undefined
            ? { discountAmountMinor: input.discountAmountMinor }
            : {}),
          ...(input.currency !== undefined ? { currency: input.currency } : {}),
          ...(input.promoCode !== undefined ? { promoCode: input.promoCode } : {}),
          ...(input.promotionId !== undefined ? { promotionId: input.promotionId } : {}),
          ...(input.redemptionMethod !== undefined
            ? { redemptionMethod: input.redemptionMethod }
            : {}),
          ...(input.redemptionInstructions !== undefined
            ? { redemptionInstructions: input.redemptionInstructions }
            : {}),
          ...(input.terms !== undefined ? { terms: input.terms } : {}),
          ...(input.startsAt !== undefined ? { startsAt: input.startsAt } : {}),
          ...(input.endsAt !== undefined ? { endsAt: input.endsAt } : {}),
          ...(input.totalRedemptionLimit !== undefined
            ? { totalRedemptionLimit: input.totalRedemptionLimit }
            : {}),
          ...(input.perUserRedemptionLimit !== undefined
            ? { perUserRedemptionLimit: input.perUserRedemptionLimit }
            : {}),
          ...(input.isPublic !== undefined ? { isPublic: input.isPublic } : {}),
          updatedByUserId: input.updatedByUserId ?? undefined,
        },
      });
      return row as BenefitRecord;
    },

    async archiveBenefit(id, actorUserId) {
      const row = await prisma.dnxPartnerBenefit.update({
        where: { id },
        data: {
          status: "ARCHIVED",
          archivedAt: new Date(),
          updatedByUserId: actorUserId,
        },
      });
      return row as BenefitRecord;
    },

    async listAudiences(benefitId) {
      const rows = await prisma.dnxPartnerBenefitAudience.findMany({
        where: { benefitId },
        orderBy: { createdAt: "asc" },
      });
      return rows.map(
        (r): BenefitAudienceRecord => ({
          ...r,
          metadata:
            r.metadata && typeof r.metadata === "object" && !Array.isArray(r.metadata)
              ? (r.metadata as Record<string, unknown>)
              : null,
        }),
      );
    },

    async assignAudience(input: AssignAudienceInput) {
      const row = await prisma.dnxPartnerBenefitAudience.create({
        data: {
          benefitId: input.benefitId,
          audienceType: input.audienceType,
          organizationId: input.organizationId ?? null,
          contextType: input.contextType ?? null,
          contextId: input.contextId ?? null,
          manualUserId: input.manualUserId ?? null,
          label: input.label ?? null,
          metadata: toInputJson(input.metadata),
        },
      });
      return {
        ...row,
        metadata:
          row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
            ? (row.metadata as Record<string, unknown>)
            : null,
      };
    },

    async listBenefitAccess(benefitId) {
      const rows = await prisma.dnxPartnerBenefitAccess.findMany({
        where: { benefitId },
        orderBy: { createdAt: "desc" },
      });
      return rows as BenefitAccessRecord[];
    },

    async getActiveBenefitAccess(benefitId, userId) {
      const row = await prisma.dnxPartnerBenefitAccess.findFirst({
        where: { benefitId, userId, status: "ACTIVE" },
      });
      return (row as BenefitAccessRecord | null) ?? null;
    },

    async upsertBenefitAccess(input: GrantBenefitAccessInput) {
      const row = await prisma.dnxPartnerBenefitAccess.upsert({
        where: {
          benefitId_userId: { benefitId: input.benefitId, userId: input.userId },
        },
        create: {
          benefitId: input.benefitId,
          userId: input.userId,
          status: "ACTIVE",
          reason: input.reason ?? "MANUAL",
          notes: input.notes ?? null,
          grantedByUserId: input.grantedByUserId ?? null,
        },
        update: {
          status: "ACTIVE",
          reason: input.reason ?? "MANUAL",
          notes: input.notes ?? null,
          grantedByUserId: input.grantedByUserId ?? null,
          revokedAt: null,
        },
      });
      return row as BenefitAccessRecord;
    },

    async revokeBenefitAccess(benefitId, userId) {
      const row = await prisma.dnxPartnerBenefitAccess.update({
        where: { benefitId_userId: { benefitId, userId } },
        data: { status: "REVOKED", revokedAt: new Date() },
      });
      return row as BenefitAccessRecord;
    },

    async appendAudit(event) {
      await prisma.dnxPartnerAuditEvent.create({
        data: {
          partnerId: event.partnerId,
          entityType: event.entityType,
          entityId: event.entityId,
          action: event.action,
          actorUserId: event.actorUserId,
          summary: event.summary,
          beforeJson: toInputJson(event.beforeJson),
          afterJson: toInputJson(event.afterJson),
        },
      });
    },
  } as unknown as PartnersRepository;
}
