/**
 * Adjunta a cada ticket la composición resuelta (ticket base + fase vigente).
 */

import {
  resolveIncludedProducts,
  type PricePhaseItemResolvedInput,
  type TicketBaseItemInput,
} from "@/lib/catalog/domain/resolve-included-items";
import type { PublicTicketDto, PublicTicketProductDto } from "@/lib/public-registration/domain/types";

export function ticketProductsToBaseItems(
  products: PublicTicketProductDto[],
): TicketBaseItemInput[] {
  return products
    .filter((p) => (p.sourceType ?? "TICKET_BASE") === "TICKET_BASE" && p.ticketTypeItemId)
    .map((p) => ({
      id: p.ticketTypeItemId!,
      productId: p.productId,
      productVariantId: p.fixedVariant?.id ?? null,
      quantity: p.quantity,
      requiresVariantChoice: p.requiresVariantChoice,
      product: {
        id: p.productId,
        name: p.productName,
        description: p.productDescription ?? null,
        isActive: true,
        archivedAt: null,
        primaryImageAssetId: null,
        primaryImageUrl: p.primaryImageUrl ?? null,
        sizeChartAssetId: null,
        sizeChartUrl: p.sizeChartUrl ?? null,
        sizeChartDescription: p.sizeChartDescription ?? null,
        sizeChartInstructions: p.sizeChartInstructions ?? null,
        gallery: (p.gallery ?? []).map((g, idx) => ({
          assetId: `gallery-${idx}`,
          url: g.url,
          altText: g.altText,
          caption: g.caption,
          sortOrder: g.sortOrder,
        })),
        variants: p.variants.map((v) => ({
          id: v.id,
          code: v.code,
          name: v.name,
          sku: v.sku,
          stock: v.availableStock,
          reservedStock: 0,
          isActive: v.isActive,
          sortOrder: v.sortOrder,
        })),
      },
      productVariant: p.fixedVariant
        ? {
            id: p.fixedVariant.id,
            name: p.fixedVariant.name,
            sku: p.fixedVariant.sku,
            stock: 0,
            reservedStock: 0,
            isActive: true,
          }
        : null,
    }));
}

export function includedConfigToPublicProduct(
  cfg: ReturnType<typeof resolveIncludedProducts>[number],
): PublicTicketProductDto {
  return {
    ticketTypeItemId: cfg.ticketTypeItemId,
    pricePhaseItemId: cfg.pricePhaseItemId,
    sourceType: cfg.sourceType,
    productId: cfg.productId,
    productName: cfg.productName,
    productDescription: cfg.productDescription,
    quantity: cfg.quantity,
    requiresVariantChoice: cfg.requiresVariantChoice,
    fulfillmentRequired: cfg.fulfillmentRequired,
    primaryImageUrl: cfg.primaryImageUrl,
    sizeChartUrl: cfg.sizeChartUrl,
    sizeChartDescription: cfg.sizeChartDescription,
    sizeChartInstructions: cfg.sizeChartInstructions,
    gallery: cfg.gallery.map((g) => ({
      url: g.url,
      altText: g.altText,
      caption: g.caption,
      sortOrder: g.sortOrder,
    })),
    fixedVariant: cfg.fixedVariant,
    variants: cfg.variants,
  };
}

export function attachPhaseProductsToTickets<T extends PublicTicketDto>(
  tickets: T[],
  phaseItems: PricePhaseItemResolvedInput[],
): T[] {
  return tickets.map((ticket) => {
    const baseItems = ticketProductsToBaseItems(ticket.products);
    const included = resolveIncludedProducts({
      ticketBaseItems: baseItems,
      pricePhaseItems: phaseItems,
    });
    const products = included.map(includedConfigToPublicProduct);
    const kitKind =
      products.length === 0
        ? ("entry" as const)
        : products.length === 1
          ? ("entry_product" as const)
          : ("kit" as const);
    return { ...ticket, products, kitKind };
  });
}
