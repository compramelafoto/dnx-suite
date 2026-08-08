import { assertValidCtaUrl } from "./assets-mime";
import {
  findBestAssetForChannel,
  filterParticipationAssets,
  normalizePartnerLogoBackground,
  resolvePartnerDisplayImage,
  resolvePartnerLogoVariant,
  resolvePartnerPrimaryLogo,
} from "./assets-resolve";
import type {
  CreateBrandAssetInput,
  CreateParticipationAssetInput,
  DnxPartnerBrandAssetType,
  ListParticipationAssetsQuery,
  ParticipationAssetRecord,
  PartnerBrandAssetRecord,
  ResolvedPartnerImage,
  UpdateBrandAssetInput,
  UpdateParticipationAssetInput,
} from "./assets-types";
import {
  canReusePartnerLogoFamilyFromGeneral,
  partnerLogoFamilyReuseBackgrounds,
} from "./logo-reuse-general";
import { getPartnerLogoFamilyGuide, getPartnerLogoSlotGuide } from "./logo-types";
import { assertPartnerCapability } from "./permissions";
import type { PartnersRepository } from "./repository";
import { assertDateRange } from "./validate";
import {
  PartnersDomainError,
  type PartnerActor,
  type PartnerRecord,
} from "./types";

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

function requireName(name: string | undefined, label: string): string {
  const n = name?.trim() ?? "";
  if (!n) {
    throw new PartnersDomainError("VALIDATION", `${label} obligatorio.`, {
      name: "Obligatorio.",
    });
  }
  return n;
}

export function createPartnerAssetsApi(repo: PartnersRepository, audit: AuditFn) {
  async function requirePartner(partnerId: string): Promise<PartnerRecord> {
    const partner = await repo.getPartnerById(partnerId);
    if (!partner) throw new PartnersDomainError("NOT_FOUND", "Partner no encontrado.");
    return partner;
  }

  const api = {
    async listPartnerAssets(
      actor: PartnerActor,
      partnerId: string,
    ): Promise<PartnerBrandAssetRecord[]> {
      assertPartnerCapability(actor, "PARTNER_ASSETS_VIEW");
      await requirePartner(partnerId);
      return repo.listBrandAssets(partnerId);
    },

    async createPartnerAsset(
      actor: PartnerActor,
      input: CreateBrandAssetInput,
    ): Promise<PartnerBrandAssetRecord> {
      assertPartnerCapability(actor, "PARTNER_ASSETS_UPLOAD");
      assertPartnerCapability(actor, "PARTNER_ASSETS_MANAGE_BRAND");
      await requirePartner(input.partnerId);
      const name = requireName(input.name, "Nombre");
      if (!input.storageKey && !input.fileUrl) {
        throw new PartnersDomainError(
          "VALIDATION",
          "El asset debe tener storageKey o fileUrl confirmado.",
          { storageKey: "Upload no finalizado." },
        );
      }
      if (input.isPrimary) {
        if ((input.status ?? "DRAFT") === "ARCHIVED") {
          throw new PartnersDomainError("INVALID_STATE", "Un asset archivado no puede ser principal.");
        }
        await repo.clearPrimaryBrandAssets(input.partnerId);
      }
      const asset = await repo.createBrandAsset({
        ...input,
        name,
        uploadedById: actor.userId,
      });
      await audit(actor, {
        partnerId: input.partnerId,
        entityType: "DnxPartnerAsset",
        entityId: asset.id,
        action: "asset.create",
        after: { type: asset.type, status: asset.status, approvalStatus: asset.approvalStatus },
      });
      return asset;
    },

    async updatePartnerAsset(
      actor: PartnerActor,
      id: string,
      input: UpdateBrandAssetInput,
    ): Promise<PartnerBrandAssetRecord> {
      assertPartnerCapability(actor, "PARTNER_ASSETS_UPDATE");
      const before = await repo.getBrandAssetById(id);
      if (!before) throw new PartnersDomainError("NOT_FOUND", "Asset no encontrado.");
      if (input.isPrimary) {
        assertPartnerCapability(actor, "PARTNER_ASSETS_MANAGE_BRAND");
        if ((input.status ?? before.status) === "ARCHIVED" || before.archivedAt) {
          throw new PartnersDomainError("INVALID_STATE", "Un asset archivado no puede ser principal.");
        }
        await repo.clearPrimaryBrandAssets(before.partnerId, id);
      }
      const asset = await repo.updateBrandAsset(id, input);
      await audit(actor, {
        partnerId: before.partnerId,
        entityType: "DnxPartnerAsset",
        entityId: id,
        action: input.isPrimary ? "asset.set_primary" : "asset.update",
        before: { status: before.status, isPrimary: before.isPrimary },
        after: { status: asset.status, isPrimary: asset.isPrimary },
      });
      return asset;
    },

    async setPrimaryPartnerAsset(
      actor: PartnerActor,
      id: string,
    ): Promise<PartnerBrandAssetRecord> {
      return api.updatePartnerAsset(actor, id, { isPrimary: true });
    },

    async approvePartnerAsset(
      actor: PartnerActor,
      id: string,
    ): Promise<PartnerBrandAssetRecord> {
      assertPartnerCapability(actor, "PARTNER_ASSETS_APPROVE");
      const before = await repo.getBrandAssetById(id);
      if (!before) throw new PartnersDomainError("NOT_FOUND", "Asset no encontrado.");
      const asset = await repo.updateBrandAsset(id, {
        approvalStatus: "APPROVED",
        status: before.status === "DRAFT" ? "ACTIVE" : before.status,
        approvedById: actor.userId,
        approvedAt: new Date(),
      });
      await audit(actor, {
        partnerId: before.partnerId,
        entityType: "DnxPartnerAsset",
        entityId: id,
        action: "asset.approve",
        after: { approvalStatus: asset.approvalStatus, status: asset.status },
      });
      return asset;
    },

    async rejectPartnerAsset(
      actor: PartnerActor,
      id: string,
      notes?: string | null,
    ): Promise<PartnerBrandAssetRecord> {
      assertPartnerCapability(actor, "PARTNER_ASSETS_APPROVE");
      const before = await repo.getBrandAssetById(id);
      if (!before) throw new PartnersDomainError("NOT_FOUND", "Asset no encontrado.");
      const asset = await repo.updateBrandAsset(id, {
        approvalStatus: "REJECTED",
        isPrimary: false,
        approvedById: actor.userId,
        approvedAt: new Date(),
      });
      await audit(actor, {
        partnerId: before.partnerId,
        entityType: "DnxPartnerAsset",
        entityId: id,
        action: "asset.reject",
      });
      return asset;
    },

    async requestPartnerAssetChanges(
      actor: PartnerActor,
      id: string,
      notes?: string | null,
    ): Promise<PartnerBrandAssetRecord> {
      assertPartnerCapability(actor, "PARTNER_ASSETS_APPROVE");
      const before = await repo.getBrandAssetById(id);
      if (!before) throw new PartnersDomainError("NOT_FOUND", "Asset no encontrado.");
      const asset = await repo.updateBrandAsset(id, {
        approvalStatus: "CHANGES_REQUESTED",
      });
      await audit(actor, {
        partnerId: before.partnerId,
        entityType: "DnxPartnerAsset",
        entityId: id,
        action: "asset.request_changes",
      });
      return asset;
    },

    async archivePartnerAsset(
      actor: PartnerActor,
      id: string,
    ): Promise<PartnerBrandAssetRecord> {
      assertPartnerCapability(actor, "PARTNER_ASSETS_ARCHIVE");
      const before = await repo.getBrandAssetById(id);
      if (!before) throw new PartnersDomainError("NOT_FOUND", "Asset no encontrado.");
      const asset = await repo.updateBrandAsset(id, {
        status: "ARCHIVED",
        isPrimary: false,
        archivedAt: new Date(),
      });
      await audit(actor, {
        partnerId: before.partnerId,
        entityType: "DnxPartnerAsset",
        entityId: id,
        action: "asset.archive",
      });
      return asset;
    },

    /**
     * Copia Logo general (COLOR/LIGHT/DARK) a otra familia, reutilizando storageKey/fileUrl.
     * Si enabled=false, archiva assets de esa familia marcados como reusedFromGeneral.
     */
    async reusePartnerLogoFamilyFromGeneral(
      actor: PartnerActor,
      input: {
        partnerId: string;
        targetType: DnxPartnerBrandAssetType;
        enabled: boolean;
      },
    ): Promise<PartnerBrandAssetRecord[]> {
      assertPartnerCapability(actor, "PARTNER_ASSETS_UPLOAD");
      assertPartnerCapability(actor, "PARTNER_ASSETS_MANAGE_BRAND");
      await requirePartner(input.partnerId);
      if (!canReusePartnerLogoFamilyFromGeneral(input.targetType)) {
        throw new PartnersDomainError(
          "VALIDATION",
          "Esta familia de logo no puede reutilizar Logo general.",
          { type: input.targetType },
        );
      }

      const all = await repo.listBrandAssets(input.partnerId);
      const active = all.filter((a) => !a.archivedAt && a.status !== "ARCHIVED");

      if (!input.enabled) {
        const toArchive = active.filter((a) => {
          if (a.type !== input.targetType) return false;
          const meta = a.metadata ?? {};
          return meta.reusedFromGeneral === true;
        });
        const out: PartnerBrandAssetRecord[] = [];
        for (const asset of toArchive) {
          out.push(await api.archivePartnerAsset(actor, asset.id));
        }
        return out;
      }

      const backgrounds = partnerLogoFamilyReuseBackgrounds(input.targetType);
      const generalByBg = new Map<
        ReturnType<typeof normalizePartnerLogoBackground>,
        PartnerBrandAssetRecord
      >();
      for (const a of active) {
        if (a.type !== "LOGO_GENERAL") continue;
        generalByBg.set(normalizePartnerLogoBackground(a.backgroundType), a);
      }

      if (![...generalByBg.values()].some((a) => a.fileUrl || a.storageKey)) {
        throw new PartnersDomainError(
          "VALIDATION",
          "Primero subí al menos un archivo en Logo general.",
          { logos: "Falta Logo general." },
        );
      }

      const family = getPartnerLogoFamilyGuide(input.targetType);
      const created: PartnerBrandAssetRecord[] = [];
      for (const backgroundType of backgrounds) {
        const source = generalByBg.get(backgroundType);
        if (!source || (!source.fileUrl && !source.storageKey)) continue;

        // Archivar slots previos de la familia (propios o reutilizados) para ese fondo.
        for (const prev of active) {
          if (prev.type !== input.targetType) continue;
          if (normalizePartnerLogoBackground(prev.backgroundType) !== backgroundType) continue;
          await api.archivePartnerAsset(actor, prev.id);
        }

        const slotGuide = getPartnerLogoSlotGuide(input.targetType, backgroundType);
        const assetName =
          family && slotGuide
            ? `${family.title} · ${slotGuide.title}`
            : `${input.targetType}:${backgroundType}`;

        created.push(
          await api.createPartnerAsset(actor, {
            partnerId: input.partnerId,
            type: input.targetType,
            name: assetName,
            storageProvider: source.storageProvider,
            storageKey: source.storageKey,
            fileUrl: source.fileUrl,
            originalFilename: source.originalFilename,
            mimeType: source.mimeType,
            fileExtension: source.fileExtension,
            fileSize: source.fileSize,
            width: source.width,
            height: source.height,
            backgroundType,
            isPrimary: false,
            status: source.status === "ACTIVE" ? "ACTIVE" : "DRAFT",
            approvalStatus: source.approvalStatus,
            altText: source.altText,
            notes: "Reutilizado desde Logo general",
            metadata: {
              ...(source.metadata ?? {}),
              reusedFromGeneral: true,
              sourceAssetId: source.id,
              sourceType: "LOGO_GENERAL",
            },
          }),
        );
      }

      if (created.length === 0) {
        throw new PartnersDomainError(
          "VALIDATION",
          "No hay archivos en Logo general para copiar a esta sección.",
          { logos: "Subí Logo general primero." },
        );
      }

      await audit(actor, {
        partnerId: input.partnerId,
        entityType: "DnxPartnerAsset",
        entityId: input.partnerId,
        action: "asset.reuse_from_general",
        after: { targetType: input.targetType, count: created.length },
      });

      return created;
    },

    async resolvePartnerPrimaryLogo(
      actor: PartnerActor,
      partnerId: string,
    ): Promise<ResolvedPartnerImage> {
      assertPartnerCapability(actor, "PARTNER_ASSETS_VIEW");
      const partner = await requirePartner(partnerId);
      const assets = await repo.listBrandAssets(partnerId);
      return resolvePartnerPrimaryLogo({ assets, logoUrl: partner.logoUrl });
    },

    async resolvePartnerLogoVariant(
      actor: PartnerActor,
      partnerId: string,
      type: DnxPartnerBrandAssetType,
    ): Promise<ResolvedPartnerImage> {
      assertPartnerCapability(actor, "PARTNER_ASSETS_VIEW");
      const partner = await requirePartner(partnerId);
      const assets = await repo.listBrandAssets(partnerId);
      return resolvePartnerLogoVariant({ assets, type, logoUrl: partner.logoUrl });
    },

    async resolvePartnerDisplayImage(
      actor: PartnerActor,
      partnerId: string,
    ): Promise<ResolvedPartnerImage> {
      assertPartnerCapability(actor, "PARTNER_ASSETS_VIEW");
      const partner = await requirePartner(partnerId);
      const assets = await repo.listBrandAssets(partnerId);
      return resolvePartnerDisplayImage({ assets, logoUrl: partner.logoUrl });
    },

    async createParticipationAsset(
      actor: PartnerActor,
      input: CreateParticipationAssetInput,
      opts?: {
        partnerIdForPrizeCheck?: string;
        editionIdForPrize?: string | null;
        prizeEditionId?: string | null;
      },
    ): Promise<ParticipationAssetRecord> {
      assertPartnerCapability(actor, "PARTNER_ASSETS_UPLOAD");
      assertPartnerCapability(actor, "PARTNER_ASSETS_MANAGE_PARTICIPATION");
      const participation = await repo.getParticipationById(input.participationId);
      if (!participation) {
        throw new PartnersDomainError("NOT_FOUND", "Participación no encontrada.");
      }
      if (!input.storageKey && !input.fileUrl) {
        throw new PartnersDomainError("VALIDATION", "Upload no finalizado.", {
          storageKey: "Confirmá el archivo antes de registrar.",
        });
      }
      assertDateRange(input.startsAt ?? null, input.endsAt ?? null);
      assertValidCtaUrl(input.ctaUrl);

      if (input.benefitId) {
        const benefit = await repo.getBenefitById(input.benefitId);
        if (!benefit || benefit.partnerId !== participation.partnerId) {
          throw new PartnersDomainError("VALIDATION", "Beneficio inválido para el partner.", {
            benefitId: "Debe pertenecer al mismo partner.",
          });
        }
      }
      if (input.contributionId) {
        const contribution = await repo.getContributionById(input.contributionId);
        if (!contribution || contribution.participationId !== input.participationId) {
          throw new PartnersDomainError("VALIDATION", "Aporte inválido.", {
            contributionId: "Debe pertenecer a la participación.",
          });
        }
      }
      if (input.prizeBundleId && opts?.editionIdForPrize && opts.prizeEditionId) {
        if (opts.prizeEditionId !== opts.editionIdForPrize) {
          throw new PartnersDomainError("VALIDATION", "El premio pertenece a otra edición.", {
            prizeBundleId: "Edición incorrecta.",
          });
        }
      }

      const asset = await repo.createParticipationAsset({
        ...input,
        name: requireName(input.name, "Nombre"),
        uploadedById: actor.userId,
      });
      await audit(actor, {
        partnerId: participation.partnerId,
        entityType: "DnxPartnerParticipationAsset",
        entityId: asset.id,
        action: "participation_asset.create",
        after: {
          channel: asset.channel,
          assetType: asset.assetType,
          benefitId: asset.benefitId,
          contributionId: asset.contributionId,
          prizeBundleId: asset.prizeBundleId,
        },
      });
      return asset;
    },

    async updateParticipationAsset(
      actor: PartnerActor,
      id: string,
      input: UpdateParticipationAssetInput,
    ): Promise<ParticipationAssetRecord> {
      assertPartnerCapability(actor, "PARTNER_ASSETS_UPDATE");
      const before = await repo.getParticipationAssetById(id);
      if (!before) throw new PartnersDomainError("NOT_FOUND", "Material no encontrado.");
      assertDateRange(
        input.startsAt !== undefined ? input.startsAt : before.startsAt,
        input.endsAt !== undefined ? input.endsAt : before.endsAt,
      );
      if (input.ctaUrl !== undefined) assertValidCtaUrl(input.ctaUrl);
      const participation = await repo.getParticipationById(before.participationId);
      const asset = await repo.updateParticipationAsset(id, input);
      await audit(actor, {
        partnerId: participation?.partnerId ?? null,
        entityType: "DnxPartnerParticipationAsset",
        entityId: id,
        action: "participation_asset.update",
        before: {
          channel: before.channel,
          application: before.application,
          startsAt: before.startsAt?.toISOString() ?? null,
          endsAt: before.endsAt?.toISOString() ?? null,
        },
        after: {
          channel: asset.channel,
          application: asset.application,
          benefitId: asset.benefitId,
          contributionId: asset.contributionId,
          prizeBundleId: asset.prizeBundleId,
          ctaUrl: asset.ctaUrl ? "[redacted-present]" : null,
        },
      });
      return asset;
    },

    async approveParticipationAsset(actor: PartnerActor, id: string) {
      assertPartnerCapability(actor, "PARTNER_ASSETS_APPROVE");
      const before = await repo.getParticipationAssetById(id);
      if (!before) throw new PartnersDomainError("NOT_FOUND", "Material no encontrado.");
      const participation = await repo.getParticipationById(before.participationId);
      const asset = await repo.updateParticipationAsset(id, {
        approvalStatus: "APPROVED",
        status: before.status === "DRAFT" ? "ACTIVE" : before.status,
        approvedById: actor.userId,
        approvedAt: new Date(),
      });
      await audit(actor, {
        partnerId: participation?.partnerId ?? null,
        entityType: "DnxPartnerParticipationAsset",
        entityId: id,
        action: "participation_asset.approve",
      });
      return asset;
    },

    async rejectParticipationAsset(actor: PartnerActor, id: string, notes?: string | null) {
      assertPartnerCapability(actor, "PARTNER_ASSETS_APPROVE");
      const before = await repo.getParticipationAssetById(id);
      if (!before) throw new PartnersDomainError("NOT_FOUND", "Material no encontrado.");
      const participation = await repo.getParticipationById(before.participationId);
      const asset = await repo.updateParticipationAsset(id, {
        approvalStatus: "REJECTED",
        approvedById: actor.userId,
        approvedAt: new Date(),
      });
      await audit(actor, {
        partnerId: participation?.partnerId ?? null,
        entityType: "DnxPartnerParticipationAsset",
        entityId: id,
        action: "participation_asset.reject",
      });
      return asset;
    },

    async requestParticipationAssetChanges(
      actor: PartnerActor,
      id: string,
      notes?: string | null,
    ) {
      assertPartnerCapability(actor, "PARTNER_ASSETS_APPROVE");
      const before = await repo.getParticipationAssetById(id);
      if (!before) throw new PartnersDomainError("NOT_FOUND", "Material no encontrado.");
      const participation = await repo.getParticipationById(before.participationId);
      const asset = await repo.updateParticipationAsset(id, {
        approvalStatus: "CHANGES_REQUESTED",
        description: notes ?? before.description,
      });
      await audit(actor, {
        partnerId: participation?.partnerId ?? null,
        entityType: "DnxPartnerParticipationAsset",
        entityId: id,
        action: "participation_asset.request_changes",
      });
      return asset;
    },

    async archiveParticipationAsset(actor: PartnerActor, id: string) {
      assertPartnerCapability(actor, "PARTNER_ASSETS_ARCHIVE");
      const before = await repo.getParticipationAssetById(id);
      if (!before) throw new PartnersDomainError("NOT_FOUND", "Material no encontrado.");
      const participation = await repo.getParticipationById(before.participationId);
      const asset = await repo.updateParticipationAsset(id, {
        status: "ARCHIVED",
        archivedAt: new Date(),
      });
      await audit(actor, {
        partnerId: participation?.partnerId ?? null,
        entityType: "DnxPartnerParticipationAsset",
        entityId: id,
        action: "participation_asset.archive",
      });
      return asset;
    },

    async listParticipationAssets(
      actor: PartnerActor,
      query: ListParticipationAssetsQuery,
    ): Promise<ParticipationAssetRecord[]> {
      assertPartnerCapability(actor, "PARTNER_ASSETS_VIEW");
      const rows = await repo.listParticipationAssets({
        ...query,
        includeArchived: true,
      });
      return filterParticipationAssets(rows, {
        ...query,
        adminList: query.adminList ?? true,
        includeArchived: query.includeArchived ?? true,
        includeRejected: query.includeRejected ?? true,
        includeExpired: query.includeExpired ?? true,
      });
    },

    async findAssetsForApplication(
      actor: PartnerActor,
      participationId: string,
      application: ParticipationAssetRecord["application"],
    ) {
      return api.listParticipationAssets(actor, { participationId, application });
    },

    async findAssetsForChannel(
      actor: PartnerActor,
      participationId: string,
      channel: ParticipationAssetRecord["channel"],
    ) {
      return api.listParticipationAssets(actor, { participationId, channel });
    },

    async findActiveBenefitAssets(actor: PartnerActor, benefitId: string) {
      return api.listParticipationAssets(actor, { benefitId });
    },

    async findActivePrizeAssets(actor: PartnerActor, prizeBundleId: string) {
      return api.listParticipationAssets(actor, { prizeBundleId });
    },

    async findBestAssetForChannel(
      actor: PartnerActor,
      input: {
        participationId: string;
        application?: ParticipationAssetRecord["application"];
        channel: ParticipationAssetRecord["channel"];
        assetType?: ParticipationAssetRecord["assetType"];
      },
    ) {
      assertPartnerCapability(actor, "PARTNER_ASSETS_VIEW");
      const rows = await repo.listParticipationAssets({
        participationId: input.participationId,
        includeArchived: true,
        includeExpired: true,
        includeRejected: true,
      });
      return findBestAssetForChannel(rows, input);
    },
  };

  return api;
}

export type PartnerAssetsApi = ReturnType<typeof createPartnerAssetsApi>;
