import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import {
  CatalogToPreventaMapperError,
  mapCatalogProductToBenefitInputs,
  type CatalogComponentForMapper,
} from "@/lib/preventa-canjeable/catalog-to-preventa-mapper";
import { catalogProductInclude } from "@/lib/catalog-products/product-include";
import { getNextDisplayOrderForAlbum } from "@/lib/preventa-canjeable/pack-service";
import { resolvePackAvailabilityPhase } from "@/lib/preventa-canjeable/pack-availability-phase";
import { resolveDigitalQuantityMode } from "@/lib/catalog-products/digital-quantity-mode";

export class CreatePreventaPackFromCatalogError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CreatePreventaPackFromCatalogError";
  }
}

export type CreatePreventaPackFromCatalogInput = {
  albumId: number;
  userId: number;
  catalogProductId: number;
  priceClientArs: number;
  nameOverride?: string | null;
  descriptionOverride?: string | null;
};

export async function createPreventaPackFromCatalog(input: CreatePreventaPackFromCatalogInput) {
  const album = await prisma.album.findUnique({
    where: { id: input.albumId },
    select: { mode: true },
  });
  if (!album) {
    throw new CreatePreventaPackFromCatalogError("Álbum no encontrado.");
  }

  const availabilityPhase = resolvePackAvailabilityPhase(null, album.mode);

  const product = await prisma.catalogProduct.findFirst({
    where: {
      id: input.catalogProductId,
      userId: input.userId,
      isArchived: false,
    },
    include: catalogProductInclude,
  });

  if (!product) {
    throw new CreatePreventaPackFromCatalogError("Producto del catálogo no encontrado.");
  }

  if (!product.isActive) {
    throw new CreatePreventaPackFromCatalogError(
      "El producto del catálogo está inactivo. Activá el producto antes de importarlo."
    );
  }

  if (product.components.length === 0) {
    throw new CreatePreventaPackFromCatalogError(
      "Este producto no tiene componentes definidos. Completalo en Mis Packs y Combos antes de importarlo a preventa."
    );
  }

  const existing = await prisma.packDefinition.findFirst({
    where: {
      albumId: input.albumId,
      sourceCatalogProductId: product.id,
    },
    select: { id: true },
  });
  if (existing) {
    throw new CreatePreventaPackFromCatalogError(
      "Ya existe un pack de preventa vinculado a este producto en esta campaña."
    );
  }

  const components: CatalogComponentForMapper[] = product.components.map((c) => ({
    id: c.id,
    name: c.name,
    quantity: c.quantity,
    deliveryType: c.deliveryType,
    sortOrder: c.sortOrder,
    notes: c.notes,
    requiresDesign: c.requiresDesign,
    digitalQuantityMode: resolveDigitalQuantityMode({
      deliveryType: c.deliveryType,
      notes: c.notes,
    }),
  }));

  let benefitInputs;
  try {
    benefitInputs = mapCatalogProductToBenefitInputs(components);
  } catch (e) {
    if (e instanceof CatalogToPreventaMapperError) {
      throw new CreatePreventaPackFromCatalogError(e.message);
    }
    throw e;
  }

  const mockup = product.images.find((i) => i.role === "MOCKUP") ?? product.images[0];
  const displayOrder = await getNextDisplayOrderForAlbum(input.albumId);
  const now = new Date();

  const versionSnapshot: Prisma.InputJsonValue = {
    catalogProductId: product.id,
    catalogProductName: product.name,
    catalogProductUpdatedAt: product.updatedAt.toISOString(),
    components: components.map((c) => ({
      id: c.id,
      name: c.name,
      quantity: c.quantity,
      deliveryType: c.deliveryType,
      sortOrder: c.sortOrder,
      notes: c.notes,
      requiresDesign: c.requiresDesign ?? false,
    })),
  };

  try {
    return await prisma.$transaction(async (tx) => {
      const pack = await tx.packDefinition.create({
        data: {
          albumId: input.albumId,
          name: (input.nameOverride?.trim() || product.name).slice(0, 200),
          description:
            input.descriptionOverride !== undefined
              ? input.descriptionOverride?.trim() || null
              : product.description?.trim() || null,
          priceClientArs: Math.max(0, Math.round(input.priceClientArs)),
          isActive: false,
          displayOrder,
          availabilityPhase,
          currency: "ARS",
          coverImageUrl: mockup?.publicUrl ?? null,
          sourceCatalogProductId: product.id,
          sourceCatalogSyncedAt: now,
          sourceCatalogVersionSnapshot: versionSnapshot,
        },
      });

      for (const benefit of benefitInputs) {
        await tx.benefitDefinition.create({
          data: {
            packDefinitionId: pack.id,
            kind: benefit.kind,
            includedQuantity: benefit.includedQuantity,
            sortOrder: benefit.sortOrder,
            photographerProductId: benefit.photographerProductId ?? null,
            templatePolicy: benefit.templatePolicy,
            templateId: benefit.templateId ?? null,
            extraUnitPriceOverrideArs: benefit.extraUnitPriceOverrideArs ?? null,
            requiredPhotoCount: benefit.requiredPhotoCount,
            selectionMode: benefit.selectionMode,
            maxPhotosPerUnit: benefit.maxPhotosPerUnit ?? null,
            regularUnitPriceAfterPreventaArs: benefit.regularUnitPriceAfterPreventaArs ?? null,
          },
        });
      }

      return tx.packDefinition.findUniqueOrThrow({
        where: { id: pack.id },
        include: { benefits: { orderBy: { sortOrder: "asc" } } },
      });
    });
  } catch (e) {
    throw new CreatePreventaPackFromCatalogError(
      e instanceof Error ? e.message : "No se pudo crear el pack desde el catálogo."
    );
  }
}
