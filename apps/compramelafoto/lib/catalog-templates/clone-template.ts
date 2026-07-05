import type { Prisma } from "@/lib/prisma";
import { prisma } from "@/lib/prisma";
import { replaceCatalogProductComponents } from "@/lib/catalog-products/components";
import { catalogProductInclude } from "@/lib/catalog-products/product-include";
import { serializeCatalogProduct } from "@/lib/catalog-products/serialize";
import {
  parseTemplateComponents,
  templateComponentsToCatalogInput,
} from "@/lib/catalog-templates/template-components";

const DEFAULT_PRICE_CENTS = 5_000;

async function resolveOrCreateCategory(
  tx: Prisma.TransactionClient,
  userId: number,
  categoryName: string
): Promise<number> {
  const normalized = categoryName.trim().slice(0, 80) || "General";
  const existing = await tx.catalogProductCategory.findFirst({
    where: { userId, name: { equals: normalized, mode: "insensitive" } },
    select: { id: true },
  });
  if (existing) return existing.id;

  const created = await tx.catalogProductCategory.create({
    data: { userId, name: normalized, sortOrder: 0 },
  });
  return created.id;
}

export type CloneTemplateResult =
  | {
      ok: true;
      alreadyExists: false;
      product: ReturnType<typeof serializeCatalogProduct>;
    }
  | {
      ok: true;
      alreadyExists: true;
      message: string;
      product: ReturnType<typeof serializeCatalogProduct>;
    }
  | { ok: false; status: number; error: string };

export async function cloneSystemCatalogTemplateForUser(
  userId: number,
  templateId: number
): Promise<CloneTemplateResult> {
  const template = await prisma.systemCatalogTemplate.findFirst({
    where: { id: templateId, isActive: true },
  });
  if (!template) {
    return { ok: false, status: 404, error: "Plantilla no encontrada o inactiva." };
  }

  const existing = await prisma.catalogProduct.findFirst({
    where: { userId, sourceTemplateId: template.id },
    include: catalogProductInclude,
  });
  if (existing) {
    return {
      ok: true,
      alreadyExists: true,
      message: "Ya agregaste esta plantilla a tu catálogo.",
      product: serializeCatalogProduct(existing),
    };
  }

  const components = templateComponentsToCatalogInput(parseTemplateComponents(template.components));
  const basePriceCents =
    template.suggestedPriceCents != null && template.suggestedPriceCents > 0
      ? template.suggestedPriceCents
      : DEFAULT_PRICE_CENTS;

  const product = await prisma.$transaction(async (tx) => {
    const categoryId = await resolveOrCreateCategory(tx, userId, template.category);

    const created = await tx.catalogProduct.create({
      data: {
        userId,
        name: template.name,
        type: template.productType,
        description: template.description,
        basePriceCents,
        categoryId,
        isActive: true,
        isArchived: false,
        sortOrder: template.sortOrder,
        sourceTemplateId: template.id,
        sourceTemplateVersion: template.version,
      },
    });

    if (components.length > 0) {
      await replaceCatalogProductComponents(tx, created.id, components);
    }

    if (template.coverImageUrl && template.coverImageKey) {
      await tx.catalogProductImage.create({
        data: {
          productId: created.id,
          storageKey: template.coverImageKey,
          publicUrl: template.coverImageUrl,
          role: "MOCKUP",
        },
      });
    }

    return tx.catalogProduct.findUnique({
      where: { id: created.id },
      include: catalogProductInclude,
    });
  });

  if (!product) {
    return { ok: false, status: 500, error: "No se pudo crear el producto." };
  }

  return {
    ok: true,
    alreadyExists: false,
    product: serializeCatalogProduct(product),
  };
}

export async function cloneRecommendedTemplatesForUser(userId: number) {
  const templates = await prisma.systemCatalogTemplate.findMany({
    where: { isActive: true, isRecommended: true },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    select: { id: true },
  });

  const results: Array<{
    templateId: number;
    alreadyExists: boolean;
    productId: number;
  }> = [];

  for (const template of templates) {
    const result = await cloneSystemCatalogTemplateForUser(userId, template.id);
    if (!result.ok) continue;
    results.push({
      templateId: template.id,
      alreadyExists: result.alreadyExists,
      productId: result.product.id,
    });
  }

  return results;
}
