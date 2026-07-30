/**
 * Resolución de artículos incluidos: ticket base + fase de precio.
 *
 * Política (Etapa 8B): bloquear el mismo productId en ticket y fase.
 * El frontend nunca define la composición; solo envía variantChoices.
 */

import type {
  IncludedProductConfig,
  ResolveIncludedItemsErrorCode,
} from "./types";

export class ResolveIncludedItemsError extends Error {
  readonly code: ResolveIncludedItemsErrorCode;

  constructor(code: ResolveIncludedItemsErrorCode, message: string) {
    super(message);
    this.name = "ResolveIncludedItemsError";
    this.code = code;
  }
}

export type TicketBaseItemInput = {
  id: string;
  productId: string;
  productVariantId: string | null;
  quantity: number;
  requiresVariantChoice: boolean;
  product: {
    id: string;
    name: string;
    description: string | null;
    isActive: boolean;
    archivedAt?: Date | null;
    primaryImageAssetId?: string | null;
    primaryImageUrl?: string | null;
    sizeChartAssetId?: string | null;
    sizeChartUrl?: string | null;
    sizeChartDescription?: string | null;
    sizeChartInstructions?: string | null;
    gallery?: IncludedProductConfig["gallery"];
    variants: Array<{
      id: string;
      code?: string;
      name: string;
      sku: string;
      stock: number;
      reservedStock: number;
      isActive: boolean;
      sortOrder?: number;
    }>;
  };
  productVariant: {
    id: string;
    name: string;
    sku: string;
    stock: number;
    reservedStock: number;
    isActive: boolean;
  } | null;
};

export type PricePhaseItemResolvedInput = {
  id: string;
  productId: string;
  quantity: number;
  requiresVariantChoice: boolean;
  isIncluded: boolean;
  fulfillmentRequired: boolean;
  displayTitle: string | null;
  displayDescription: string | null;
  sortOrder: number;
  /** Cupo first-N de beneficio (null = sin límite). ≠ capacity de fase. */
  stockLimit?: number | null;
  product: TicketBaseItemInput["product"];
};

function mapVariants(
  product: TicketBaseItemInput["product"],
): IncludedProductConfig["variants"] {
  return [...product.variants]
    .sort((a, b) => (a.sortOrder ?? 100) - (b.sortOrder ?? 100))
    .map((v) => ({
      id: v.id,
      code: v.code,
      name: v.name,
      sku: v.sku,
      availableStock: Math.max(0, v.stock - v.reservedStock),
      isActive: v.isActive,
      sortOrder: v.sortOrder ?? 100,
    }));
}

function assertProductEligible(
  product: TicketBaseItemInput["product"],
  requiresVariantChoice: boolean,
  quantity: number,
): void {
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new ResolveIncludedItemsError(
      "INVALID_QUANTITY",
      `Cantidad inválida para ${product.name}.`,
    );
  }
  if (!product.isActive || product.archivedAt) {
    throw new ResolveIncludedItemsError(
      "PRODUCT_INACTIVE",
      `El producto ${product.name} no está disponible.`,
    );
  }
  if (requiresVariantChoice) {
    const eligible = product.variants.filter((v) => v.isActive);
    if (eligible.length === 0) {
      throw new ResolveIncludedItemsError(
        "VARIANT_REQUIRED_WITHOUT_VARIANTS",
        `${product.name} exige talle pero no tiene variantes activas.`,
      );
    }
  }
}

function toConfig(input: {
  ticketTypeItemId: string | null;
  pricePhaseItemId: string | null;
  sourceType: "TICKET_BASE" | "PRICE_PHASE";
  quantity: number;
  requiresVariantChoice: boolean;
  fulfillmentRequired: boolean;
  displayTitle: string | null;
  displayDescription: string | null;
  product: TicketBaseItemInput["product"];
  fixedVariant: IncludedProductConfig["fixedVariant"];
}): IncludedProductConfig {
  assertProductEligible(input.product, input.requiresVariantChoice, input.quantity);
  return {
    ticketTypeItemId: input.ticketTypeItemId,
    pricePhaseItemId: input.pricePhaseItemId,
    sourceType: input.sourceType,
    productId: input.product.id,
    productName: input.displayTitle?.trim() || input.product.name,
    productDescription:
      input.displayDescription?.trim() || input.product.description,
    displayTitle: input.displayTitle,
    displayDescription: input.displayDescription,
    quantity: input.quantity,
    requiresVariantChoice: input.requiresVariantChoice,
    fulfillmentRequired: input.fulfillmentRequired,
    primaryImageAssetId: input.product.primaryImageAssetId ?? null,
    primaryImageUrl: input.product.primaryImageUrl ?? null,
    sizeChartAssetId: input.product.sizeChartAssetId ?? null,
    sizeChartUrl: input.product.sizeChartUrl ?? null,
    sizeChartDescription: input.product.sizeChartDescription ?? null,
    sizeChartInstructions: input.product.sizeChartInstructions ?? null,
    gallery: input.product.gallery ?? [],
    fixedVariant: input.fixedVariant,
    variants: mapVariants(input.product),
  };
}

/**
 * Combina items base del ticket + items de la fase vigente.
 * Bloquea productId duplicado entre niveles.
 */
export function resolveIncludedProducts(input: {
  ticketBaseItems: TicketBaseItemInput[];
  pricePhaseItems: PricePhaseItemResolvedInput[];
}): IncludedProductConfig[] {
  const baseProductIds = new Set(input.ticketBaseItems.map((i) => i.productId));
  for (const phaseItem of input.pricePhaseItems) {
    if (!phaseItem.isIncluded) continue;
    if (baseProductIds.has(phaseItem.productId)) {
      throw new ResolveIncludedItemsError(
        "DUPLICATE_PRODUCT_TICKET_AND_PHASE",
        `El producto ${phaseItem.product.name} está en ticket base y en la fase. ` +
          "Quitá uno de los dos (política Etapa 8B).",
      );
    }
  }

  const result: IncludedProductConfig[] = [];

  for (const item of input.ticketBaseItems) {
    const fixed = item.productVariant
      ? {
          id: item.productVariant.id,
          name: item.productVariant.name,
          sku: item.productVariant.sku,
        }
      : null;
    result.push(
      toConfig({
        ticketTypeItemId: item.id,
        pricePhaseItemId: null,
        sourceType: "TICKET_BASE",
        quantity: item.quantity,
        requiresVariantChoice: item.requiresVariantChoice,
        fulfillmentRequired: true,
        displayTitle: null,
        displayDescription: null,
        product: item.product,
        fixedVariant: fixed,
      }),
    );
  }

  const phaseSorted = [...input.pricePhaseItems]
    .filter((i) => i.isIncluded)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  for (const item of phaseSorted) {
    result.push(
      toConfig({
        ticketTypeItemId: null,
        pricePhaseItemId: item.id,
        sourceType: "PRICE_PHASE",
        quantity: item.quantity,
        requiresVariantChoice: item.requiresVariantChoice,
        fulfillmentRequired: item.fulfillmentRequired,
        displayTitle: item.displayTitle,
        displayDescription: item.displayDescription,
        product: item.product,
        fixedVariant: null,
      }),
    );
  }

  return result;
}

/**
 * Valida que las variantChoices del cliente cubran exactamente los productos
 * que requieren variante en la composición resuelta (no lista arbitraria).
 */
export function validateVariantChoicesAgainstIncluded(
  included: IncludedProductConfig[],
  variantChoices: Array<{ productId: string; productVariantId: string }>,
): void {
  const required = included.filter((p) => p.requiresVariantChoice);
  const allowedIds = new Set(included.map((p) => p.productId));

  for (const choice of variantChoices) {
    if (!allowedIds.has(choice.productId)) {
      throw new ResolveIncludedItemsError(
        "PRODUCT_INACTIVE",
        "Se envió un producto que no forma parte de esta inscripción.",
      );
    }
  }

  for (const product of required) {
    const choice = variantChoices.find((c) => c.productId === product.productId);
    if (!choice) {
      throw new ResolveIncludedItemsError(
        "VARIANT_REQUIRED_WITHOUT_VARIANTS",
        `Elegí el talle de ${product.productName}.`,
      );
    }
    const variant = product.variants.find((v) => v.id === choice.productVariantId);
    if (!variant || !variant.isActive) {
      throw new ResolveIncludedItemsError(
        "PRODUCT_INACTIVE",
        `El talle elegido para ${product.productName} no es válido.`,
      );
    }
    if (variant.availableStock < product.quantity) {
      throw new ResolveIncludedItemsError(
        "PRODUCT_INACTIVE",
        `Sin stock suficiente de ${product.productName}.`,
      );
    }
  }
}

export type RegistrationItemBuildInput = {
  ticketTypeItemId?: string | null;
  pricePhaseItemId?: string | null;
  sourceType: "TICKET_BASE" | "PRICE_PHASE";
  productId?: string | null;
  productVariantId?: string | null;
  nameSnapshot: string;
  productNameSnapshot?: string | null;
  productDescriptionSnapshot?: string | null;
  variantNameSnapshot?: string | null;
  skuSnapshot?: string | null;
  quantity: number;
  unitPriceAmount: number;
  totalPriceAmount: number;
  currency: string;
  isIncluded: boolean;
  imageAssetIdSnapshot?: string | null;
  sizeChartAssetIdSnapshot?: string | null;
};

/** Construye snapshots inmutables desde la composición resuelta + elecciones de talle. */
export function buildRegistrationItemSnapshots(
  included: IncludedProductConfig[],
  variantChoices: Array<{ productId: string; productVariantId: string }>,
  currency: string,
): RegistrationItemBuildInput[] {
  validateVariantChoicesAgainstIncluded(included, variantChoices);

  const items: RegistrationItemBuildInput[] = [];

  for (const product of included) {
    let variantId = product.fixedVariant?.id ?? null;
    let variantName = product.fixedVariant?.name ?? null;
    let variantSku = product.fixedVariant?.sku ?? null;

    if (product.requiresVariantChoice) {
      const choice = variantChoices.find((c) => c.productId === product.productId)!;
      const variant = product.variants.find((v) => v.id === choice.productVariantId)!;
      variantId = variant.id;
      variantName = variant.name;
      variantSku = variant.sku;
    } else if (product.fixedVariant) {
      const live = product.variants.find((v) => v.id === product.fixedVariant!.id);
      if (live && live.availableStock < product.quantity) {
        throw new ResolveIncludedItemsError(
          "PRODUCT_INACTIVE",
          `Sin stock suficiente de ${product.productName}.`,
        );
      }
    }

    items.push({
      ticketTypeItemId: product.ticketTypeItemId,
      pricePhaseItemId: product.pricePhaseItemId,
      sourceType: product.sourceType,
      productId: product.productId,
      productVariantId: variantId,
      nameSnapshot: variantName
        ? `${product.productName} — ${variantName}`
        : product.productName,
      productNameSnapshot: product.productName,
      productDescriptionSnapshot: product.productDescription,
      variantNameSnapshot: variantName,
      skuSnapshot: variantSku,
      quantity: product.quantity,
      unitPriceAmount: 0,
      totalPriceAmount: 0,
      currency,
      isIncluded: true,
      imageAssetIdSnapshot: product.primaryImageAssetId,
      sizeChartAssetIdSnapshot: product.sizeChartAssetId,
    });
  }

  return items;
}

/** Detecta solape de productId entre ticket base y fase (validación admin). */
export function findDuplicateProductsAcrossLevels(
  ticketProductIds: readonly string[],
  phaseProductIds: readonly string[],
): string[] {
  const base = new Set(ticketProductIds);
  return phaseProductIds.filter((id) => base.has(id));
}
