import { randomUUID } from "node:crypto";
import type { PartnersRepository } from "./repository";
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
        email: input.email ?? null,
        phone: input.phone ?? null,
        taxId: input.taxId ?? null,
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
      const next: ParticipationRecord = {
        ...current,
        ...input,
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

    async getActiveBenefitAccess(benefitId, userId) {
      return (
        [...benefitAccess.values()].find(
          (a) => a.benefitId === benefitId && a.userId === userId && a.status === "ACTIVE",
        ) ?? null
      );
    },

    async upsertBenefitAccess(input: GrantBenefitAccessInput) {
      const existing = [...benefitAccess.values()].find(
        (a) => a.benefitId === input.benefitId && a.userId === input.userId,
      );
      const ts = now();
      if (existing) {
        const next: BenefitAccessRecord = {
          ...existing,
          status: "ACTIVE",
          reason: input.reason ?? existing.reason,
          notes: input.notes ?? existing.notes,
          grantedByUserId: input.grantedByUserId ?? existing.grantedByUserId,
          revokedAt: null,
          updatedAt: ts,
        };
        benefitAccess.set(existing.id, next);
        return next;
      }
      const row: BenefitAccessRecord = {
        id: randomUUID(),
        benefitId: input.benefitId,
        userId: input.userId,
        status: "ACTIVE",
        reason: input.reason ?? "MANUAL",
        notes: input.notes ?? null,
        grantedByUserId: input.grantedByUserId ?? null,
        revokedAt: null,
        createdAt: ts,
        updatedAt: ts,
      };
      benefitAccess.set(row.id, row);
      return row;
    },

    async revokeBenefitAccess(benefitId, userId) {
      const existing = [...benefitAccess.values()].find(
        (a) => a.benefitId === benefitId && a.userId === userId,
      );
      if (!existing) throw new PartnersDomainError("NOT_FOUND", "Acceso no encontrado.");
      const next: BenefitAccessRecord = {
        ...existing,
        status: "REVOKED",
        revokedAt: now(),
        updatedAt: now(),
      };
      benefitAccess.set(existing.id, next);
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
