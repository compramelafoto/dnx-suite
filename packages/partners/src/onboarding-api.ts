import { assertSafePartnerDestinationUrl } from "./tracking";
import {
  createPartnerOnboardingToken,
  hashPartnerOnboardingToken,
  resolveOnboardingExpiresInDays,
  shouldSkipOnboardingRateLimit,
} from "./onboarding-token";
import { resolveOnboardingAdminStatus } from "./onboarding-status";
import type {
  CreateOnboardingInvitationInput,
  CreateOnboardingInvitationResult,
  OnboardingInvitationRecord,
  PartnerOnboardingDraft,
  PartnerOnboardingSubmission,
  ReviewOnboardingInput,
} from "./onboarding-types";
import type { PartnersRepository } from "./repository";
import type { PartnerActor, PartnerRecord } from "./types";
import { PartnersDomainError } from "./types";
import { assertPartnerCapability } from "./permissions";

type AuditFn = (
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
) => Promise<void>;

const GENERIC_TOKEN_ERROR =
  "Este enlace no es válido o ya no está disponible. Solicitá uno nuevo a la organización.";

function sanitizeText(value: string | null | undefined, max = 2000): string | null {
  if (value == null) return null;
  const t = value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim();
  if (!t) return null;
  return t.slice(0, max);
}

function normalizeDraft(draft: PartnerOnboardingDraft): PartnerOnboardingDraft {
  const company = draft.company
    ? {
        name: sanitizeText(draft.company.name, 200) ?? undefined,
        legalName: sanitizeText(draft.company.legalName, 200),
        taxId: sanitizeText(draft.company.taxId, 40),
        description: sanitizeText(draft.company.description, 2000),
        websiteUrl: sanitizeText(draft.company.websiteUrl, 500),
        instagram: sanitizeText(draft.company.instagram, 200),
        facebookUrl: sanitizeText(draft.company.facebookUrl, 500),
        linkedinUrl: sanitizeText(draft.company.linkedinUrl, 500),
        address: sanitizeText(draft.company.address, 300),
        city: sanitizeText(draft.company.city, 120),
        provinceOrState: sanitizeText(draft.company.provinceOrState, 120),
        country: sanitizeText(draft.company.country, 120),
        postalCode: sanitizeText(draft.company.postalCode, 40),
        destinationKind: draft.company.destinationKind ?? null,
        destinationUrl: sanitizeText(draft.company.destinationUrl, 500),
        contributionNotes: sanitizeText(draft.company.contributionNotes, 2000),
        observations: sanitizeText(draft.company.observations, 2000),
      }
    : undefined;
  const contact = draft.contact
    ? {
        firstName: sanitizeText(draft.contact.firstName, 120) ?? undefined,
        lastName: sanitizeText(draft.contact.lastName, 120),
        roleTitle: sanitizeText(draft.contact.roleTitle, 120),
        email: sanitizeText(draft.contact.email, 200),
        phone: sanitizeText(draft.contact.phone, 80),
        whatsapp: sanitizeText(draft.contact.whatsapp, 80),
        emailIsPublic: draft.contact.emailIsPublic === true,
        phoneIsPublic: draft.contact.phoneIsPublic === true,
      }
    : undefined;
  return {
    company,
    contact,
    logos: draft.logos ?? [],
    consents: draft.consents,
    step: typeof draft.step === "number" ? draft.step : undefined,
  };
}

/** Vista admin/pública sin tokenHash (nunca exponer hash ni plaintext). */
export type PublicOnboardingInvitation = Omit<OnboardingInvitationRecord, "tokenHash">;

function publicSafeInvitation(inv: OnboardingInvitationRecord): PublicOnboardingInvitation {
  const { tokenHash: _omit, ...rest } = inv;
  void _omit;
  return rest;
}

async function markExpiredIfNeeded(
  repo: PartnersRepository,
  inv: OnboardingInvitationRecord,
  now: Date,
): Promise<OnboardingInvitationRecord> {
  if (
    (inv.status === "PENDING" || inv.status === "OPENED") &&
    inv.expiresAt.getTime() < now.getTime()
  ) {
    return repo.updateOnboardingInvitation(inv.id, {
      status: "EXPIRED",
    });
  }
  return inv;
}

export function createPartnerOnboardingApi(repo: PartnersRepository, audit: AuditFn) {
  const api = {
    resolveOnboardingAdminStatus,

    async createOnboardingInvitation(
      actor: PartnerActor,
      input: CreateOnboardingInvitationInput,
    ): Promise<CreateOnboardingInvitationResult> {
      assertPartnerCapability(actor, "PARTNER_UPDATE");
      const partner = await repo.getPartnerById(input.partnerId);
      if (!partner) throw new PartnersDomainError("NOT_FOUND", "Partner no encontrado.");

      if (input.participationId) {
        const part = await repo.getParticipationById(input.participationId);
        if (!part || part.partnerId !== input.partnerId) {
          throw new PartnersDomainError(
            "VALIDATION",
            "La participación no pertenece a este partner.",
            { participationId: "Inválida." },
          );
        }
      }

      const days = input.expiresInDays ?? resolveOnboardingExpiresInDays();
      const { rawToken, tokenHash } = createPartnerOnboardingToken();
      const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

      const invitation = await repo.createOnboardingInvitation({
        partnerId: input.partnerId,
        participationId: input.participationId ?? null,
        tokenHash,
        expiresAt,
        createdByUserId: input.createdByUserId ?? actor.userId,
      });

      await audit(actor, {
        partnerId: input.partnerId,
        entityType: "DnxPartnerOnboardingInvitation",
        entityId: invitation.id,
        action: "onboarding.invitation_created",
        after: {
          status: invitation.status,
          expiresAt: invitation.expiresAt.toISOString(),
          participationId: invitation.participationId,
        },
      });

      return { invitation: publicSafeInvitation(invitation), rawToken };
    },

    async listOnboardingInvitations(
      actor: PartnerActor,
      partnerId: string,
    ): Promise<PublicOnboardingInvitation[]> {
      assertPartnerCapability(actor, "PARTNER_VIEW");
      const rows = await repo.listOnboardingInvitationsByPartner(partnerId);
      return rows.map((r) => publicSafeInvitation(r));
    },

    async getOnboardingInvitationById(
      actor: PartnerActor,
      id: string,
    ): Promise<PublicOnboardingInvitation> {
      assertPartnerCapability(actor, "PARTNER_VIEW");
      const row = await repo.getOnboardingInvitationById(id);
      if (!row) throw new PartnersDomainError("NOT_FOUND", "Invitación no encontrada.");
      return publicSafeInvitation(row);
    },

    async revokeOnboardingInvitation(
      actor: PartnerActor,
      id: string,
    ): Promise<PublicOnboardingInvitation> {
      assertPartnerCapability(actor, "PARTNER_UPDATE");
      const before = await repo.getOnboardingInvitationById(id);
      if (!before) throw new PartnersDomainError("NOT_FOUND", "Invitación no encontrada.");
      if (before.status === "SUBMITTED") {
        throw new PartnersDomainError(
          "INVALID_STATE",
          "No se puede revocar una invitación ya enviada.",
        );
      }
      const invitation = await repo.updateOnboardingInvitation(id, {
        status: "REVOKED",
        revokedAt: new Date(),
      });
      await audit(actor, {
        partnerId: before.partnerId,
        entityType: "DnxPartnerOnboardingInvitation",
        entityId: id,
        action: "onboarding.invitation_revoked",
      });
      return publicSafeInvitation(invitation);
    },

    /**
     * Abre invitación por token. Errores genéricos (anti-enumeración).
     * No requiere actor admin.
     */
    async openOnboardingInvitation(rawToken: string): Promise<{
      invitation: PublicOnboardingInvitation;
      partner: Pick<PartnerRecord, "id" | "name" | "slug" | "status">;
      draft: PartnerOnboardingDraft | null;
    }> {
      if (shouldSkipOnboardingRateLimit(rawToken)) {
        throw new PartnersDomainError("FORBIDDEN", GENERIC_TOKEN_ERROR);
      }
      const hash = hashPartnerOnboardingToken(rawToken);
      let inv = await repo.getOnboardingInvitationByTokenHash(hash);
      if (!inv) {
        throw new PartnersDomainError("NOT_FOUND", GENERIC_TOKEN_ERROR);
      }
      const now = new Date();
      inv = await markExpiredIfNeeded(repo, inv, now);
      if (inv.status === "REVOKED" || inv.status === "EXPIRED") {
        throw new PartnersDomainError("INVALID_STATE", GENERIC_TOKEN_ERROR);
      }
      if (inv.status === "SUBMITTED") {
        // Permitir ver confirmación, no editar.
        const partner = await repo.getPartnerById(inv.partnerId);
        if (!partner) throw new PartnersDomainError("NOT_FOUND", GENERIC_TOKEN_ERROR);
        return {
          invitation: publicSafeInvitation(inv),
          partner: {
            id: partner.id,
            name: partner.name,
            slug: partner.slug,
            status: partner.status,
          },
          draft: inv.submissionJson ?? inv.draftJson,
        };
      }

      if (inv.status === "PENDING") {
        inv = await repo.updateOnboardingInvitation(inv.id, {
          status: "OPENED",
          openedAt: now,
        });
        await audit(
          { userId: 0, isOpsAdmin: true },
          {
            partnerId: inv.partnerId,
            entityType: "DnxPartnerOnboardingInvitation",
            entityId: inv.id,
            action: "onboarding.link_opened",
          },
        );
      }

      const partner = await repo.getPartnerById(inv.partnerId);
      if (!partner) throw new PartnersDomainError("NOT_FOUND", GENERIC_TOKEN_ERROR);

      return {
        invitation: publicSafeInvitation(inv),
        partner: {
          id: partner.id,
          name: partner.name,
          slug: partner.slug,
          status: partner.status,
        },
        draft: inv.draftJson,
      };
    },

    async saveOnboardingDraft(
      rawToken: string,
      draft: PartnerOnboardingDraft,
    ): Promise<PartnerOnboardingDraft> {
      if (shouldSkipOnboardingRateLimit(`draft:${rawToken}`)) {
        throw new PartnersDomainError("FORBIDDEN", GENERIC_TOKEN_ERROR);
      }
      const hash = hashPartnerOnboardingToken(rawToken);
      let inv = await repo.getOnboardingInvitationByTokenHash(hash);
      if (!inv) throw new PartnersDomainError("NOT_FOUND", GENERIC_TOKEN_ERROR);
      inv = await markExpiredIfNeeded(repo, inv, new Date());
      if (inv.status !== "PENDING" && inv.status !== "OPENED") {
        throw new PartnersDomainError("INVALID_STATE", GENERIC_TOKEN_ERROR);
      }
      const normalized = normalizeDraft(draft);
      await repo.updateOnboardingInvitation(inv.id, {
        draftJson: normalized,
        status: inv.status === "PENDING" ? "OPENED" : inv.status,
        openedAt: inv.openedAt ?? new Date(),
      });
      return normalized;
    },

    async submitOnboardingInvitation(
      rawToken: string,
      draft: PartnerOnboardingDraft,
    ): Promise<{ invitationId: string; reviewStatus: string }> {
      if (shouldSkipOnboardingRateLimit(`submit:${rawToken}`, 10, 60_000)) {
        throw new PartnersDomainError("FORBIDDEN", GENERIC_TOKEN_ERROR);
      }
      const hash = hashPartnerOnboardingToken(rawToken);
      let inv = await repo.getOnboardingInvitationByTokenHash(hash);
      if (!inv) throw new PartnersDomainError("NOT_FOUND", GENERIC_TOKEN_ERROR);
      inv = await markExpiredIfNeeded(repo, inv, new Date());

      if (inv.status === "SUBMITTED") {
        throw new PartnersDomainError(
          "INVALID_STATE",
          "Esta información ya fue enviada. El equipo organizador la está revisando.",
        );
      }
      if (inv.status === "REVOKED" || inv.status === "EXPIRED") {
        throw new PartnersDomainError("INVALID_STATE", GENERIC_TOKEN_ERROR);
      }

      const normalized = normalizeDraft(draft);
      if (!normalized.consents?.authority || !normalized.consents?.brandUsage) {
        throw new PartnersDomainError(
          "VALIDATION",
          "Debés aceptar las autorizaciones obligatorias.",
          { consents: "Obligatorios." },
        );
      }
      const companyName = normalized.company?.name?.trim();
      if (!companyName) {
        throw new PartnersDomainError("VALIDATION", "Nombre comercial obligatorio.", {
          name: "Obligatorio.",
        });
      }
      const contactName = normalized.contact?.firstName?.trim();
      if (!contactName) {
        throw new PartnersDomainError("VALIDATION", "Nombre de contacto obligatorio.", {
          firstName: "Obligatorio.",
        });
      }
      const hasRequiredLogo = (normalized.logos ?? []).some(
        (l) => l.type === "LOGO_GENERAL" || l.type === "LOGO_PRIMARY",
      );
      if (!hasRequiredLogo) {
        throw new PartnersDomainError(
          "VALIDATION",
          "El logo general (color) es obligatorio.",
          { logos: "Subí el logo general en color (PNG o WEBP)." },
        );
      }

      let destinationUrl = normalized.company?.destinationUrl ?? null;
      if (destinationUrl) {
        try {
          destinationUrl = assertSafePartnerDestinationUrl(destinationUrl);
        } catch {
          throw new PartnersDomainError("VALIDATION", "URL de destino inválida.", {
            destinationUrl: "Usá una URL https válida.",
          });
        }
      }

      const submission: PartnerOnboardingSubmission = {
        ...normalized,
        company: {
          ...normalized.company,
          name: companyName,
          destinationUrl,
        },
        submittedAt: new Date().toISOString(),
      };

      // Solo propuesta en invitation — no sobrescribe DnxPartner ni publica.
      // Assets ya están en DnxPartnerAsset (PENDING). Contacto/destino se aplican al aprobar.
      const partnerBefore = await repo.getPartnerById(inv.partnerId);
      if (!partnerBefore) throw new PartnersDomainError("NOT_FOUND", GENERIC_TOKEN_ERROR);

      const updated = await repo.updateOnboardingInvitation(inv.id, {
        status: "SUBMITTED",
        submittedAt: new Date(),
        draftJson: normalized,
        submissionJson: submission,
        reviewStatus: "PENDING_REVIEW",
      });

      await audit(
        { userId: 0, isOpsAdmin: true },
        {
          partnerId: inv.partnerId,
          entityType: "DnxPartnerOnboardingInvitation",
          entityId: inv.id,
          action: "onboarding.submitted",
          after: {
            reviewStatus: "PENDING_REVIEW",
            partnerStatusUnchanged: partnerBefore.status,
            appliedToPartner: false,
          },
        },
      );

      return {
        invitationId: updated.id,
        reviewStatus: updated.reviewStatus,
      };
    },

    async reviewOnboardingSubmission(
      actor: PartnerActor,
      input: ReviewOnboardingInput,
    ): Promise<PublicOnboardingInvitation> {
      assertPartnerCapability(actor, "PARTNER_UPDATE");
      const before = await repo.getOnboardingInvitationById(input.invitationId);
      if (!before) throw new PartnersDomainError("NOT_FOUND", "Invitación no encontrada.");
      if (before.status !== "SUBMITTED") {
        throw new PartnersDomainError(
          "INVALID_STATE",
          "Solo se revisan invitaciones con datos enviados.",
        );
      }

      const notes = sanitizeText(input.notes, 2000);
      let reviewStatus = before.reviewStatus;
      let action = "onboarding.review";

      if (input.action === "APPROVE_DATA") {
        reviewStatus = "APPROVED";
        action = "onboarding.data_approved";
        const apply = input.applyProposedData !== false;
        if (apply && before.submissionJson?.company) {
          const c = before.submissionJson.company;
          await repo.updatePartner(before.partnerId, {
            name: c.name?.trim() || undefined,
            legalName: c.legalName,
            taxId: c.taxId,
            description: c.description,
            websiteUrl: c.websiteUrl,
            instagram: c.instagram,
            facebookUrl: c.facebookUrl,
            linkedinUrl: c.linkedinUrl,
            address: c.address,
            city: c.city,
            provinceOrState: c.provinceOrState,
            country: c.country,
            postalCode: c.postalCode,
            updatedByUserId: actor.userId,
          });
          // NO cambia status comercial (PROSPECT/ACTIVE).
        }
        const approvedContactName = before.submissionJson?.contact?.firstName?.trim();
        if (apply && approvedContactName && before.submissionJson?.contact) {
          const ct = before.submissionJson.contact;
          await repo.createContact({
            partnerId: before.partnerId,
            firstName: approvedContactName,
            lastName: ct.lastName ?? null,
            roleTitle: ct.roleTitle ?? null,
            email: ct.email ?? null,
            phone: ct.phone ?? null,
            whatsapp: ct.whatsapp ?? null,
            emailIsPublic: ct.emailIsPublic === true,
            phoneIsPublic: ct.phoneIsPublic === true,
            isPrimary: true,
            notes: "Contacto aprobado desde onboarding público.",
          });
        }
        if (apply && before.participationId && before.submissionJson?.company?.destinationUrl) {
          const part = await repo.getParticipationById(before.participationId);
          if (part && part.partnerId === before.partnerId) {
            try {
              const dest = assertSafePartnerDestinationUrl(
                before.submissionJson.company.destinationUrl,
              );
              await repo.updateParticipation(part.id, { destinationUrl: dest });
            } catch {
              // destino inválido: no bloquea aprobación de otros datos
            }
          }
        }
      } else if (input.action === "APPROVE_LOGOS") {
        action = "onboarding.logos_approved";
        const ids =
          input.logoAssetIds?.length
            ? input.logoAssetIds
            : (before.submissionJson?.logos ?? []).map((l) => l.assetId);
        for (const assetId of ids) {
          const asset = await repo.getBrandAssetById(assetId);
          if (!asset || asset.partnerId !== before.partnerId) continue;
          await repo.updateBrandAsset(assetId, {
            approvalStatus: "APPROVED",
            status: asset.status === "DRAFT" ? "ACTIVE" : asset.status,
            approvedById: actor.userId,
            approvedAt: new Date(),
          });
        }
        // Mantener PENDING_REVIEW si datos aún no aprobados; si ya APPROVED, queda.
        if (before.reviewStatus === "PENDING_REVIEW") {
          reviewStatus = "PENDING_REVIEW";
        }
      } else if (input.action === "REQUEST_CHANGES") {
        reviewStatus = "CHANGES_REQUESTED";
        action = "onboarding.changes_requested";
      } else if (input.action === "REJECT") {
        reviewStatus = "REJECTED";
        action = "onboarding.rejected";
      }

      const updated = await repo.updateOnboardingInvitation(before.id, {
        reviewStatus,
        reviewNotes: notes,
        reviewedByUserId: actor.userId,
        reviewedAt: new Date(),
      });

      await audit(actor, {
        partnerId: before.partnerId,
        entityType: "DnxPartnerOnboardingInvitation",
        entityId: before.id,
        action,
        after: { reviewStatus, notes },
      });

      return publicSafeInvitation(updated);
    },

    /**
     * Resuelve partnerId autorizado por token para upload (anti cross-partner).
     */
    async resolvePartnerIdForOnboardingToken(rawToken: string): Promise<{
      partnerId: string;
      invitationId: string;
    }> {
      if (shouldSkipOnboardingRateLimit(`upload:${rawToken}`, 40, 60_000)) {
        throw new PartnersDomainError("FORBIDDEN", GENERIC_TOKEN_ERROR);
      }
      const hash = hashPartnerOnboardingToken(rawToken);
      let inv = await repo.getOnboardingInvitationByTokenHash(hash);
      if (!inv) throw new PartnersDomainError("NOT_FOUND", GENERIC_TOKEN_ERROR);
      inv = await markExpiredIfNeeded(repo, inv, new Date());
      if (inv.status !== "PENDING" && inv.status !== "OPENED") {
        throw new PartnersDomainError("INVALID_STATE", GENERIC_TOKEN_ERROR);
      }
      return { partnerId: inv.partnerId, invitationId: inv.id };
    },
  };

  return api;
}
