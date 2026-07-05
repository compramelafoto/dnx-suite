import { prisma } from "@/lib/prisma";
import type {
  AlbumMode,
  BenefitDefinition,
  BenefitSelectionMode,
  BenefitTemplatePolicy,
  PackBenefitKind,
  PackDefinition,
  Prisma,
} from "@/lib/prisma";
import {
  resolvePackAvailabilityPhase,
  type PackAvailabilityPhase,
} from "@/lib/preventa-canjeable/pack-availability-phase";
import {
  PackActivationError,
  assertPackHasBenefitsForActivation,
} from "@/lib/preventa-canjeable/pack-activation";

export type { PackAvailabilityPhase };

export async function listPackDefinitionsByAlbum(
  albumId: number,
  opts?: { includeInactive?: boolean }
) {
  return prisma.packDefinition.findMany({
    where: {
      albumId,
      ...(opts?.includeInactive ? {} : { isActive: true }),
    },
    orderBy: [{ displayOrder: "asc" }, { id: "asc" }],
    include: { benefits: { orderBy: { sortOrder: "asc" } } },
  });
}

/** Packs activos con beneficios y nombres de producto/plantilla (textos públicos / términos). */
type AvailabilityFilterOpts = {
  hasPhotos?: boolean;
};

function buildAvailabilityWhere(hasPhotos?: boolean): Prisma.PackDefinitionWhereInput {
  if (hasPhotos == null) {
    return { availabilityPhase: null };
  }
  return {
    OR: [
      { availabilityPhase: null },
      { availabilityPhase: hasPhotos ? "POST_UPLOAD" : "PRE_UPLOAD" },
    ],
  };
}

async function resolveHasPhotos(albumId: number): Promise<boolean> {
  const count = await prisma.photo.count({
    where: { albumId, isRemoved: false },
  });
  return count > 0;
}

export type PublicTermsPackRow = PackDefinition & {
  benefits: Array<
    BenefitDefinition & {
      photographerProduct: { name: string; size: string | null } | null;
      template: { name: string } | null;
    }
  >;
};

export async function listActivePackDefinitionsWithBenefitsForPublicTerms(
  albumId: number,
  opts?: AvailabilityFilterOpts
): Promise<PublicTermsPackRow[]> {
  const hasPhotos = opts?.hasPhotos ?? (await resolveHasPhotos(albumId));
  return prisma.packDefinition.findMany({
    where: {
      albumId,
      isActive: true,
      ...buildAvailabilityWhere(hasPhotos),
    },
    orderBy: [{ displayOrder: "asc" }, { id: "asc" }],
    include: {
      benefits: {
        orderBy: { sortOrder: "asc" },
        include: {
          photographerProduct: { select: { name: true, size: true } },
          template: { select: { name: true } },
        },
      },
    },
  }) as Promise<PublicTermsPackRow[]>;
}

/** Packs visibles en catálogo público de preventa (activos y dentro de ventana validFrom/validUntil). */
export type PublicCatalogPackRow = {
  id: number;
  name: string;
  description: string | null;
  priceClientArs: number;
  validFrom: Date | null;
  validUntil: Date | null;
  redemptionDeadlineAt: Date | null;
  coverImageUrl: string | null;
  benefits: Array<{
    kind: PackBenefitKind;
    includedQuantity: number;
    selectionMode: BenefitSelectionMode;
    requiredPhotoCount: number;
    extraUnitPriceOverrideArs: number | null;
    photographerProduct: { name: string } | null;
  }>;
};

export async function listActivePacksForPublicCatalog(
  albumId: number,
  at: Date = new Date(),
  opts?: AvailabilityFilterOpts
): Promise<PublicCatalogPackRow[]> {
  const hasPhotos = opts?.hasPhotos ?? (await resolveHasPhotos(albumId));
  return prisma.packDefinition.findMany({
    where: {
      albumId,
      isActive: true,
      ...buildAvailabilityWhere(hasPhotos),
      AND: [
        { OR: [{ validFrom: null }, { validFrom: { lte: at } }] },
        { OR: [{ validUntil: null }, { validUntil: { gte: at } }] },
      ],
    },
    orderBy: [{ displayOrder: "asc" }, { id: "asc" }],
    select: {
      id: true,
      name: true,
      description: true,
      priceClientArs: true,
      validFrom: true,
      validUntil: true,
      redemptionDeadlineAt: true,
      coverImageUrl: true,
      benefits: {
        orderBy: { sortOrder: "asc" },
        select: {
          kind: true,
          includedQuantity: true,
          selectionMode: true,
          requiredPhotoCount: true,
          extraUnitPriceOverrideArs: true,
          photographerProduct: { select: { name: true } },
        },
      },
    },
  });
}

export type UpsellPackRow = {
  id: number;
  name: string;
  priceClientArs: number;
  benefits: Array<{
    kind: PackBenefitKind;
    extraUnitPriceOverrideArs: number | null;
  }>;
};

export async function listUpsellPacksForAlbum(
  albumId: number,
  at: Date = new Date(),
  opts?: { hasPhotos?: boolean; excludePackId?: number | null; allowedPackIds?: number[] }
): Promise<UpsellPackRow[]> {
  const hasPhotos = opts?.hasPhotos ?? (await resolveHasPhotos(albumId));
  if (!hasPhotos) return [];
  if (opts?.allowedPackIds && opts.allowedPackIds.length === 0) return [];
  return prisma.packDefinition.findMany({
    where: {
      albumId,
      isActive: true,
      availabilityPhase: "POST_UPLOAD",
      ...(opts?.allowedPackIds ? { id: { in: opts.allowedPackIds } } : {}),
      ...(opts?.excludePackId ? { id: { not: opts.excludePackId } } : {}),
      AND: [
        { OR: [{ validFrom: null }, { validFrom: { lte: at } }] },
        { OR: [{ validUntil: null }, { validUntil: { gte: at } }] },
      ],
    },
    orderBy: [{ displayOrder: "asc" }, { id: "asc" }],
    select: {
      id: true,
      name: true,
      priceClientArs: true,
      benefits: {
        select: {
          kind: true,
          extraUnitPriceOverrideArs: true,
        },
      },
    },
  });
}

export async function packBelongsToAlbum(packId: number, albumId: number): Promise<boolean> {
  const row = await prisma.packDefinition.findFirst({
    where: { id: packId, albumId },
    select: { id: true },
  });
  return !!row;
}

export async function listBenefitsForPack(packDefinitionId: number, albumId: number) {
  const ok = await packBelongsToAlbum(packDefinitionId, albumId);
  if (!ok) return null;
  return prisma.benefitDefinition.findMany({
    where: { packDefinitionId },
    orderBy: { sortOrder: "asc" },
  });
}

export async function getNextDisplayOrderForAlbum(albumId: number): Promise<number> {
  const agg = await prisma.packDefinition.aggregate({
    where: { albumId },
    _max: { displayOrder: true },
  });
  return (agg._max.displayOrder ?? -1) + 1;
}

export async function getNextSortOrderForPack(packDefinitionId: number): Promise<number> {
  const agg = await prisma.benefitDefinition.aggregate({
    where: { packDefinitionId },
    _max: { sortOrder: true },
  });
  return (agg._max.sortOrder ?? -1) + 1;
}

/** `orderedPackIds` debe ser una permutación exacta de los ids de packs del álbum. */
export async function reorderPackDefinitionsInAlbum(
  albumId: number,
  orderedPackIds: number[]
): Promise<void> {
  const rows = await prisma.packDefinition.findMany({
    where: { albumId },
    select: { id: true },
  });
  if (rows.length !== orderedPackIds.length) {
    throw new Error("La lista de packs no coincide con el álbum");
  }
  const set = new Set(rows.map((r) => r.id));
  for (const id of orderedPackIds) {
    if (!set.has(id)) {
      throw new Error("ID de pack inválido para este álbum");
    }
  }
  await prisma.$transaction(
    orderedPackIds.map((id, index) =>
      prisma.packDefinition.update({
        where: { id },
        data: { displayOrder: index },
      })
    )
  );
}

/** `orderedBenefitIds` debe ser una permutación exacta de los beneficios del pack. */
export async function reorderBenefitDefinitionsInPack(
  packId: number,
  albumId: number,
  orderedBenefitIds: number[]
): Promise<void> {
  const ok = await packBelongsToAlbum(packId, albumId);
  if (!ok) throw new Error("Pack no encontrado");
  const rows = await prisma.benefitDefinition.findMany({
    where: { packDefinitionId: packId },
    select: { id: true },
  });
  if (rows.length !== orderedBenefitIds.length) {
    throw new Error("La lista de beneficios no coincide con el pack");
  }
  const set = new Set(rows.map((r) => r.id));
  for (const id of orderedBenefitIds) {
    if (!set.has(id)) {
      throw new Error("ID de beneficio inválido para este pack");
    }
  }
  await prisma.$transaction(
    orderedBenefitIds.map((id, index) =>
      prisma.benefitDefinition.update({
        where: { id },
        data: { sortOrder: index },
      })
    )
  );
}

export async function getPackDefinitionById(packId: number, albumId: number) {
  const pack = await prisma.packDefinition.findFirst({
    where: { id: packId, albumId },
    include: { benefits: { orderBy: { sortOrder: "asc" } } },
  });
  if (!pack) throw new Error("Pack no encontrado");
  return pack;
}

/** Beneficio dentro de un pack (evita leer por id global sin álbum/pack). */
export async function getBenefitDefinitionById(
  packDefinitionId: number,
  benefitId: number
): Promise<BenefitDefinition> {
  const row = await prisma.benefitDefinition.findFirst({
    where: { id: benefitId, packDefinitionId },
  });
  if (!row) throw new Error("Beneficio no encontrado");
  return row;
}

export type CreatePackDefinitionInput = {
  albumId: number;
  name: string;
  description?: string | null;
  /** Precio base del fotógrafo (ARS). El cliente paga este monto + fee de plataforma. */
  priceClientArs: number;
  isActive?: boolean;
  displayOrder?: number;
  availabilityPhase?: PackAvailabilityPhase | null;
  albumMode?: AlbumMode | null;
  validFrom?: Date | null;
  validUntil?: Date | null;
  redemptionDeadlineAt?: Date | null;
  currency?: string;
  coverImageUrl?: string | null;
};

/** CRUD mínimo para panel/API posteriores. */
export async function createPackDefinition(
  input: CreatePackDefinitionInput
): Promise<PackDefinition> {
  const availabilityPhase = resolvePackAvailabilityPhase(
    input.availabilityPhase,
    input.albumMode
  );
  const isActive = input.isActive ?? false;
  if (isActive) {
    throw new PackActivationError();
  }

  return prisma.packDefinition.create({
    data: {
      albumId: input.albumId,
      name: input.name,
      description: input.description ?? null,
      priceClientArs: Math.max(0, Math.round(input.priceClientArs)),
      isActive,
      displayOrder: input.displayOrder ?? 0,
      availabilityPhase,
      validFrom: input.validFrom ?? null,
      validUntil: input.validUntil ?? null,
      redemptionDeadlineAt: input.redemptionDeadlineAt ?? null,
      currency: input.currency ?? "ARS",
      coverImageUrl: input.coverImageUrl ?? null,
    },
  });
}

export type UpdatePackDefinitionInput = Partial<{
  name: string;
  description: string | null;
  priceClientArs: number;
  isActive: boolean;
  displayOrder: number;
  availabilityPhase: PackAvailabilityPhase;
  validFrom: Date | null;
  validUntil: Date | null;
  redemptionDeadlineAt: Date | null;
  currency: string;
  coverImageUrl: string | null;
}>;

export async function updatePackDefinition(
  packId: number,
  albumId: number,
  data: UpdatePackDefinitionInput
): Promise<PackDefinition> {
  await getPackDefinitionById(packId, albumId);
  if (data.isActive === true) {
    await assertPackHasBenefitsForActivation(packId);
  }
  return prisma.packDefinition.update({
    where: { id: packId },
    data: {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.description !== undefined ? { description: data.description } : {}),
      ...(data.priceClientArs !== undefined
        ? { priceClientArs: Math.max(0, Math.round(data.priceClientArs)) }
        : {}),
      ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      ...(data.displayOrder !== undefined ? { displayOrder: data.displayOrder } : {}),
      ...(data.availabilityPhase !== undefined ? { availabilityPhase: data.availabilityPhase } : {}),
      ...(data.validFrom !== undefined ? { validFrom: data.validFrom } : {}),
      ...(data.validUntil !== undefined ? { validUntil: data.validUntil } : {}),
      ...(data.redemptionDeadlineAt !== undefined
        ? { redemptionDeadlineAt: data.redemptionDeadlineAt }
        : {}),
      ...(data.currency !== undefined ? { currency: data.currency } : {}),
      ...(data.coverImageUrl !== undefined ? { coverImageUrl: data.coverImageUrl } : {}),
    },
  });
}

export async function deletePackDefinition(packId: number, albumId: number): Promise<void> {
  await getPackDefinitionById(packId, albumId);
  await prisma.packDefinition.delete({ where: { id: packId } });
}

export type CreateBenefitInput = {
  packDefinitionId: number;
  kind: PackBenefitKind;
  includedQuantity: number;
  sortOrder: number;
  photographerProductId?: number | null;
  templatePolicy: BenefitTemplatePolicy;
  templateId?: number | null;
  extraUnitPriceOverrideArs?: number | null;
  requiredPhotoCount: number;
  selectionMode: BenefitSelectionMode;
  maxPhotosPerUnit?: number | null;
  regularUnitPriceAfterPreventaArs?: number | null;
};

export async function createBenefitDefinition(input: CreateBenefitInput): Promise<BenefitDefinition> {
  return prisma.benefitDefinition.create({
    data: {
      packDefinitionId: input.packDefinitionId,
      kind: input.kind,
      includedQuantity: input.includedQuantity,
      sortOrder: input.sortOrder,
      photographerProductId: input.photographerProductId ?? null,
      templatePolicy: input.templatePolicy,
      templateId: input.templateId ?? null,
      extraUnitPriceOverrideArs:
        input.extraUnitPriceOverrideArs == null
          ? null
          : Math.max(0, Math.round(input.extraUnitPriceOverrideArs)),
      regularUnitPriceAfterPreventaArs:
        input.regularUnitPriceAfterPreventaArs == null
          ? null
          : Math.max(0, Math.round(input.regularUnitPriceAfterPreventaArs)),
      requiredPhotoCount: input.requiredPhotoCount,
      selectionMode: input.selectionMode,
      maxPhotosPerUnit: input.maxPhotosPerUnit ?? null,
    },
  });
}

export type UpdateBenefitInput = Partial<{
  kind: PackBenefitKind;
  includedQuantity: number;
  sortOrder: number;
  photographerProductId: number | null;
  templatePolicy: BenefitTemplatePolicy;
  templateId: number | null;
  extraUnitPriceOverrideArs: number | null;
  requiredPhotoCount: number;
  selectionMode: BenefitSelectionMode;
  maxPhotosPerUnit: number | null;
  regularUnitPriceAfterPreventaArs: number | null;
}>;

export async function updateBenefitDefinition(
  benefitId: number,
  packDefinitionId: number,
  data: UpdateBenefitInput
): Promise<BenefitDefinition> {
  await getBenefitDefinitionById(packDefinitionId, benefitId);
  return prisma.benefitDefinition.update({
    where: { id: benefitId },
    data: {
      ...(data.kind !== undefined ? { kind: data.kind } : {}),
      ...(data.includedQuantity !== undefined ? { includedQuantity: data.includedQuantity } : {}),
      ...(data.sortOrder !== undefined ? { sortOrder: data.sortOrder } : {}),
      ...(data.photographerProductId !== undefined
        ? { photographerProductId: data.photographerProductId }
        : {}),
      ...(data.templatePolicy !== undefined ? { templatePolicy: data.templatePolicy } : {}),
      ...(data.templateId !== undefined ? { templateId: data.templateId } : {}),
      ...(data.extraUnitPriceOverrideArs !== undefined
        ? {
            extraUnitPriceOverrideArs:
              data.extraUnitPriceOverrideArs == null
                ? null
                : Math.max(0, Math.round(data.extraUnitPriceOverrideArs)),
          }
        : {}),
      ...(data.requiredPhotoCount !== undefined
        ? { requiredPhotoCount: data.requiredPhotoCount }
        : {}),
      ...(data.selectionMode !== undefined ? { selectionMode: data.selectionMode } : {}),
      ...(data.maxPhotosPerUnit !== undefined ? { maxPhotosPerUnit: data.maxPhotosPerUnit } : {}),
      ...(data.regularUnitPriceAfterPreventaArs !== undefined
        ? {
            regularUnitPriceAfterPreventaArs:
              data.regularUnitPriceAfterPreventaArs == null
                ? null
                : Math.max(0, Math.round(data.regularUnitPriceAfterPreventaArs)),
          }
        : {}),
    },
  });
}

export async function deleteBenefitDefinition(
  benefitId: number,
  packDefinitionId: number
): Promise<void> {
  await getBenefitDefinitionById(packDefinitionId, benefitId);
  await prisma.benefitDefinition.delete({ where: { id: benefitId } });
}
