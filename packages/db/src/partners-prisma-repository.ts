/**
 * Prisma PartnersRepository canónico (Clickatón + FotoRank).
 */
import { Prisma, prisma } from "./client";
import type {
  AssignAudienceInput,
  CreateBrandAssetInput,
  CreateParticipationAssetInput,
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
  ListParticipationAssetsQuery,
  OnboardingInvitationRecord,
  ParticipationAssetRecord,
  PartnerBrandAssetRecord,
  PartnerContactRecord,
  PartnerListItem,
  PartnerOnboardingDraft,
  PartnerOnboardingSubmission,
  PartnerRecord,
  ParticipationRecord,
  PartnersRepository,
  UpdateBenefitInput,
  UpdateBrandAssetInput,
  UpdateContributionInput,
  UpdateParticipationAssetInput,
  UpdateParticipationInput,
  UpdatePartnerInput,
  ClickEventRecord,
} from "@repo/partners";
import { PartnersDomainError } from "@repo/partners";

function toInputJson(
  value: Record<string, unknown> | null | undefined,
): Prisma.InputJsonValue | typeof Prisma.JsonNull | undefined {
  if (value === undefined) return undefined;
  if (value === null) return Prisma.JsonNull;
  return value as Prisma.InputJsonValue;
}


function fromJson(value: Prisma.JsonValue | null): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function mapBrandAsset(row: { metadata: Prisma.JsonValue | null } & Omit<PartnerBrandAssetRecord, "metadata">): PartnerBrandAssetRecord {
  return { ...row, metadata: fromJson(row.metadata) };
}

function mapParticipationAsset(row: { metadata: Prisma.JsonValue | null } & Omit<ParticipationAssetRecord, "metadata">): ParticipationAssetRecord {
  return { ...row, metadata: fromJson(row.metadata) };
}

function mapClickEvent(row: {
  metadata: Prisma.JsonValue | null;
} & Omit<ClickEventRecord, "metadata" | "contextType"> & {
  contextType: ClickEventRecord["contextType"] | string;
}): ClickEventRecord {
  return {
    ...row,
    contextType: String(row.contextType),
    metadata: fromJson(row.metadata),
  };
}

function mapPartner(row: {
  id: string;
  name: string;
  legalName: string | null;
  slug: string;
  description: string | null;
  type: PartnerRecord["type"];
  status: PartnerRecord["status"];
  logoUrl: string | null;
  websiteUrl: string | null;
  instagram: string | null;
  facebookUrl?: string | null;
  linkedinUrl?: string | null;
  email: string | null;
  phone: string | null;
  taxId: string | null;
  address?: string | null;
  city?: string | null;
  provinceOrState?: string | null;
  country?: string | null;
  postalCode?: string | null;
  notes: string | null;
  financialIdentityId: string | null;
  createdByUserId: number | null;
  updatedByUserId: number | null;
  createdAt: Date;
  updatedAt: Date;
  archivedAt: Date | null;
}): PartnerRecord {
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

function mapOnboardingInvitation(row: {
  id: string;
  partnerId: string;
  participationId: string | null;
  tokenHash: string;
  status: OnboardingInvitationRecord["status"];
  reviewStatus: OnboardingInvitationRecord["reviewStatus"];
  expiresAt: Date;
  openedAt: Date | null;
  submittedAt: Date | null;
  revokedAt: Date | null;
  reviewNotes: string | null;
  draftJson: Prisma.JsonValue | null;
  submissionJson: Prisma.JsonValue | null;
  createdByUserId: number | null;
  reviewedByUserId: number | null;
  reviewedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): OnboardingInvitationRecord {
  return {
    id: row.id,
    partnerId: row.partnerId,
    participationId: row.participationId,
    tokenHash: row.tokenHash,
    status: row.status,
    reviewStatus: row.reviewStatus,
    expiresAt: row.expiresAt,
    openedAt: row.openedAt,
    submittedAt: row.submittedAt,
    revokedAt: row.revokedAt,
    reviewNotes: row.reviewNotes,
    draftJson: (row.draftJson as PartnerOnboardingDraft | null) ?? null,
    submissionJson: (row.submissionJson as PartnerOnboardingSubmission | null) ?? null,
    createdByUserId: row.createdByUserId,
    reviewedByUserId: row.reviewedByUserId,
    reviewedAt: row.reviewedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapParticipation(row: ParticipationRecord): ParticipationRecord {
  return row;
}

export function createPrismaPartnersRepository(): PartnersRepository {
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
            facebookUrl: input.facebookUrl ?? null,
            linkedinUrl: input.linkedinUrl ?? null,
            email: input.email ?? null,
            phone: input.phone ?? null,
            taxId: input.taxId ?? null,
            address: input.address ?? null,
            city: input.city ?? null,
            provinceOrState: input.provinceOrState ?? null,
            country: input.country ?? null,
            postalCode: input.postalCode ?? null,
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
        if (input.facebookUrl !== undefined) data.facebookUrl = input.facebookUrl;
        if (input.linkedinUrl !== undefined) data.linkedinUrl = input.linkedinUrl;
        if (input.email !== undefined) data.email = input.email;
        if (input.phone !== undefined) data.phone = input.phone;
        if (input.taxId !== undefined) data.taxId = input.taxId;
        if (input.address !== undefined) data.address = input.address;
        if (input.city !== undefined) data.city = input.city;
        if (input.provinceOrState !== undefined) data.provinceOrState = input.provinceOrState;
        if (input.country !== undefined) data.country = input.country;
        if (input.postalCode !== undefined) data.postalCode = input.postalCode;
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
          emailIsPublic: input.emailIsPublic === true,
          phoneIsPublic: input.phoneIsPublic === true,
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
          institutionalRole: input.institutionalRole ?? "SPONSOR",
          displayTier: input.displayTier ?? "STANDARD",
          displayOrder:
            typeof input.displayOrder === "number" && Number.isFinite(input.displayOrder)
              ? Math.max(0, Math.trunc(input.displayOrder))
              : 100,
          publicRoleLabel: input.publicRoleLabel ?? null,
          destinationUrl: input.destinationUrl ?? null,
          clickTrackingEnabled: input.clickTrackingEnabled !== false,
          publicVisibility: input.publicVisibility ?? "HIDDEN",
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
          ...(input.institutionalRole !== undefined
            ? { institutionalRole: input.institutionalRole }
            : {}),
          ...(input.displayTier !== undefined ? { displayTier: input.displayTier } : {}),
          ...(input.displayOrder !== undefined
            ? {
                displayOrder:
                  typeof input.displayOrder === "number" && Number.isFinite(input.displayOrder)
                    ? Math.max(0, Math.trunc(input.displayOrder))
                    : 100,
              }
            : {}),
          ...(input.publicRoleLabel !== undefined
            ? { publicRoleLabel: input.publicRoleLabel }
            : {}),
          ...(input.destinationUrl !== undefined
            ? { destinationUrl: input.destinationUrl }
            : {}),
          ...(input.clickTrackingEnabled !== undefined
            ? { clickTrackingEnabled: input.clickTrackingEnabled !== false }
            : {}),
          ...(input.publicVisibility !== undefined
            ? { publicVisibility: input.publicVisibility }
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

    async deleteContribution(id) {
      await prisma.dnxPartnerContribution.delete({ where: { id } });
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
      return rows.map(
        (r): BenefitAccessRecord => ({
          ...r,
          metadata:
            r.metadata && typeof r.metadata === "object" && !Array.isArray(r.metadata)
              ? (r.metadata as Record<string, unknown>)
              : null,
        }),
      );
    },

    async getBenefitAccessByAccessKey(accessKey) {
      const row = await prisma.dnxPartnerBenefitAccess.findUnique({ where: { accessKey } });
      if (!row) return null;
      return {
        ...row,
        metadata:
          row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
            ? (row.metadata as Record<string, unknown>)
            : null,
      } as BenefitAccessRecord;
    },

    async getActiveBenefitAccess(benefitId, userId) {
      const row = await prisma.dnxPartnerBenefitAccess.findFirst({
        where: { benefitId, userId, status: "ACTIVE" },
      });
      if (!row) return null;
      return {
        ...row,
        metadata:
          row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
            ? (row.metadata as Record<string, unknown>)
            : null,
      } as BenefitAccessRecord;
    },

    async listActiveBenefitAccessForUser(benefitId, userId) {
      const rows = await prisma.dnxPartnerBenefitAccess.findMany({
        where: { benefitId, userId, status: "ACTIVE" },
      });
      return rows.map(
        (r): BenefitAccessRecord => ({
          ...r,
          metadata:
            r.metadata && typeof r.metadata === "object" && !Array.isArray(r.metadata)
              ? (r.metadata as Record<string, unknown>)
              : null,
        }),
      );
    },

    async upsertBenefitAccess(input: GrantBenefitAccessInput) {
      const source = input.source ?? "MANUAL";
      const accessKey =
        input.accessKey ??
        (source === "MANUAL"
          ? `manual:${input.benefitId}:${input.userId}`
          : `auto:${input.benefitId}:${input.userId}:${input.sourceType ?? "X"}:${input.sourceId ?? "X"}`);
      const row = await prisma.dnxPartnerBenefitAccess.upsert({
        where: { accessKey },
        create: {
          accessKey,
          benefitId: input.benefitId,
          userId: input.userId,
          status: "ACTIVE",
          source,
          sourceType: input.sourceType ?? (source === "MANUAL" ? "ADMIN" : null),
          sourceId: input.sourceId ?? null,
          reasonCode: input.reasonCode ?? (source === "MANUAL" ? "MANUAL_GRANT" : null),
          reason: input.reason ?? "MANUAL",
          notes: input.notes ?? null,
          grantedByUserId: input.grantedByUserId ?? null,
          grantedAt: new Date(),
          metadata: toInputJson(input.metadata),
        },
        update: {
          status: "ACTIVE",
          source,
          sourceType: input.sourceType ?? undefined,
          sourceId: input.sourceId ?? undefined,
          reasonCode: input.reasonCode ?? undefined,
          reason: input.reason ?? undefined,
          notes: input.notes ?? undefined,
          grantedByUserId: input.grantedByUserId ?? undefined,
          grantedAt: new Date(),
          revokedAt: null,
          revokedByUserId: null,
          metadata: toInputJson(input.metadata),
        },
      });
      return {
        ...row,
        metadata:
          row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
            ? (row.metadata as Record<string, unknown>)
            : null,
      } as BenefitAccessRecord;
    },

    async revokeBenefitAccessByAccessKey(accessKey, actorUserId) {
      const row = await prisma.dnxPartnerBenefitAccess.update({
        where: { accessKey },
        data: {
          status: "REVOKED",
          revokedAt: new Date(),
          revokedByUserId: actorUserId,
        },
      });
      return {
        ...row,
        metadata:
          row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
            ? (row.metadata as Record<string, unknown>)
            : null,
      } as BenefitAccessRecord;
    },

    async revokeBenefitAccess(benefitId, userId, actorUserId) {
      const existing = await prisma.dnxPartnerBenefitAccess.findFirst({
        where: { benefitId, userId, status: "ACTIVE" },
        orderBy: { createdAt: "desc" },
      });
      if (!existing) {
        throw new PartnersDomainError("NOT_FOUND", "Acceso no encontrado.");
      }
      const revokedAt = new Date();
      await prisma.dnxPartnerBenefitAccess.updateMany({
        where: { benefitId, userId, status: "ACTIVE" },
        data: { status: "REVOKED", revokedAt, revokedByUserId: actorUserId },
      });
      const row = await prisma.dnxPartnerBenefitAccess.findUniqueOrThrow({
        where: { accessKey: existing.accessKey },
      });
      return {
        ...row,
        metadata: fromJson(row.metadata),
      } as BenefitAccessRecord;
    },


    async listBrandAssets(partnerId) {
      const rows = await prisma.dnxPartnerAsset.findMany({
        where: { partnerId },
        orderBy: { updatedAt: "desc" },
      });
      return rows.map(mapBrandAsset);
    },

    async getBrandAssetById(id) {
      const row = await prisma.dnxPartnerAsset.findUnique({ where: { id } });
      return row ? mapBrandAsset(row) : null;
    },

    async createBrandAsset(input: CreateBrandAssetInput) {
      const { metadata, ...data } = input;
      const row = await prisma.dnxPartnerAsset.create({
        data: { ...data, metadata: toInputJson(metadata) },
      });
      return mapBrandAsset(row);
    },

    async updateBrandAsset(id, input: UpdateBrandAssetInput) {
      const { metadata, ...data } = input;
      const row = await prisma.dnxPartnerAsset.update({
        where: { id },
        data: {
          ...data,
          ...(metadata !== undefined ? { metadata: toInputJson(metadata) } : {}),
        },
      });
      return mapBrandAsset(row);
    },

    async clearPrimaryBrandAssets(partnerId, exceptId) {
      await prisma.dnxPartnerAsset.updateMany({
        where: {
          partnerId,
          isPrimary: true,
          ...(exceptId ? { id: { not: exceptId } } : {}),
        },
        data: { isPrimary: false },
      });
    },

    async listParticipationAssets(query: ListParticipationAssetsQuery) {
      const rows = await prisma.dnxPartnerParticipationAsset.findMany({
        where: {
          ...(query.participationId ? { participationId: query.participationId } : {}),
          ...(query.application ? { application: query.application } : {}),
          ...(query.channel ? { channel: query.channel } : {}),
          ...(query.assetType ? { assetType: query.assetType } : {}),
          ...(query.purpose ? { purpose: query.purpose } : {}),
          ...(query.benefitId ? { benefitId: query.benefitId } : {}),
          ...(query.contributionId ? { contributionId: query.contributionId } : {}),
          ...(query.prizeBundleId ? { prizeBundleId: query.prizeBundleId } : {}),
          ...(query.status ? { status: query.status } : {}),
          ...(query.approvalStatus ? { approvalStatus: query.approvalStatus } : {}),
          ...(!query.includeArchived
            ? { status: query.status ?? { not: "ARCHIVED" }, archivedAt: null }
            : {}),
        },
        orderBy: [{ sortOrder: "asc" }, { updatedAt: "desc" }],
      });
      return rows.map(mapParticipationAsset);
    },

    async getParticipationAssetById(id) {
      const row = await prisma.dnxPartnerParticipationAsset.findUnique({ where: { id } });
      return row ? mapParticipationAsset(row) : null;
    },

    async createParticipationAsset(input: CreateParticipationAssetInput) {
      const { metadata, ...data } = input;
      const row = await prisma.dnxPartnerParticipationAsset.create({
        data: { ...data, metadata: toInputJson(metadata) },
      });
      return mapParticipationAsset(row);
    },

    async updateParticipationAsset(id, input: UpdateParticipationAssetInput) {
      const { metadata, ...data } = input;
      const row = await prisma.dnxPartnerParticipationAsset.update({
        where: { id },
        data: {
          ...data,
          ...(metadata !== undefined ? { metadata: toInputJson(metadata) } : {}),
        },
      });
      return mapParticipationAsset(row);
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

    async getOutboundLinkByTrackingKey(trackingKey) {
      const row = await prisma.dnxPartnerOutboundLink.findUnique({ where: { trackingKey } });
      return row ?? null;
    },

    async findOutboundLinkByParticipationPlacement(participationId, placement) {
      const row = await prisma.dnxPartnerOutboundLink.findFirst({
        where: { participationId, placement, archivedAt: null },
        orderBy: { updatedAt: "desc" },
      });
      return row ?? null;
    },

    async listOutboundLinksByPartner(partnerId) {
      return prisma.dnxPartnerOutboundLink.findMany({
        where: { partnerId, archivedAt: null },
        orderBy: { updatedAt: "desc" },
      });
    },

    async createOutboundLink(input) {
      return prisma.dnxPartnerOutboundLink.create({
        data: {
          trackingKey: input.trackingKey,
          partnerId: input.partnerId,
          participationId: input.participationId ?? null,
          application: input.application,
          contextType: input.contextType,
          contextId: input.contextId ?? null,
          assetId: input.assetId ?? null,
          placement: input.placement,
          destinationUrl: input.destinationUrl,
          utmSource: input.utmSource ?? null,
          utmMedium: input.utmMedium ?? null,
          utmCampaign: input.utmCampaign ?? null,
          utmContent: input.utmContent ?? null,
          status: input.status ?? "ACTIVE",
          startsAt: input.startsAt ?? null,
          endsAt: input.endsAt ?? null,
        },
      });
    },

    async updateOutboundLink(id, input) {
      return prisma.dnxPartnerOutboundLink.update({
        where: { id },
        data: {
          ...(input.participationId !== undefined
            ? { participationId: input.participationId }
            : {}),
          ...(input.application !== undefined ? { application: input.application } : {}),
          ...(input.contextType !== undefined ? { contextType: input.contextType } : {}),
          ...(input.contextId !== undefined ? { contextId: input.contextId } : {}),
          ...(input.assetId !== undefined ? { assetId: input.assetId } : {}),
          ...(input.placement !== undefined ? { placement: input.placement } : {}),
          ...(input.destinationUrl !== undefined
            ? { destinationUrl: input.destinationUrl }
            : {}),
          ...(input.utmSource !== undefined ? { utmSource: input.utmSource } : {}),
          ...(input.utmMedium !== undefined ? { utmMedium: input.utmMedium } : {}),
          ...(input.utmCampaign !== undefined ? { utmCampaign: input.utmCampaign } : {}),
          ...(input.utmContent !== undefined ? { utmContent: input.utmContent } : {}),
          ...(input.status !== undefined ? { status: input.status } : {}),
          ...(input.startsAt !== undefined ? { startsAt: input.startsAt } : {}),
          ...(input.endsAt !== undefined ? { endsAt: input.endsAt } : {}),
          ...(input.archivedAt !== undefined ? { archivedAt: input.archivedAt } : {}),
        },
      });
    },

    async createClickEvent(input) {
      const row = await prisma.dnxPartnerClickEvent.create({
        data: {
          outboundLinkId: input.outboundLinkId,
          partnerId: input.partnerId,
          participationId: input.participationId ?? null,
          application: input.application,
          contextType: input.contextType,
          contextId: input.contextId ?? null,
          assetId: input.assetId ?? null,
          placement: input.placement,
          referrerHost: input.referrerHost ?? null,
          deviceClass: input.deviceClass,
          browserFamily: input.browserFamily ?? null,
          countryCode: input.countryCode ?? null,
          metadata: toInputJson(input.metadata),
        },
      });
      return mapClickEvent(row);
    },

    async listClickEventsByPartner(partnerId) {
      const rows = await prisma.dnxPartnerClickEvent.findMany({
        where: { partnerId },
        orderBy: { occurredAt: "desc" },
        take: 5000,
      });
      return rows.map(mapClickEvent);
    },

    async countClickEvents(query) {
      return prisma.dnxPartnerClickEvent.count({
        where: {
          ...(query.partnerId ? { partnerId: query.partnerId } : {}),
          ...(query.participationId ? { participationId: query.participationId } : {}),
          ...(query.application ? { application: query.application } : {}),
          ...(query.contextId ? { contextId: query.contextId } : {}),
          ...(query.since ? { occurredAt: { gte: query.since } } : {}),
        },
      });
    },

    async createOnboardingInvitation(input) {
      const row = await prisma.dnxPartnerOnboardingInvitation.create({
        data: {
          partnerId: input.partnerId,
          participationId: input.participationId ?? null,
          tokenHash: input.tokenHash,
          expiresAt: input.expiresAt,
          createdByUserId: input.createdByUserId ?? null,
        },
      });
      return mapOnboardingInvitation(row);
    },

    async getOnboardingInvitationById(id) {
      const row = await prisma.dnxPartnerOnboardingInvitation.findUnique({ where: { id } });
      return row ? mapOnboardingInvitation(row) : null;
    },

    async getOnboardingInvitationByTokenHash(tokenHash) {
      const row = await prisma.dnxPartnerOnboardingInvitation.findUnique({
        where: { tokenHash },
      });
      return row ? mapOnboardingInvitation(row) : null;
    },

    async listOnboardingInvitationsByPartner(partnerId) {
      const rows = await prisma.dnxPartnerOnboardingInvitation.findMany({
        where: { partnerId },
        orderBy: { createdAt: "desc" },
      });
      return rows.map(mapOnboardingInvitation);
    },

    async updateOnboardingInvitation(id, input) {
      const row = await prisma.dnxPartnerOnboardingInvitation.update({
        where: { id },
        data: {
          ...(input.status !== undefined ? { status: input.status } : {}),
          ...(input.reviewStatus !== undefined ? { reviewStatus: input.reviewStatus } : {}),
          ...(input.expiresAt !== undefined ? { expiresAt: input.expiresAt } : {}),
          ...(input.openedAt !== undefined ? { openedAt: input.openedAt } : {}),
          ...(input.submittedAt !== undefined ? { submittedAt: input.submittedAt } : {}),
          ...(input.revokedAt !== undefined ? { revokedAt: input.revokedAt } : {}),
          ...(input.reviewNotes !== undefined ? { reviewNotes: input.reviewNotes } : {}),
          ...(input.draftJson !== undefined
            ? { draftJson: toInputJson(input.draftJson as Record<string, unknown> | null) }
            : {}),
          ...(input.submissionJson !== undefined
            ? {
                submissionJson: toInputJson(
                  input.submissionJson as Record<string, unknown> | null,
                ),
              }
            : {}),
          ...(input.reviewedByUserId !== undefined
            ? { reviewedByUserId: input.reviewedByUserId }
            : {}),
          ...(input.reviewedAt !== undefined ? { reviewedAt: input.reviewedAt } : {}),
        },
      });
      return mapOnboardingInvitation(row);
    },
  };
}
