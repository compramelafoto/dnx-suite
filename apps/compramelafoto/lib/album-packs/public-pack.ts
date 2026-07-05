import type {
  AlbumPackFulfillmentKind,
  AlbumPackSelectionMode,
} from "@/lib/album-packs/album-pack-composition-types";
import { mapDbComponentsToComposition } from "@/lib/album-packs/album-pack-components-persistence";
import { stripPackQtyFromDescription } from "@/lib/album-packs/album-pack-quantity-mode";
import { stripPackPrintProductFromDescription } from "@/lib/album-packs/album-pack-print-product-encoding";
import { resolveAlbumPackSelectionMode } from "@/lib/album-packs/album-pack-selection-mode";
import {
  deriveAlbumPackFulfillmentKind,
  resolveAlbumPackComponents,
} from "@/lib/album-packs/resolve-album-pack-order-lines";
import type { AlbumPackType } from "@/lib/prisma";

export type PublicPackComponent = {
  kind: "DIGITAL" | "PRINT";
  sortOrder: number;
  unitsPerSelection: number;
  photographerProductId: number | null;
  productName: string | null;
  size: string | null;
  finish: string | null;
};

export type PublicPack = {
  id: string;
  name: string;
  /** Descripción visible (sin metadatos @packQty / @packPrintProduct). */
  description: string | null;
  coverImageUrl: string | null;
  price: number;
  includedPhotoCount: number | null;
  requiresSelection: boolean;
  requiresDesign: boolean;
  compositionFulfillmentKind: AlbumPackFulfillmentKind;
  components: PublicPackComponent[];
  selectionMode: AlbumPackSelectionMode;
  productName: string | null;
  size: string | null;
  finish: string | null;
};

export type AlbumPackRowForPublic = {
  id: string;
  name: string;
  description: string | null;
  coverImageUrl?: string | null;
  price: number;
  includedPhotoCount: number | null;
  requiresSelection: boolean;
  requiresDesign: boolean;
  templateId: number | null;
  availabilityPhase: "PRE_UPLOAD" | "POST_UPLOAD" | "ALWAYS";
  isActive: boolean;
  packType?: AlbumPackType;
  components?: Array<{
    kind: "DIGITAL" | "PRINT" | "DESIGN_PRODUCT";
    sortOrder: number;
    unitsPerSelection: number;
    photographerProductId: number | null;
    photographerProduct?: {
      id: number;
      name: string;
      size: string | null;
      acabado: string | null;
      isActive: boolean;
    } | null;
  }>;
};

export type PrintProductForPublicValidation = {
  id: number;
  name: string;
  size: string | null;
  acabado: string | null;
  isActive: boolean;
};

function stripPackDescriptionForPublic(description: string | null | undefined): string | null {
  const stripped = stripPackPrintProductFromDescription(stripPackQtyFromDescription(description));
  const trimmed = stripped.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function formatPrintSpec(size: string | null, finish: string | null): string | null {
  const parts = [size?.trim(), finish?.trim()].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : null;
}

function primaryPrintComponent(
  components: PublicPackComponent[]
): PublicPackComponent | null {
  return components.find((c) => c.kind === "PRINT") ?? null;
}

function mapRowToPublicComponents(
  pack: AlbumPackRowForPublic
): PublicPackComponent[] {
  const resolved = resolveAlbumPackComponents({
    components: pack.components?.length
      ? mapDbComponentsToComposition(pack.components)
      : null,
    description: pack.description,
    packType: pack.packType,
  });

  const dbByProductId = new Map(
    (pack.components ?? [])
      .filter((c) => c.photographerProductId != null)
      .map((c) => [c.photographerProductId as number, c.photographerProduct ?? null])
  );

  return resolved
    .filter((c) => c.kind === "DIGITAL" || c.kind === "PRINT")
    .map((component) => {
      const product =
        component.photographerProductId != null
          ? dbByProductId.get(component.photographerProductId) ?? null
          : null;
      return {
        kind: component.kind as "DIGITAL" | "PRINT",
        sortOrder: component.sortOrder,
        unitsPerSelection: component.unitsPerSelection,
        photographerProductId: component.photographerProductId ?? null,
        productName: product?.name ?? null,
        size: product?.size ?? null,
        finish: product?.acabado ?? null,
      };
    });
}

export function collectAlbumPackPrintProductIds(packs: AlbumPackRowForPublic[]): number[] {
  const ids = new Set<number>();
  for (const pack of packs) {
    const components = resolveAlbumPackComponents({
      components: pack.components?.length
        ? mapDbComponentsToComposition(pack.components)
        : null,
      description: pack.description,
      packType: pack.packType,
    });
    for (const component of components) {
      if (component.kind === "PRINT" && component.photographerProductId != null) {
        ids.add(component.photographerProductId);
      }
    }
  }
  return Array.from(ids);
}

function isPrintProductSellable(
  productId: number,
  printProductsById?: Map<number, PrintProductForPublicValidation>
): boolean {
  const product = printProductsById?.get(productId);
  if (!product) return false;
  if (!product.isActive) return false;
  const size = product.size?.trim();
  const finish = product.acabado?.trim();
  return Boolean(size && finish);
}

export function isAlbumPackPubliclySellable(
  pack: AlbumPackRowForPublic,
  printProductsById?: Map<number, PrintProductForPublicValidation>
): boolean {
  const components = mapRowToPublicComponents(pack);
  const fulfillmentKind = deriveAlbumPackFulfillmentKind(
    components.map((c) => ({
      kind: c.kind,
      sortOrder: c.sortOrder,
      unitsPerSelection: c.unitsPerSelection,
      photographerProductId: c.photographerProductId,
    }))
  );

  if (fulfillmentKind !== "PRINT" && fulfillmentKind !== "MIXED") {
    return true;
  }

  const printComponents = components.filter((c) => c.kind === "PRINT");
  if (printComponents.length === 0) return false;

  for (const component of printComponents) {
    const productId = component.photographerProductId;
    if (productId == null) return false;

    if (component.productName != null) {
      if (!component.size?.trim() || !component.finish?.trim()) return false;
      const dbProduct = pack.components?.find(
        (c) => c.photographerProductId === productId
      )?.photographerProduct;
      if (dbProduct && !dbProduct.isActive) return false;
      continue;
    }

    if (!isPrintProductSellable(productId, printProductsById)) {
      return false;
    }
  }

  return true;
}

export function buildPublicPackFromAlbumPackRow(pack: AlbumPackRowForPublic): PublicPack {
  const components = mapRowToPublicComponents(pack);
  const compositionFulfillmentKind = deriveAlbumPackFulfillmentKind(
    components.map((c) => ({
      kind: c.kind,
      sortOrder: c.sortOrder,
      unitsPerSelection: c.unitsPerSelection,
      photographerProductId: c.photographerProductId,
    }))
  );
  const print = primaryPrintComponent(components);
  const selectionMode = resolveAlbumPackSelectionMode(pack);

  const coverImageUrl = String(pack.coverImageUrl ?? "").trim();

  return {
    id: pack.id,
    name: pack.name,
    description: stripPackDescriptionForPublic(pack.description),
    coverImageUrl: coverImageUrl || null,
    price: pack.price,
    includedPhotoCount: pack.includedPhotoCount,
    requiresSelection: pack.requiresSelection,
    requiresDesign: pack.requiresDesign,
    compositionFulfillmentKind,
    components,
    selectionMode,
    productName: print?.productName ?? null,
    size: print?.size ?? null,
    finish: print?.finish ?? null,
  };
}

export function isBulkPhotoSelectionPack(pack: Pick<PublicPack, "selectionMode">): boolean {
  return pack.selectionMode === "ALL_MY_PHOTOS" || pack.selectionMode === "ALL_EVENT_PHOTOS";
}

export function getPublicPackBadgeLabel(
  kind: AlbumPackFulfillmentKind
): "Digital" | "Impresiones" | "Mixto" {
  if (kind === "PRINT") return "Impresiones";
  if (kind === "MIXED") return "Mixto";
  return "Digital";
}

function photoCountLabel(count: number): string {
  return `${count} foto${count === 1 ? "" : "s"}`;
}

export function getPublicPackSelectionHeadline(pack: PublicPack): string {
  const count = pack.includedPhotoCount;
  const printSpec = formatPrintSpec(pack.size, pack.finish);

  if (pack.selectionMode === "ALL_MY_PHOTOS") {
    if (pack.compositionFulfillmentKind === "PRINT") {
      return printSpec
        ? `Buscá tus fotos con IA para imprimir en ${printSpec}.`
        : "Buscá tus fotos con IA para imprimir.";
    }
    if (pack.compositionFulfillmentKind === "MIXED") {
      return printSpec
        ? `Buscá tus fotos con IA. Las recibirás en digital e impresas en ${printSpec}.`
        : "Buscá tus fotos con IA. Las recibirás en digital e impresas.";
    }
    return "Buscá tus fotos con IA para descargar en digital.";
  }

  if (pack.selectionMode === "ALL_EVENT_PHOTOS") {
    if (pack.compositionFulfillmentKind === "PRINT") {
      return printSpec
        ? `Incluye todas las fotos del álbum para imprimir en ${printSpec}.`
        : "Incluye todas las fotos del álbum para imprimir.";
    }
    if (pack.compositionFulfillmentKind === "MIXED") {
      return printSpec
        ? `Incluye todas las fotos del álbum en digital e impresas en ${printSpec}.`
        : "Incluye todas las fotos del álbum en digital e impresas.";
    }
    return "Incluye todas las fotos del álbum en digital.";
  }

  if (count == null || count <= 0) {
    return "Elegí las fotos de este pack.";
  }

  if (pack.compositionFulfillmentKind === "PRINT") {
    return printSpec
      ? `Elegí ${photoCountLabel(count)} para imprimir en ${printSpec}.`
      : `Elegí ${photoCountLabel(count)} para imprimir.`;
  }
  if (pack.compositionFulfillmentKind === "MIXED") {
    return `Elegí ${photoCountLabel(count)} y recibí esas mismas fotos en digital e impresas.`;
  }
  return `Elegí ${photoCountLabel(count)} digitales.`;
}

export function getPublicPackPurchaseNote(pack: PublicPack): string | null {
  if (pack.compositionFulfillmentKind === "PRINT") {
    return "Este pack incluye impresiones. El fotógrafo preparará el pedido impreso con las fotos que elijas.";
  }
  if (pack.compositionFulfillmentKind === "MIXED") {
    return "Este pack incluye descarga digital e impresiones de las mismas fotos seleccionadas.";
  }
  return null;
}

export function getPublicPackSelectionHelpText(
  packName: string,
  requiredCount: number,
  fulfillmentKind: AlbumPackFulfillmentKind,
  printSpec?: string | null
): string {
  if (fulfillmentKind === "MIXED") {
    return `Elegí ${photoCountLabel(requiredCount)}. Las recibirás en digital e impresas.`;
  }
  if (fulfillmentKind === "PRINT") {
    return printSpec
      ? `Elegí exactamente ${photoCountLabel(requiredCount)} para imprimir en ${printSpec}.`
      : `Elegí exactamente ${photoCountLabel(requiredCount)} para imprimir.`;
  }
  return `Elegí exactamente ${photoCountLabel(requiredCount)} fotos digitales para ${packName}.`;
}

export function getPublicPackStickySelectionLabel(
  selectedCount: number,
  fulfillmentKind: AlbumPackFulfillmentKind
): string {
  const countLabel = photoCountLabel(selectedCount);
  if (fulfillmentKind === "PRINT") {
    return `Seleccionaste ${countLabel} para imprimir.`;
  }
  if (fulfillmentKind === "MIXED") {
    return `Seleccionaste ${countLabel} para digital e impresión.`;
  }
  return `Seleccionaste ${countLabel} digitales.`;
}
