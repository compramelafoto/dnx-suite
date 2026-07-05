import type { OrderItemType } from "@/lib/prisma";
import type { AlbumPackFulfillmentKind } from "@/lib/album-packs/album-pack-composition-types";
import { isAlbumPackOrderSnapshotV2 } from "@/lib/album-packs/resolve-album-pack-order-lines";

/**
 * Componente de fee MP para packs.
 * No existe `MIXED` en MP: alineado con checkout suelto (`album-order-mp-preference`),
 * si hay ítems PRINT (incl. pack mixto) se usa la ruta PRINT / `resolvePlatformCommissionPercent`.
 */
export type AlbumPackMpComponent = "DIGITAL" | "PRINT";

export type AlbumPackOrderMpContext = {
  component: AlbumPackMpComponent;
  hasPrintItems: boolean;
  hasDigitalItems: boolean;
  /** DIGITAL + PRINT en el mismo pedido. */
  isMixedOrder: boolean;
  fulfillmentKind: AlbumPackFulfillmentKind | null;
};

export function resolveAlbumPackOrderMpContext(params: {
  items: Array<{ productType: OrderItemType }>;
  pricingSnapshot: unknown;
}): AlbumPackOrderMpContext {
  const hasPrintItems = params.items.some((it) => it.productType === "PRINT");
  const hasDigitalItems = params.items.some((it) => it.productType === "DIGITAL");
  const isMixedOrder = hasPrintItems && hasDigitalItems;

  let fulfillmentKind: AlbumPackFulfillmentKind | null = null;
  if (isAlbumPackOrderSnapshotV2(params.pricingSnapshot)) {
    fulfillmentKind = params.pricingSnapshot.fulfillmentKind;
  }

  const component: AlbumPackMpComponent = hasPrintItems ? "PRINT" : "DIGITAL";

  return {
    component,
    hasPrintItems,
    hasDigitalItems,
    isMixedOrder,
    fulfillmentKind,
  };
}

/** @deprecated Usar `resolveAlbumPackOrderMpContext`. */
export function resolveAlbumPackOrderMpComponent(params: {
  items: Array<{ productType: OrderItemType }>;
  pricingSnapshot: unknown;
}): AlbumPackMpComponent {
  return resolveAlbumPackOrderMpContext(params).component;
}

export function albumPackMpShadowCompareSite(ctx: AlbumPackOrderMpContext): string {
  if (ctx.isMixedOrder) return "pack.payment-preference.mixed";
  if (ctx.hasPrintItems) return "pack.payment-preference.print";
  return "pack.payment-preference";
}
