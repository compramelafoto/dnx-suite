import { randomUUID } from "node:crypto";
import type { PartnersRepository } from "./repository";
import type {
  CreateBrandAssetInput,
  CreateParticipationAssetInput,
  ParticipationAssetRecord,
  PartnerBrandAssetRecord,
  UpdateBrandAssetInput,
  UpdateParticipationAssetInput,
} from "./assets-types";
import { filterParticipationAssets } from "./assets-resolve";
import type { ClickEventRecord, OutboundLinkRecord } from "./tracking";
import { assertSafePartnerDestinationUrl } from "./tracking";
import type {
  OnboardingInvitationRecord,
  PartnerOnboardingDraft,
  PartnerOnboardingSubmission,
} from "./onboarding-types";
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
  PartnerAuditEventRecord,
  PartnerContactRecord,
  PartnerListItem,
  PartnerRecord,
  ParticipationRecord,
  UpdateBenefitInput,
  UpdateContributionInput,
  UpdateParticipationInput,
  UpdatePartnerInput,
} from "./types";
import { PartnersDomainError } from "./types";

function now(): Date {
  return new Date();
}

export function createMemoryPartnersRepository(): PartnersRepository {
  const partners = new Map<string, PartnerRecord>();
  const contacts = new Map<string, PartnerContactRecord>();
  const participations = new Map<string, ParticipationRecord>();
  const contributions = new Map<string, ContributionRecord>();
  const benefits = new Map<string, BenefitRecord>();
  const audiences = new Map<string, BenefitAudienceRecord>();
  const benefitAccess = new Map<string, BenefitAccessRecord>();
  const brandAssets = new Map<string, PartnerBrandAssetRecord>();
  const participationAssets = new Map<string, ParticipationAssetRecord>();
  const outboundLinks = new Map<string, OutboundLinkRecord>();
  const clickEvents = new Map<string, ClickEventRecord>();
  const onboardingInvitations = new Map<string, OnboardingInvitationRecord>();
  const audits: PartnerAuditEventRecord[] = [];

  return {
    async listPartners(query) {
      let rows = [...partners.values()];
      if (query?.status) rows = rows.filter((p) => p.status === query.status);
      if (query?.search) {
        const q = query.search.toLowerCase();
        rows = rows.filter(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            p.slug.includes(q) ||
            (p.legalName?.toLowerCase().includes(q) ?? false),
        );
      }
      rows.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
      return rows.map((p): PartnerListItem => ({
        ...p,
        activeParticipationsCount: [...participations.values()].filter(
          (x) => x.partnerId === p.id && x.status === "ACTIVE" && !x.archivedAt,
        ).length,
        activeBenefitsCount: [...benefits.values()].filter(
          (x) => x.partnerId === p.id && x.status === "ACTIVE" && !x.archivedAt,
        ).length,
      }));
    },

    async getPartnerById(id) {
      return partners.get(id) ?? null;
    },

    async getPartnerBySlug(slug) {
      return [...partners.values()].find((p) => p.slug === slug) ?? null;
    },

    async createPartner(input: CreatePartnerInput & { slug: string; name: string }) {
      const existing = [...partners.values()].find((p) => p.slug === input.slug);
      if (existing) {
        throw new PartnersDomainError("CONFLICT", "Ya existe un partner con ese slug.", {
          slug: "Slug en uso.",
        });
      }
      const ts = now();
      const row: PartnerRecord = {
        id: randomUUID(),
        name: input.name,
        legalName: input.legalName ?? null,
        slug: input.slug,
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
        financialIdentityId: null,
        createdByUserId: input.createdByUserId ?? null,
        updatedByUserId: input.createdByUserId ?? null,
        createdAt: ts,
        updatedAt: ts,
        archivedAt: null,
      };
      partners.set(row.id, row);
      return row;
    },

    async updatePartner(id, input: UpdatePartnerInput) {
      const current = partners.get(id);
      if (!current) throw new PartnersDomainError("NOT_FOUND", "Partner no encontrado.");
      if (input.slug && input.slug !== current.slug) {
        const clash = [...partners.values()].find((p) => p.slug === input.slug && p.id !== id);
        if (clash) {
          throw new PartnersDomainError("CONFLICT", "Slug en uso.", { slug: "Slug en uso." });
        }
      }
      const next: PartnerRecord = {
        ...current,
        ...input,
        name: input.name?.trim() || current.name,
        slug: input.slug ?? current.slug,
        updatedAt: now(),
        updatedByUserId: input.updatedByUserId ?? current.updatedByUserId,
      };
      partners.set(id, next);
      return next;
    },

    async archivePartner(id, actorUserId) {
      const current = partners.get(id);
      if (!current) throw new PartnersDomainError("NOT_FOUND", "Partner no encontrado.");
      const next: PartnerRecord = {
        ...current,
        status: "ARCHIVED",
        archivedAt: now(),
        updatedAt: now(),
        updatedByUserId: actorUserId,
      };
      partners.set(id, next);
      return next;
    },

    async listContacts(partnerId) {
      return [...contacts.values()].filter((c) => c.partnerId === partnerId && !c.archivedAt);
    },

    async createContact(input: CreateContactInput) {
      const ts = now();
      const row: PartnerContactRecord = {
        id: randomUUID(),
        partnerId: input.partnerId,
        firstName: input.firstName.trim(),
        lastName: input.lastName ?? null,
        roleTitle: input.roleTitle ?? null,
        email: input.email ?? null,
        phone: input.phone ?? null,
        whatsapp: input.whatsapp ?? null,
        emailIsPublic: input.emailIsPublic === true,
        phoneIsPublic: input.phoneIsPublic === true,
        isPrimary: input.isPrimary ?? false,
        notes: input.notes ?? null,
        createdAt: ts,
        updatedAt: ts,
        archivedAt: null,
      };
      contacts.set(row.id, row);
      return row;
    },

    async listParticipations(partnerId) {
      return [...participations.values()].filter((p) => p.partnerId === partnerId);
    },

    async listParticipationsByContext(query) {
      return [...participations.values()].filter((p) => {
        if (p.application !== query.application) return false;
        if (p.contextType !== query.contextType) return false;
        if (p.contextId !== query.contextId) return false;
        if (query.status && p.status !== query.status) return false;
        if (!query.includeArchived && (p.status === "ARCHIVED" || p.archivedAt)) return false;
        return true;
      });
    },

    async getParticipationById(id) {
      return participations.get(id) ?? null;
    },

    async createParticipation(input: CreateParticipationInput) {
      const ts = now();
      const row: ParticipationRecord = {
        id: randomUUID(),
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
        destinationUrl: input.destinationUrl
          ? assertSafePartnerDestinationUrl(input.destinationUrl)
          : null,
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
        createdAt: ts,
        updatedAt: ts,
        archivedAt: null,
      };
      participations.set(row.id, row);
      return row;
    },

    async updateParticipation(id, input: UpdateParticipationInput) {
      const current = participations.get(id);
      if (!current) throw new PartnersDomainError("NOT_FOUND", "Participación no encontrada.");
      const displayOrder =
        input.displayOrder === undefined
          ? current.displayOrder
          : typeof input.displayOrder === "number" && Number.isFinite(input.displayOrder)
            ? Math.max(0, Math.trunc(input.displayOrder))
            : current.displayOrder;
      const destinationUrl =
        input.destinationUrl === undefined
          ? current.destinationUrl
          : input.destinationUrl
            ? assertSafePartnerDestinationUrl(input.destinationUrl)
            : null;
      const next: ParticipationRecord = {
        ...current,
        ...input,
        displayOrder,
        publicRoleLabel:
          input.publicRoleLabel === undefined
            ? current.publicRoleLabel
            : input.publicRoleLabel,
        destinationUrl,
        clickTrackingEnabled:
          input.clickTrackingEnabled === undefined
            ? current.clickTrackingEnabled
            : input.clickTrackingEnabled !== false,
        publicVisibility:
          input.publicVisibility === undefined
            ? current.publicVisibility
            : input.publicVisibility,
        updatedAt: now(),
        updatedByUserId: input.updatedByUserId ?? current.updatedByUserId,
      };
      participations.set(id, next);
      return next;
    },

    async archiveParticipation(id, actorUserId) {
      const current = participations.get(id);
      if (!current) throw new PartnersDomainError("NOT_FOUND", "Participación no encontrada.");
      const next: ParticipationRecord = {
        ...current,
        status: "ARCHIVED",
        archivedAt: now(),
        updatedAt: now(),
        updatedByUserId: actorUserId,
      };
      participations.set(id, next);
      return next;
    },

    async listContributions(participationId) {
      return [...contributions.values()].filter((c) => c.participationId === participationId);
    },

    async listContributionsByPrizeBundleId(prizeBundleId) {
      return [...contributions.values()].filter((c) => c.prizeBundleId === prizeBundleId);
    },

    async getContributionById(id) {
      return contributions.get(id) ?? null;
    },

    async createContribution(input: CreateContributionInput) {
      const ts = now();
      const row: ContributionRecord = {
        id: randomUUID(),
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
        deliveredAt: null,
        promotionId: input.promotionId ?? null,
        prizeBundleId: input.prizeBundleId ?? null,
        externalCode: input.externalCode ?? null,
        notes: input.notes ?? null,
        createdByUserId: input.createdByUserId ?? null,
        updatedByUserId: input.createdByUserId ?? null,
        createdAt: ts,
        updatedAt: ts,
      };
      contributions.set(row.id, row);
      return row;
    },

    async updateContribution(id, input: UpdateContributionInput) {
      const current = contributions.get(id);
      if (!current) throw new PartnersDomainError("NOT_FOUND", "Aporte no encontrado.");
      const next: ContributionRecord = {
        ...current,
        ...input,
        updatedAt: now(),
        updatedByUserId: input.updatedByUserId ?? current.updatedByUserId,
      };
      contributions.set(id, next);
      return next;
    },

    async deleteContribution(id) {
      if (!contributions.has(id)) {
        throw new PartnersDomainError("NOT_FOUND", "Aporte no encontrado.");
      }
      contributions.delete(id);
    },

    async listBenefits(partnerId) {
      return [...benefits.values()].filter((b) => b.partnerId === partnerId);
    },

    async listBenefitsByParticipationIds(participationIds) {
      const set = new Set(participationIds);
      return [...benefits.values()].filter(
        (b) => b.participationId != null && set.has(b.participationId),
      );
    },

    async getBenefitById(id) {
      return benefits.get(id) ?? null;
    },

    async createBenefit(input: CreateBenefitInput) {
      const ts = now();
      const row: BenefitRecord = {
        id: randomUUID(),
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
        createdAt: ts,
        updatedAt: ts,
        archivedAt: null,
      };
      benefits.set(row.id, row);
      return row;
    },

    async updateBenefit(id, input: UpdateBenefitInput) {
      const current = benefits.get(id);
      if (!current) throw new PartnersDomainError("NOT_FOUND", "Beneficio no encontrado.");
      const next: BenefitRecord = {
        ...current,
        ...input,
        updatedAt: now(),
        updatedByUserId: input.updatedByUserId ?? current.updatedByUserId,
      };
      benefits.set(id, next);
      return next;
    },

    async archiveBenefit(id, actorUserId) {
      const current = benefits.get(id);
      if (!current) throw new PartnersDomainError("NOT_FOUND", "Beneficio no encontrado.");
      const next: BenefitRecord = {
        ...current,
        status: "ARCHIVED",
        archivedAt: now(),
        updatedAt: now(),
        updatedByUserId: actorUserId,
      };
      benefits.set(id, next);
      return next;
    },

    async listAudiences(benefitId) {
      return [...audiences.values()].filter((a) => a.benefitId === benefitId);
    },

    async assignAudience(input: AssignAudienceInput) {
      const row: BenefitAudienceRecord = {
        id: randomUUID(),
        benefitId: input.benefitId,
        audienceType: input.audienceType,
        organizationId: input.organizationId ?? null,
        contextType: input.contextType ?? null,
        contextId: input.contextId ?? null,
        manualUserId: input.manualUserId ?? null,
        label: input.label ?? null,
        metadata: input.metadata ?? null,
        createdAt: now(),
      };
      audiences.set(row.id, row);
      return row;
    },

    async listBenefitAccess(benefitId) {
      return [...benefitAccess.values()].filter((a) => a.benefitId === benefitId);
    },

    async getBenefitAccessByAccessKey(accessKey) {
      return [...benefitAccess.values()].find((a) => a.accessKey === accessKey) ?? null;
    },

    async getActiveBenefitAccess(benefitId, userId) {
      return (
        [...benefitAccess.values()].find(
          (a) => a.benefitId === benefitId && a.userId === userId && a.status === "ACTIVE",
        ) ?? null
      );
    },

    async listActiveBenefitAccessForUser(benefitId, userId) {
      return [...benefitAccess.values()].filter(
        (a) => a.benefitId === benefitId && a.userId === userId && a.status === "ACTIVE",
      );
    },

    async upsertBenefitAccess(input: GrantBenefitAccessInput) {
      const source = input.source ?? "MANUAL";
      const accessKey =
        input.accessKey ??
        (source === "MANUAL"
          ? `manual:${input.benefitId}:${input.userId}`
          : `auto:${input.benefitId}:${input.userId}:${input.sourceType ?? "X"}:${input.sourceId ?? "X"}`);
      const existing = [...benefitAccess.values()].find((a) => a.accessKey === accessKey);
      const ts = now();
      if (existing) {
        const next: BenefitAccessRecord = {
          ...existing,
          status: "ACTIVE",
          source,
          sourceType: input.sourceType ?? existing.sourceType,
          sourceId: input.sourceId ?? existing.sourceId,
          reasonCode: input.reasonCode ?? existing.reasonCode,
          reason: input.reason ?? existing.reason,
          notes: input.notes ?? existing.notes,
          grantedByUserId: input.grantedByUserId ?? existing.grantedByUserId,
          revokedByUserId: null,
          revokedAt: null,
          grantedAt: ts,
          metadata: input.metadata ?? existing.metadata,
          updatedAt: ts,
        };
        benefitAccess.set(existing.id, next);
        return next;
      }
      const row: BenefitAccessRecord = {
        id: randomUUID(),
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
        revokedByUserId: null,
        grantedAt: ts,
        revokedAt: null,
        metadata: input.metadata ?? null,
        createdAt: ts,
        updatedAt: ts,
      };
      benefitAccess.set(row.id, row);
      return row;
    },

    async revokeBenefitAccessByAccessKey(accessKey, actorUserId) {
      const existing = [...benefitAccess.values()].find((a) => a.accessKey === accessKey);
      if (!existing) throw new PartnersDomainError("NOT_FOUND", "Acceso no encontrado.");
      const next: BenefitAccessRecord = {
        ...existing,
        status: "REVOKED",
        revokedAt: now(),
        revokedByUserId: actorUserId,
        updatedAt: now(),
      };
      benefitAccess.set(existing.id, next);
      return next;
    },

    async revokeBenefitAccess(benefitId, userId, actorUserId) {
      const existing = [...benefitAccess.values()].find(
        (a) => a.benefitId === benefitId && a.userId === userId && a.status === "ACTIVE",
      );
      if (!existing) throw new PartnersDomainError("NOT_FOUND", "Acceso no encontrado.");
      const next: BenefitAccessRecord = {
        ...existing,
        status: "REVOKED",
        revokedAt: now(),
        revokedByUserId: actorUserId,
        updatedAt: now(),
      };
      benefitAccess.set(existing.id, next);
      return next;
    },

    async listBrandAssets(partnerId) {
      return [...brandAssets.values()]
        .filter((a) => a.partnerId === partnerId)
        .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    },

    async getBrandAssetById(id) {
      return brandAssets.get(id) ?? null;
    },

    async createBrandAsset(input: CreateBrandAssetInput) {
      const ts = now();
      const row: PartnerBrandAssetRecord = {
        id: randomUUID(),
        partnerId: input.partnerId,
        type: input.type,
        name: input.name,
        description: input.description ?? null,
        storageProvider: input.storageProvider ?? "R2",
        storageKey: input.storageKey ?? null,
        fileUrl: input.fileUrl ?? null,
        mediaAssetId: input.mediaAssetId ?? null,
        originalFilename: input.originalFilename ?? null,
        mimeType: input.mimeType ?? null,
        fileExtension: input.fileExtension ?? null,
        fileSize: input.fileSize ?? null,
        width: input.width ?? null,
        height: input.height ?? null,
        durationSeconds: input.durationSeconds ?? null,
        aspectRatio: input.aspectRatio ?? null,
        backgroundType: input.backgroundType ?? "UNKNOWN",
        isPrimary: input.isPrimary === true,
        status: input.status ?? "DRAFT",
        approvalStatus: input.approvalStatus ?? "PENDING",
        altText: input.altText ?? null,
        notes: input.notes ?? null,
        metadata: input.metadata ?? null,
        uploadedById: input.uploadedById ?? null,
        approvedById: null,
        approvedAt: null,
        createdAt: ts,
        updatedAt: ts,
        archivedAt: null,
      };
      brandAssets.set(row.id, row);
      return row;
    },

    async updateBrandAsset(id, input: UpdateBrandAssetInput) {
      const current = brandAssets.get(id);
      if (!current) throw new PartnersDomainError("NOT_FOUND", "Asset no encontrado.");
      const next: PartnerBrandAssetRecord = {
        ...current,
        ...input,
        updatedAt: now(),
      };
      brandAssets.set(id, next);
      return next;
    },

    async clearPrimaryBrandAssets(partnerId, exceptId) {
      for (const [id, asset] of brandAssets) {
        if (asset.partnerId === partnerId && asset.isPrimary && id !== exceptId) {
          brandAssets.set(id, { ...asset, isPrimary: false, updatedAt: now() });
        }
      }
    },

    async listParticipationAssets(query) {
      void filterParticipationAssets;
      return [...participationAssets.values()]
        .filter((a) => {
          if (query.participationId && a.participationId !== query.participationId) return false;
          if (query.application && a.application !== query.application) return false;
          if (query.channel && a.channel !== query.channel) return false;
          if (query.assetType && a.assetType !== query.assetType) return false;
          if (query.purpose && a.purpose !== query.purpose) return false;
          if (query.benefitId && a.benefitId !== query.benefitId) return false;
          if (query.contributionId && a.contributionId !== query.contributionId) return false;
          if (query.prizeBundleId && a.prizeBundleId !== query.prizeBundleId) return false;
          if (query.status && a.status !== query.status) return false;
          if (query.approvalStatus && a.approvalStatus !== query.approvalStatus) return false;
          if (!query.includeArchived && (a.status === "ARCHIVED" || a.archivedAt)) return false;
          return true;
        })
        .sort((a, b) => a.sortOrder - b.sortOrder || b.updatedAt.getTime() - a.updatedAt.getTime());
    },

    async getParticipationAssetById(id) {
      return participationAssets.get(id) ?? null;
    },

    async createParticipationAsset(input: CreateParticipationAssetInput) {
      const ts = now();
      const row: ParticipationAssetRecord = {
        id: randomUUID(),
        participationId: input.participationId,
        benefitId: input.benefitId ?? null,
        contributionId: input.contributionId ?? null,
        prizeBundleId: input.prizeBundleId ?? null,
        application: input.application ?? "CLICKATON",
        channel: input.channel ?? "WEB",
        assetType: input.assetType ?? "IMAGE",
        purpose: input.purpose ?? "SPONSOR_VISIBILITY",
        name: input.name,
        description: input.description ?? null,
        storageProvider: input.storageProvider ?? "R2",
        storageKey: input.storageKey ?? null,
        fileUrl: input.fileUrl ?? null,
        mediaAssetId: input.mediaAssetId ?? null,
        originalFilename: input.originalFilename ?? null,
        mimeType: input.mimeType ?? null,
        fileExtension: input.fileExtension ?? null,
        fileSize: input.fileSize ?? null,
        width: input.width ?? null,
        height: input.height ?? null,
        durationSeconds: input.durationSeconds ?? null,
        aspectRatio: input.aspectRatio ?? null,
        orientation: input.orientation ?? "UNKNOWN",
        status: input.status ?? "DRAFT",
        approvalStatus: input.approvalStatus ?? "PENDING",
        startsAt: input.startsAt ?? null,
        endsAt: input.endsAt ?? null,
        altText: input.altText ?? null,
        caption: input.caption ?? null,
        ctaText: input.ctaText ?? null,
        ctaUrl: input.ctaUrl ?? null,
        sortOrder: input.sortOrder ?? 100,
        metadata: input.metadata ?? null,
        uploadedById: input.uploadedById ?? null,
        approvedById: null,
        approvedAt: null,
        createdAt: ts,
        updatedAt: ts,
        archivedAt: null,
      };
      participationAssets.set(row.id, row);
      return row;
    },

    async updateParticipationAsset(id, input: UpdateParticipationAssetInput) {
      const current = participationAssets.get(id);
      if (!current) throw new PartnersDomainError("NOT_FOUND", "Material no encontrado.");
      const next: ParticipationAssetRecord = {
        ...current,
        ...input,
        updatedAt: now(),
      };
      participationAssets.set(id, next);
      return next;
    },

    async appendAudit(event) {
      audits.push({
        id: event.id ?? randomUUID(),
        partnerId: event.partnerId,
        entityType: event.entityType,
        entityId: event.entityId,
        action: event.action,
        actorUserId: event.actorUserId,
        summary: event.summary,
        beforeJson: event.beforeJson,
        afterJson: event.afterJson,
        createdAt: now(),
      });
    },

    async getOutboundLinkByTrackingKey(trackingKey) {
      return [...outboundLinks.values()].find((l) => l.trackingKey === trackingKey) ?? null;
    },

    async findOutboundLinkByParticipationPlacement(participationId, placement) {
      return (
        [...outboundLinks.values()].find(
          (l) =>
            l.participationId === participationId &&
            l.placement === placement &&
            !l.archivedAt,
        ) ?? null
      );
    },

    async listOutboundLinksByPartner(partnerId) {
      return [...outboundLinks.values()]
        .filter((l) => l.partnerId === partnerId && !l.archivedAt)
        .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    },

    async createOutboundLink(input) {
      const ts = now();
      const row: OutboundLinkRecord = {
        id: randomUUID(),
        trackingKey: input.trackingKey,
        partnerId: input.partnerId,
        participationId: input.participationId ?? null,
        application: input.application,
        contextType: input.contextType,
        contextId: input.contextId ?? null,
        assetId: input.assetId ?? null,
        placement: input.placement,
        destinationUrl: assertSafePartnerDestinationUrl(input.destinationUrl),
        utmSource: input.utmSource ?? null,
        utmMedium: input.utmMedium ?? null,
        utmCampaign: input.utmCampaign ?? null,
        utmContent: input.utmContent ?? null,
        status: input.status ?? "ACTIVE",
        startsAt: input.startsAt ?? null,
        endsAt: input.endsAt ?? null,
        createdAt: ts,
        updatedAt: ts,
        archivedAt: null,
      };
      outboundLinks.set(row.id, row);
      return row;
    },

    async updateOutboundLink(id, input) {
      const current = outboundLinks.get(id);
      if (!current) throw new PartnersDomainError("NOT_FOUND", "Outbound link no encontrado.");
      const next: OutboundLinkRecord = {
        ...current,
        ...input,
        destinationUrl: input.destinationUrl
          ? assertSafePartnerDestinationUrl(input.destinationUrl)
          : current.destinationUrl,
        updatedAt: now(),
      };
      outboundLinks.set(id, next);
      return next;
    },

    async createClickEvent(input) {
      const row: ClickEventRecord = {
        id: randomUUID(),
        outboundLinkId: input.outboundLinkId,
        partnerId: input.partnerId,
        participationId: input.participationId ?? null,
        application: input.application,
        contextType: input.contextType,
        contextId: input.contextId ?? null,
        assetId: input.assetId ?? null,
        placement: input.placement,
        occurredAt: now(),
        referrerHost: input.referrerHost ?? null,
        deviceClass: input.deviceClass,
        browserFamily: input.browserFamily ?? null,
        countryCode: input.countryCode ?? null,
        metadata: input.metadata ?? null,
      };
      clickEvents.set(row.id, row);
      return row;
    },

    async listClickEventsByPartner(partnerId) {
      return [...clickEvents.values()]
        .filter((e) => e.partnerId === partnerId)
        .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());
    },

    async countClickEvents(query) {
      return [...clickEvents.values()].filter((e) => {
        if (query.partnerId && e.partnerId !== query.partnerId) return false;
        if (query.participationId && e.participationId !== query.participationId) return false;
        if (query.application && e.application !== query.application) return false;
        if (query.contextId && e.contextId !== query.contextId) return false;
        if (query.since && e.occurredAt.getTime() < query.since.getTime()) return false;
        return true;
      }).length;
    },

    async createOnboardingInvitation(input) {
      const ts = now();
      const row: OnboardingInvitationRecord = {
        id: randomUUID(),
        partnerId: input.partnerId,
        participationId: input.participationId ?? null,
        tokenHash: input.tokenHash,
        status: "PENDING",
        reviewStatus: "NONE",
        expiresAt: input.expiresAt,
        openedAt: null,
        submittedAt: null,
        revokedAt: null,
        reviewNotes: null,
        draftJson: null,
        submissionJson: null,
        createdByUserId: input.createdByUserId ?? null,
        reviewedByUserId: null,
        reviewedAt: null,
        createdAt: ts,
        updatedAt: ts,
      };
      onboardingInvitations.set(row.id, row);
      return row;
    },

    async getOnboardingInvitationById(id) {
      return onboardingInvitations.get(id) ?? null;
    },

    async getOnboardingInvitationByTokenHash(tokenHash) {
      return (
        [...onboardingInvitations.values()].find((i) => i.tokenHash === tokenHash) ?? null
      );
    },

    async listOnboardingInvitationsByPartner(partnerId) {
      return [...onboardingInvitations.values()]
        .filter((i) => i.partnerId === partnerId)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    },

    async updateOnboardingInvitation(id, input) {
      const current = onboardingInvitations.get(id);
      if (!current) {
        throw new PartnersDomainError("NOT_FOUND", "Invitación no encontrada.");
      }
      const next: OnboardingInvitationRecord = {
        ...current,
        ...input,
        draftJson:
          input.draftJson === undefined
            ? current.draftJson
            : (input.draftJson as PartnerOnboardingDraft | null),
        submissionJson:
          input.submissionJson === undefined
            ? current.submissionJson
            : (input.submissionJson as PartnerOnboardingSubmission | null),
        updatedAt: now(),
      };
      onboardingInvitations.set(id, next);
      return next;
    },
  };
}

/** Expuesto solo para asserts de tests. */
export function getMemoryAuditSink(repo: PartnersRepository): never {
  void repo;
  throw new Error("Use createMemoryPartnersRepositoryWithAudit for audit inspection.");
}

export type MemoryPartnersRepositoryWithAudit = PartnersRepository & {
  getAuditEvents(): PartnerAuditEventRecord[];
};

export function createMemoryPartnersRepositoryWithAudit(): MemoryPartnersRepositoryWithAudit {
  const base = createMemoryPartnersRepository();
  const events: PartnerAuditEventRecord[] = [];
  return {
    ...base,
    async appendAudit(event) {
      const row: PartnerAuditEventRecord = {
        id: event.id ?? randomUUID(),
        partnerId: event.partnerId,
        entityType: event.entityType,
        entityId: event.entityId,
        action: event.action,
        actorUserId: event.actorUserId,
        summary: event.summary,
        beforeJson: event.beforeJson,
        afterJson: event.afterJson,
        createdAt: now(),
      };
      events.push(row);
      await base.appendAudit(event);
    },
    getAuditEvents() {
      return events;
    },
  };
}
