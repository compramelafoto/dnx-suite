import { prisma } from "@/lib/prisma";
import type { CatalogProductType } from "@prisma/client";
import { catalogProductInclude } from "@/lib/catalog-products/product-include";
import {
  compositionSummaryOrFallback,
  type CompositionLine,
} from "@/lib/catalog-products/composition-summary";
import { serializeSystemCatalogTemplate } from "@/lib/catalog-templates/serialize-template";
import { parseTemplateComponents } from "@/lib/catalog-templates/template-components";
import { resolveDigitalQuantityMode } from "@/lib/catalog-products/digital-quantity-mode";

export type CatalogImportProductOption = {
  id: number;
  name: string;
  type: CatalogProductType;
  basePriceCents: number;
  compositionSummary: string;
  componentCount: number;
  sourceKind: "photographer" | "system_clone";
  mockupUrl: string | null;
};

export type CatalogImportTemplateOption = {
  templateId: number;
  name: string;
  productType: CatalogProductType;
  suggestedPriceCents: number | null;
  compositionSummary: string;
  componentCount: number;
};

export type CatalogImportIncompatibleOption = {
  id: number;
  name: string;
  compositionSummary: string;
  reason: "no_components" | "already_imported" | "inactive";
};

export type CatalogImportOptions = {
  photographerProducts: CatalogImportProductOption[];
  systemFromCatalog: CatalogImportProductOption[];
  systemTemplates: CatalogImportTemplateOption[];
  incompatible: CatalogImportIncompatibleOption[];
};

function toCompositionLines(
  components: Array<{
    name: string;
    quantity: number;
    deliveryType: CompositionLine["deliveryType"];
    notes?: string;
    digitalQuantityMode?: CompositionLine["digitalQuantityMode"];
  }>
): CompositionLine[] {
  return components.map((c) => ({
    name: c.name,
    quantity: c.quantity,
    deliveryType: c.deliveryType,
    digitalQuantityMode:
      c.digitalQuantityMode ??
      resolveDigitalQuantityMode({
        deliveryType: c.deliveryType,
        notes: c.notes ?? "",
      }),
  }));
}

function toProductOption(
  product: {
    id: number;
    name: string;
    type: CatalogProductType;
    basePriceCents: number;
    sourceTemplateId: number | null;
    components: Array<{
      name: string;
      quantity: number;
      deliveryType: CompositionLine["deliveryType"];
      notes?: string;
    }>;
    images: Array<{ publicUrl: string; role: string }>;
  },
  sourceKind: "photographer" | "system_clone"
): CatalogImportProductOption {
  const lines = toCompositionLines(product.components);
  const mockup = product.images.find((i) => i.role === "MOCKUP") ?? product.images[0];

  return {
    id: product.id,
    name: product.name,
    type: product.type,
    basePriceCents: product.basePriceCents,
    compositionSummary: compositionSummaryOrFallback(product.type, lines),
    componentCount: product.components.length,
    sourceKind,
    mockupUrl: mockup?.publicUrl ?? null,
  };
}

function templateCompositionSummary(
  type: CatalogProductType,
  components: ReturnType<typeof parseTemplateComponents>
): string {
  const lines = toCompositionLines(components);
  return compositionSummaryOrFallback(type, lines);
}

/** Opciones de importación preventa desde catálogo (solo productos con componentes válidos). */
export async function loadCatalogImportOptions(
  userId: number,
  albumId: number
): Promise<CatalogImportOptions> {
  const [products, importedRows, templates, clonedRows] = await Promise.all([
    prisma.catalogProduct.findMany({
      where: { userId, isArchived: false },
      include: catalogProductInclude,
      orderBy: [{ sortOrder: "asc" }, { updatedAt: "desc" }],
    }),
    prisma.packDefinition.findMany({
      where: { albumId, sourceCatalogProductId: { not: null } },
      select: { sourceCatalogProductId: true },
    }),
    prisma.systemCatalogTemplate.findMany({
      where: { isActive: true, isRecommended: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    prisma.catalogProduct.findMany({
      where: { userId, sourceTemplateId: { not: null } },
      select: { id: true, sourceTemplateId: true },
    }),
  ]);

  const importedCatalogIds = new Set(
    importedRows
      .map((row) => row.sourceCatalogProductId)
      .filter((id): id is number => typeof id === "number")
  );

  const clonedByTemplateId = new Map<number, { productId: number }>();
  for (const row of clonedRows) {
    if (row.sourceTemplateId != null) {
      clonedByTemplateId.set(row.sourceTemplateId, { productId: row.id });
    }
  }

  const photographerProducts: CatalogImportProductOption[] = [];
  const systemFromCatalog: CatalogImportProductOption[] = [];
  const incompatible: CatalogImportIncompatibleOption[] = [];

  for (const product of products) {
    const lines = toCompositionLines(product.components);
    const compositionSummary = compositionSummaryOrFallback(product.type, lines);

    if (importedCatalogIds.has(product.id)) {
      incompatible.push({
        id: product.id,
        name: product.name,
        compositionSummary,
        reason: "already_imported",
      });
      continue;
    }

    if (!product.isActive) {
      incompatible.push({
        id: product.id,
        name: product.name,
        compositionSummary,
        reason: "inactive",
      });
      continue;
    }

    if (product.components.length === 0) {
      incompatible.push({
        id: product.id,
        name: product.name,
        compositionSummary,
        reason: "no_components",
      });
      continue;
    }

    const option = toProductOption(product, product.sourceTemplateId ? "system_clone" : "photographer");
    if (product.sourceTemplateId) {
      systemFromCatalog.push(option);
    } else {
      photographerProducts.push(option);
    }
  }

  const systemTemplates: CatalogImportTemplateOption[] = [];

  for (const template of templates) {
    const components = parseTemplateComponents(template.components);
    if (components.length === 0) continue;

    const cloned = clonedByTemplateId.get(template.id);
    if (cloned && importedCatalogIds.has(cloned.productId)) {
      continue;
    }
    if (cloned) {
      // Ya está en catálogo del fotógrafo: aparece en systemFromCatalog si es compatible.
      continue;
    }

    systemTemplates.push({
      templateId: template.id,
      name: template.name,
      productType: template.productType,
      suggestedPriceCents: template.suggestedPriceCents,
      compositionSummary: templateCompositionSummary(template.productType, components),
      componentCount: components.length,
    });
  }

  return {
    photographerProducts,
    systemFromCatalog,
    systemTemplates,
    incompatible,
  };
}
