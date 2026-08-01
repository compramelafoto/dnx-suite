import { assertPartnerCapability } from "./permissions";
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
  ListParticipationsByContextQuery,
  PartnerActor,
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
import {
  assertNoAutomaticPaymentSideEffects,
  normalizeCreatePartnerInput,
  normalizePaymentFields,
  validateBenefitFields,
  validateContributionInput,
  validateParticipationDates,
} from "./validate";

export type PartnersService = ReturnType<typeof createPartnersService>;

export function createPartnersService(repo: PartnersRepository) {
  async function audit(
    actor: PartnerActor,
    params: {
      partnerId: string | null;
      entityType: string;
      entityId: string;
      action: string;
      summary?: string;
      before?: Record<string, unknown> | null;
      after?: Record<string, unknown> | null;
    },
  ) {
    await repo.appendAudit({
      partnerId: params.partnerId,
      entityType: params.entityType,
      entityId: params.entityId,
      action: params.action,
      actorUserId: actor.userId,
      summary: params.summary ?? null,
      beforeJson: params.before ?? null,
      afterJson: params.after ?? null,
    });
  }

  return {
    async listPartners(
      actor: PartnerActor,
      query?: { search?: string; status?: string },
    ): Promise<PartnerListItem[]> {
      assertPartnerCapability(actor, "PARTNER_VIEW");
      return repo.listPartners(query);
    },

    async getPartner(actor: PartnerActor, id: string): Promise<PartnerRecord> {
      assertPartnerCapability(actor, "PARTNER_VIEW");
      const partner = await repo.getPartnerById(id);
      if (!partner) throw new PartnersDomainError("NOT_FOUND", "Partner no encontrado.");
      return partner;
    },

    async createPartner(actor: PartnerActor, input: CreatePartnerInput): Promise<PartnerRecord> {
      assertPartnerCapability(actor, "PARTNER_CREATE");
      const normalized = normalizeCreatePartnerInput(input);
      const partner = await repo.createPartner({
        ...normalized,
        createdByUserId: actor.userId,
      });
      await audit(actor, {
        partnerId: partner.id,
        entityType: "DnxPartner",
        entityId: partner.id,
        action: "partner.create",
        after: { name: partner.name, slug: partner.slug, status: partner.status },
      });
      return partner;
    },

    async updatePartner(
      actor: PartnerActor,
      id: string,
      input: UpdatePartnerInput,
    ): Promise<PartnerRecord> {
      assertPartnerCapability(actor, "PARTNER_UPDATE");
      const before = await repo.getPartnerById(id);
      if (!before) throw new PartnersDomainError("NOT_FOUND", "Partner no encontrado.");
      if (before.status === "ARCHIVED") {
        throw new PartnersDomainError("INVALID_STATE", "El partner está archivado.");
      }
      const partner = await repo.updatePartner(id, {
        ...input,
        updatedByUserId: actor.userId,
      });
      await audit(actor, {
        partnerId: partner.id,
        entityType: "DnxPartner",
        entityId: partner.id,
        action: "partner.update",
        before: { status: before.status, name: before.name },
        after: { status: partner.status, name: partner.name },
      });
      return partner;
    },

    async archivePartner(actor: PartnerActor, id: string): Promise<PartnerRecord> {
      assertPartnerCapability(actor, "PARTNER_ARCHIVE");
      const before = await repo.getPartnerById(id);
      if (!before) throw new PartnersDomainError("NOT_FOUND", "Partner no encontrado.");
      const partner = await repo.archivePartner(id, actor.userId);
      await audit(actor, {
        partnerId: partner.id,
        entityType: "DnxPartner",
        entityId: partner.id,
        action: "partner.archive",
        before: { status: before.status },
        after: { status: partner.status, archivedAt: partner.archivedAt?.toISOString() ?? null },
      });
      return partner;
    },

    async listContacts(actor: PartnerActor, partnerId: string): Promise<PartnerContactRecord[]> {
      assertPartnerCapability(actor, "PARTNER_VIEW");
      return repo.listContacts(partnerId);
    },

    async createContact(
      actor: PartnerActor,
      input: CreateContactInput,
    ): Promise<PartnerContactRecord> {
      assertPartnerCapability(actor, "PARTNER_UPDATE");
      const partner = await repo.getPartnerById(input.partnerId);
      if (!partner) throw new PartnersDomainError("NOT_FOUND", "Partner no encontrado.");
      const firstName = input.firstName?.trim() ?? "";
      if (!firstName) {
        throw new PartnersDomainError("VALIDATION", "Nombre de contacto obligatorio.", {
          firstName: "Obligatorio.",
        });
      }
      const contact = await repo.createContact({ ...input, firstName });
      await audit(actor, {
        partnerId: partner.id,
        entityType: "DnxPartnerContact",
        entityId: contact.id,
        action: "contact.create",
      });
      return contact;
    },

    async listParticipations(
      actor: PartnerActor,
      partnerId: string,
    ): Promise<ParticipationRecord[]> {
      assertPartnerCapability(actor, "PARTNER_VIEW");
      return repo.listParticipations(partnerId);
    },

    async listParticipationsByContext(
      actor: PartnerActor,
      query: ListParticipationsByContextQuery,
    ): Promise<ParticipationRecord[]> {
      assertPartnerCapability(actor, "PARTNER_VIEW");
      return repo.listParticipationsByContext(query);
    },

    async createParticipation(
      actor: PartnerActor,
      input: CreateParticipationInput,
    ): Promise<{
      participation: ParticipationRecord;
      paymentSideEffects: ReturnType<typeof assertNoAutomaticPaymentSideEffects>;
    }> {
      assertPartnerCapability(actor, "PARTNER_PARTICIPATIONS_MANAGE");
      const partner = await repo.getPartnerById(input.partnerId);
      if (!partner) throw new PartnersDomainError("NOT_FOUND", "Partner no encontrado.");
      validateParticipationDates(input);
      const payment = normalizePaymentFields(input);
      if (payment.requiresPayment) {
        assertPartnerCapability(actor, "PARTNER_PAYMENTS_MANAGE");
      }

      const contextType = input.contextType ?? "GLOBAL";
      const contextId = input.contextId ?? null;
      const participationType = input.participationType ?? "SPONSOR";
      if (contextId && !input.allowDuplicateActive) {
        const existing = await repo.listParticipationsByContext({
          application: input.application,
          contextType,
          contextId,
          includeArchived: false,
        });
        const duplicate = existing.find(
          (p) =>
            p.partnerId === input.partnerId &&
            p.participationType === participationType &&
            !["CANCELLED", "ARCHIVED", "COMPLETED"].includes(p.status),
        );
        if (duplicate) {
          throw new PartnersDomainError(
            "CONFLICT",
            "Ya existe una participación activa similar para este partner y contexto. Confirmá la duplicación si corresponde.",
            { participation: "Duplicado activo. Usá allowDuplicateActive para confirmar." },
          );
        }
      }

      const participation = await repo.createParticipation({
        ...input,
        contextType,
        contextId,
        participationType,
        ...payment,
        createdByUserId: actor.userId,
      });
      const paymentSideEffects = assertNoAutomaticPaymentSideEffects(participation);
      await audit(actor, {
        partnerId: partner.id,
        entityType: "DnxPartnerParticipation",
        entityId: participation.id,
        action: "participation.create",
        summary:
          contextType === "EDITION" && contextId
            ? `Partner vinculado a edición ${contextId}`
            : undefined,
        after: {
          requiresPayment: participation.requiresPayment,
          paymentMode: participation.paymentMode,
          application: participation.application,
          contextType: participation.contextType,
          contextId: participation.contextId,
          ...paymentSideEffects,
        },
      });
      return { participation, paymentSideEffects };
    },

    async updateParticipation(
      actor: PartnerActor,
      id: string,
      input: UpdateParticipationInput,
    ): Promise<ParticipationRecord> {
      assertPartnerCapability(actor, "PARTNER_PARTICIPATIONS_MANAGE");
      const before = await repo.getParticipationById(id);
      if (!before) throw new PartnersDomainError("NOT_FOUND", "Participación no encontrada.");
      validateParticipationDates({
        startsAt: input.startsAt ?? before.startsAt,
        endsAt: input.endsAt ?? before.endsAt,
      });
      const payment = normalizePaymentFields({
        requiresPayment: input.requiresPayment ?? before.requiresPayment,
        paymentMode: input.paymentMode ?? before.paymentMode,
        paymentAmountMinor:
          input.paymentAmountMinor !== undefined
            ? input.paymentAmountMinor
            : before.paymentAmountMinor,
        paymentCurrency: input.paymentCurrency ?? before.paymentCurrency,
        paymentNotes: input.paymentNotes ?? before.paymentNotes,
      });
      if (payment.requiresPayment || before.requiresPayment) {
        assertPartnerCapability(actor, "PARTNER_PAYMENTS_MANAGE");
      }
      const participation = await repo.updateParticipation(id, {
        ...input,
        ...payment,
        updatedByUserId: actor.userId,
      });
      const statusAction =
        participation.status === "CONFIRMED" && before.status !== "CONFIRMED"
          ? "participation.confirm"
          : participation.status === "CANCELLED" && before.status !== "CANCELLED"
            ? "participation.cancel"
            : "participation.update";
      await audit(actor, {
        partnerId: before.partnerId,
        entityType: "DnxPartnerParticipation",
        entityId: id,
        action: statusAction,
        before: {
          status: before.status,
          requiresPayment: before.requiresPayment,
          paymentMode: before.paymentMode,
        },
        after: {
          status: participation.status,
          requiresPayment: participation.requiresPayment,
          paymentMode: participation.paymentMode,
        },
      });
      return participation;
    },

    async archiveParticipation(
      actor: PartnerActor,
      id: string,
    ): Promise<ParticipationRecord> {
      assertPartnerCapability(actor, "PARTNER_PARTICIPATIONS_MANAGE");
      const before = await repo.getParticipationById(id);
      if (!before) throw new PartnersDomainError("NOT_FOUND", "Participación no encontrada.");
      const participation = await repo.archiveParticipation(id, actor.userId);
      await audit(actor, {
        partnerId: before.partnerId,
        entityType: "DnxPartnerParticipation",
        entityId: id,
        action: "participation.archive",
      });
      return participation;
    },

    async listContributions(
      actor: PartnerActor,
      participationId: string,
    ): Promise<ContributionRecord[]> {
      assertPartnerCapability(actor, "PARTNER_VIEW");
      return repo.listContributions(participationId);
    },

    async createContribution(
      actor: PartnerActor,
      input: CreateContributionInput,
    ): Promise<ContributionRecord> {
      assertPartnerCapability(actor, "PARTNER_CONTRIBUTIONS_MANAGE");
      const participation = await repo.getParticipationById(input.participationId);
      if (!participation) {
        throw new PartnersDomainError("NOT_FOUND", "Participación no encontrada.");
      }
      const title = validateContributionInput(input);
      const contribution = await repo.createContribution({
        ...input,
        title,
        createdByUserId: actor.userId,
      });
      await audit(actor, {
        partnerId: participation.partnerId,
        entityType: "DnxPartnerContribution",
        entityId: contribution.id,
        action: "contribution.create",
        after: {
          type: contribution.type,
          title: contribution.title,
          hasEconomicValue: contribution.estimatedTotalValueMinor != null,
        },
      });
      return contribution;
    },

    async updateContribution(
      actor: PartnerActor,
      id: string,
      input: UpdateContributionInput,
    ): Promise<ContributionRecord> {
      assertPartnerCapability(actor, "PARTNER_CONTRIBUTIONS_MANAGE");
      const before = await repo.getContributionById(id);
      if (!before) throw new PartnersDomainError("NOT_FOUND", "Aporte no encontrado.");
      const participation = await repo.getParticipationById(before.participationId);
      const contribution = await repo.updateContribution(id, {
        ...input,
        updatedByUserId: actor.userId,
      });
      const delivered =
        contribution.status === "DELIVERED" && before.status !== "DELIVERED";
      await audit(actor, {
        partnerId: participation?.partnerId ?? null,
        entityType: "DnxPartnerContribution",
        entityId: id,
        action: delivered ? "contribution.deliver" : "contribution.update",
        before: { status: before.status },
        after: { status: contribution.status },
      });
      return contribution;
    },

    async markContributionDelivered(
      actor: PartnerActor,
      id: string,
    ): Promise<ContributionRecord> {
      return this.updateContribution(actor, id, {
        status: "DELIVERED",
        deliveredAt: new Date(),
      });
    },

    async linkContributionToPrize(
      actor: PartnerActor,
      contributionId: string,
      prizeBundleId: string,
    ): Promise<ContributionRecord> {
      assertPartnerCapability(actor, "PARTNER_CONTRIBUTIONS_MANAGE");
      const before = await repo.getContributionById(contributionId);
      if (!before) throw new PartnersDomainError("NOT_FOUND", "Aporte no encontrado.");
      const prizeId = prizeBundleId.trim();
      if (!prizeId) {
        throw new PartnersDomainError("VALIDATION", "Premio obligatorio.", {
          prizeBundleId: "Indicá el ID del premio Clickatón.",
        });
      }
      const contribution = await repo.updateContribution(contributionId, {
        prizeBundleId: prizeId,
        updatedByUserId: actor.userId,
      });
      const participation = await repo.getParticipationById(before.participationId);
      await audit(actor, {
        partnerId: participation?.partnerId ?? null,
        entityType: "DnxPartnerContribution",
        entityId: contributionId,
        action: "contribution.link_prize",
        before: { prizeBundleId: before.prizeBundleId },
        after: { prizeBundleId: contribution.prizeBundleId },
      });
      return contribution;
    },

    async listContributionsByPrizeBundle(
      actor: PartnerActor,
      prizeBundleId: string,
    ): Promise<ContributionRecord[]> {
      assertPartnerCapability(actor, "PARTNER_VIEW");
      return repo.listContributionsByPrizeBundleId(prizeBundleId);
    },

    async listBenefits(actor: PartnerActor, partnerId: string): Promise<BenefitRecord[]> {
      assertPartnerCapability(actor, "PARTNER_BENEFITS_VIEW");
      return repo.listBenefits(partnerId);
    },

    async createBenefit(actor: PartnerActor, input: CreateBenefitInput): Promise<BenefitRecord> {
      assertPartnerCapability(actor, "PARTNER_BENEFITS_MANAGE");
      const partner = await repo.getPartnerById(input.partnerId);
      if (!partner) throw new PartnersDomainError("NOT_FOUND", "Partner no encontrado.");
      if (input.participationId) {
        const participation = await repo.getParticipationById(input.participationId);
        if (!participation || participation.partnerId !== input.partnerId) {
          throw new PartnersDomainError("VALIDATION", "Participación inválida para el partner.", {
            participationId: "No pertenece al partner.",
          });
        }
      }
      validateBenefitFields(input);
      const title = input.title.trim();
      const status = input.status ?? "DRAFT";
      if (status === "ACTIVE") {
        validateBenefitFields(input, { activating: true });
        assertPartnerCapability(actor, "PARTNER_BENEFITS_PUBLISH");
      }
      const benefit = await repo.createBenefit({
        ...input,
        title,
        status,
        createdByUserId: actor.userId,
      });
      await audit(actor, {
        partnerId: partner.id,
        entityType: "DnxPartnerBenefit",
        entityId: benefit.id,
        action: "benefit.create",
        after: { status: benefit.status, benefitType: benefit.benefitType },
      });
      return benefit;
    },

    async updateBenefit(
      actor: PartnerActor,
      id: string,
      input: UpdateBenefitInput,
    ): Promise<BenefitRecord> {
      assertPartnerCapability(actor, "PARTNER_BENEFITS_MANAGE");
      const before = await repo.getBenefitById(id);
      if (!before) throw new PartnersDomainError("NOT_FOUND", "Beneficio no encontrado.");
      validateBenefitFields(input, {
        current: {
          title: before.title,
          description: before.description,
          redemptionMethod: before.redemptionMethod,
          endsAt: before.endsAt,
        },
      });
      const nextStatus = input.status ?? before.status;
      if (nextStatus === "ACTIVE" && before.status !== "ACTIVE") {
        validateBenefitFields(input, {
          activating: true,
          current: {
            title: before.title,
            description: before.description,
            redemptionMethod: before.redemptionMethod,
            endsAt: before.endsAt,
          },
        });
        assertPartnerCapability(actor, "PARTNER_BENEFITS_PUBLISH");
      }
      if (
        (nextStatus === "PAUSED" || nextStatus === "ACTIVE") &&
        before.status !== nextStatus
      ) {
        assertPartnerCapability(actor, "PARTNER_BENEFITS_PUBLISH");
      }
      const benefit = await repo.updateBenefit(id, {
        ...input,
        updatedByUserId: actor.userId,
      });
      await audit(actor, {
        partnerId: before.partnerId,
        entityType: "DnxPartnerBenefit",
        entityId: id,
        action:
          nextStatus === "ACTIVE" && before.status !== "ACTIVE"
            ? "benefit.activate"
            : nextStatus === "PAUSED" && before.status !== "PAUSED"
              ? "benefit.pause"
              : "benefit.update",
        before: { status: before.status },
        after: { status: benefit.status },
      });
      return benefit;
    },

    async activateBenefit(actor: PartnerActor, id: string): Promise<BenefitRecord> {
      return this.updateBenefit(actor, id, { status: "ACTIVE" });
    },

    async pauseBenefit(actor: PartnerActor, id: string): Promise<BenefitRecord> {
      return this.updateBenefit(actor, id, { status: "PAUSED" });
    },

    async archiveBenefit(actor: PartnerActor, id: string): Promise<BenefitRecord> {
      assertPartnerCapability(actor, "PARTNER_BENEFITS_MANAGE");
      const before = await repo.getBenefitById(id);
      if (!before) throw new PartnersDomainError("NOT_FOUND", "Beneficio no encontrado.");
      const benefit = await repo.archiveBenefit(id, actor.userId);
      await audit(actor, {
        partnerId: before.partnerId,
        entityType: "DnxPartnerBenefit",
        entityId: id,
        action: "benefit.archive",
      });
      return benefit;
    },

    async assignAudience(
      actor: PartnerActor,
      input: AssignAudienceInput,
    ): Promise<BenefitAudienceRecord> {
      assertPartnerCapability(actor, "PARTNER_BENEFITS_MANAGE");
      const benefit = await repo.getBenefitById(input.benefitId);
      if (!benefit) throw new PartnersDomainError("NOT_FOUND", "Beneficio no encontrado.");
      const audience = await repo.assignAudience(input);
      await audit(actor, {
        partnerId: benefit.partnerId,
        entityType: "DnxPartnerBenefitAudience",
        entityId: audience.id,
        action: "audience.assign",
        after: { audienceType: audience.audienceType },
      });
      return audience;
    },

    async listAudiences(
      actor: PartnerActor,
      benefitId: string,
    ): Promise<BenefitAudienceRecord[]> {
      assertPartnerCapability(actor, "PARTNER_BENEFITS_VIEW");
      return repo.listAudiences(benefitId);
    },

    async listBenefitsByParticipationIds(
      actor: PartnerActor,
      participationIds: string[],
    ): Promise<BenefitRecord[]> {
      assertPartnerCapability(actor, "PARTNER_BENEFITS_VIEW");
      if (participationIds.length === 0) return [];
      return repo.listBenefitsByParticipationIds(participationIds);
    },

    async listBenefitAccess(
      actor: PartnerActor,
      benefitId: string,
    ): Promise<BenefitAccessRecord[]> {
      assertPartnerCapability(actor, "PARTNER_BENEFITS_VIEW");
      return repo.listBenefitAccess(benefitId);
    },

    async grantBenefitAccess(
      actor: PartnerActor,
      input: GrantBenefitAccessInput,
    ): Promise<BenefitAccessRecord> {
      assertPartnerCapability(actor, "PARTNER_BENEFITS_GRANT");
      const benefit = await repo.getBenefitById(input.benefitId);
      if (!benefit) throw new PartnersDomainError("NOT_FOUND", "Beneficio no encontrado.");
      if (!Number.isInteger(input.userId) || input.userId <= 0) {
        throw new PartnersDomainError("VALIDATION", "Usuario inválido.", {
          userId: "Indicá un userId DNX válido.",
        });
      }
      const existing = await repo.getActiveBenefitAccess(input.benefitId, input.userId);
      if (existing) {
        throw new PartnersDomainError(
          "CONFLICT",
          "Ya existe un acceso activo para este usuario y beneficio.",
          { userId: "Acceso duplicado." },
        );
      }
      const access = await repo.upsertBenefitAccess({
        ...input,
        grantedByUserId: actor.userId,
      });
      await audit(actor, {
        partnerId: benefit.partnerId,
        entityType: "DnxPartnerBenefitAccess",
        entityId: access.id,
        action: "benefit_access.grant",
        after: { benefitId: access.benefitId, userId: access.userId, status: access.status },
      });
      return access;
    },

    async revokeBenefitAccess(
      actor: PartnerActor,
      benefitId: string,
      userId: number,
    ): Promise<BenefitAccessRecord> {
      assertPartnerCapability(actor, "PARTNER_BENEFITS_GRANT");
      const benefit = await repo.getBenefitById(benefitId);
      if (!benefit) throw new PartnersDomainError("NOT_FOUND", "Beneficio no encontrado.");
      const existing = await repo.getActiveBenefitAccess(benefitId, userId);
      if (!existing) {
        throw new PartnersDomainError("NOT_FOUND", "No hay acceso activo para revocar.");
      }
      const access = await repo.revokeBenefitAccess(benefitId, userId, actor.userId);
      await audit(actor, {
        partnerId: benefit.partnerId,
        entityType: "DnxPartnerBenefitAccess",
        entityId: access.id,
        action: "benefit_access.revoke",
        after: { benefitId, userId, status: access.status },
      });
      return access;
    },
  };
}
