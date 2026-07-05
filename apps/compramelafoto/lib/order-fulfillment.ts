/**
 * Clasificación de pedidos de álbum según ítems (digital / impresión / marco).
 * No usar un único orderType persistido que contradiga los ítems.
 */

export type OrderFulfillmentKind = "DIGITAL" | "PRINT" | "MIXED";

const PRINT_LIKE: ReadonlySet<string> = new Set(["PRINT", "FRAME"]);

export type AlbumOrderFulfillmentSummary = {
  kind: OrderFulfillmentKind;
  hasDigitalItems: boolean;
  hasPrintItems: boolean;
  digitalItemsCount: number;
  printItemsCount: number;
};

export function getAlbumOrderFulfillmentFromItems(
  items: { productType: string }[]
): AlbumOrderFulfillmentSummary {
  let digitalItemsCount = 0;
  let printItemsCount = 0;
  for (const it of items) {
    if (it.productType === "DIGITAL") digitalItemsCount++;
    else if (PRINT_LIKE.has(it.productType)) printItemsCount++;
  }
  const hasDigitalItems = digitalItemsCount > 0;
  const hasPrintItems = printItemsCount > 0;
  let kind: OrderFulfillmentKind;
  if (hasDigitalItems && hasPrintItems) kind = "MIXED";
  else if (hasPrintItems) kind = "PRINT";
  else kind = "DIGITAL";

  return {
    kind,
    hasDigitalItems,
    hasPrintItems,
    digitalItemsCount,
    printItemsCount,
  };
}

/** Filtro Prisma para pedidos de álbum según fulfillment (ALL = sin restricción extra). */
export function prismaAlbumWhereForFulfillment(
  fulfillment: "ALL" | OrderFulfillmentKind
): Record<string, unknown> | undefined {
  if (fulfillment === "ALL") return undefined;
  if (fulfillment === "DIGITAL") {
    return {
      AND: [
        { items: { some: { productType: "DIGITAL" } } },
        { NOT: { items: { some: { productType: { in: ["PRINT", "FRAME"] } } } } },
      ],
    };
  }
  if (fulfillment === "PRINT") {
    return { items: { some: { productType: { in: ["PRINT", "FRAME"] } } } };
  }
  if (fulfillment === "MIXED") {
    return {
      AND: [
        { items: { some: { productType: "DIGITAL" } } },
        { items: { some: { productType: { in: ["PRINT", "FRAME"] } } } },
      ],
    };
  }
  return undefined;
}

export function normalizeAdminFulfillmentParam(raw: string | null | undefined): "ALL" | OrderFulfillmentKind {
  const v = (raw || "").trim();
  if (!v) return "ALL";
  if (v === "COMBO" || v === "MIXED") return "MIXED";
  if (v === "DIGITAL" || v === "PRINT") return v;
  return "ALL";
}

export function getFulfillmentKindLabel(kind: OrderFulfillmentKind): string {
  const labels: Record<OrderFulfillmentKind, string> = {
    DIGITAL: "Digital",
    PRINT: "Impresión",
    MIXED: "Mixto",
  };
  return labels[kind];
}
