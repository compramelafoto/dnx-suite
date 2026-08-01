/**
 * Validación canónica del carrito TIENDA.
 * Solo lectura — no holds, no stock writes, no pedidos.
 */

import "server-only";

import { prisma } from "@repo/db";
import { storePageContent } from "@/content/store";
import { publicAvailableStock } from "@/lib/public-store/availability";
import {
  STORE_CART_MAX_QUANTITY_PER_LINE,
} from "@/lib/public-store/cart/constants";
import { storeCartLineKey } from "@/lib/public-store/cart/line-key";
import {
  clampStoreCartQuantity,
  maxStoreCartQuantity,
} from "@/lib/public-store/cart/quantities";
import { parseStoreCartValidationRequest } from "@/lib/public-store/cart/schema";
import { computeStoreCartTotals, lineSubtotalMinor } from "@/lib/public-store/cart/totals";
import type {
  StoreCartIssue,
  StoreCartLineStatus,
  StoreCartValidatedLine,
  StoreCartValidationRequestItem,
  ValidatedStoreCart,
} from "@/lib/public-store/cart/types";
import { formatPublicPrice } from "@/lib/public-registration/ui/format";
import { STOREFRONT_VISIBLE_STATUS_LIST } from "@/lib/public-store/visibility";
import { isStoreCheckoutEnabled } from "@/lib/public-store/checkout/feature-flags";

function contributes(status: StoreCartLineStatus): boolean {
  return status === "valid" || status === "priceChanged" || status === "quantityAdjusted";
}

export async function validateStoreCartPayload(
  raw: unknown,
): Promise<
  | { ok: true; cart: ValidatedStoreCart }
  | { ok: false; status: number; error: string; issues: StoreCartIssue[] }
> {
  const parsed = parseStoreCartValidationRequest(raw);
  if (!parsed.ok) {
    return {
      ok: false,
      status: 400,
      error: parsed.error,
      issues: [{ code: "payload_rejected", message: parsed.error }],
    };
  }
  try {
    const cart = await validateStoreCartItems(parsed.items);
    return { ok: true, cart };
  } catch {
    return {
      ok: false,
      status: 503,
      error: "No se pudo validar el carrito. Reintentá en unos segundos.",
      issues: [
        {
          code: "server_error",
          message: "Error temporal al validar el carrito.",
        },
      ],
    };
  }
}

export async function validateStoreCartItems(
  items: StoreCartValidationRequestItem[],
): Promise<ValidatedStoreCart> {
  const productIds = [...new Set(items.map((i) => i.productId))];
  const products =
    productIds.length === 0
      ? []
      : await prisma.clickatonProduct.findMany({
          where: { id: { in: productIds } },
          select: {
            id: true,
            name: true,
            storeTitle: true,
            storeSlug: true,
            storePrice: true,
            storeCurrency: true,
            storeStatus: true,
            isActive: true,
            isStoreEnabled: true,
            primaryImageAssetId: true,
            variants: {
              select: {
                id: true,
                productId: true,
                name: true,
                code: true,
                stock: true,
                reservedStock: true,
                isActive: true,
              },
            },
          },
        });

  const productById = new Map(products.map((p) => [p.id, p]));
  const assetIds = products
    .map((p) => p.primaryImageAssetId)
    .filter((id): id is string => Boolean(id));
  const urlByAssetId = new Map<string, string>();
  if (assetIds.length > 0) {
    const assets = await prisma.dnxMediaAsset.findMany({
      where: { id: { in: assetIds } },
      select: { id: true, publicUrl: true },
    });
    for (const a of assets) {
      if (a.publicUrl?.trim()) urlByAssetId.set(a.id, a.publicUrl.trim());
    }
  }

  const lines: StoreCartValidatedLine[] = [];
  const issues: StoreCartIssue[] = [];

  for (const item of items) {
    const lineKey = storeCartLineKey(item.productId, item.variantId);
    const product = productById.get(item.productId);

    if (!product) {
      const line = hiddenLine(item, lineKey, "productHidden", "Este producto ya no está disponible.");
      lines.push(line);
      issues.push({
        code: "productHidden",
        message: line.messages[0]!,
        productId: item.productId,
        variantId: item.variantId,
        lineKey,
      });
      continue;
    }

    const publicOk =
      product.isActive &&
      product.isStoreEnabled &&
      STOREFRONT_VISIBLE_STATUS_LIST.includes(
        product.storeStatus as (typeof STOREFRONT_VISIBLE_STATUS_LIST)[number],
      ) &&
      product.storePrice != null &&
      product.storePrice >= 0 &&
      Boolean(product.storeSlug?.trim());

    if (!publicOk) {
      const line = hiddenLine(
        item,
        lineKey,
        "productHidden",
        "Este producto ya no está disponible en la tienda.",
        product,
        urlByAssetId,
      );
      lines.push(line);
      issues.push({
        code: "productHidden",
        message: line.messages[0]!,
        productId: item.productId,
        variantId: item.variantId,
        lineKey,
      });
      continue;
    }

    const displayName = (product.storeTitle?.trim() || product.name).trim();
    const slug = product.storeSlug!.trim();
    const unitPriceMinor = product.storePrice!;
    const currency = product.storeCurrency || "ARS";
    const imageUrl = product.primaryImageAssetId
      ? (urlByAssetId.get(product.primaryImageAssetId) ?? null)
      : null;

    const activeVariants = product.variants.filter((v) => v.isActive);
    const requiresVariant = activeVariants.length > 0;

    if (requiresVariant && !item.variantId) {
      const line = baseLine({
        item,
        lineKey,
        status: "variantMissing",
        messages: ["Elegí una opción (talle) para este producto."],
        unitPriceMinor,
        currency,
        availableStock: 0,
        maxQuantity: 0,
        product: {
          productId: product.id,
          slug,
          name: displayName,
          imageUrl,
          imageAlt: displayName,
          badge: storePageContent.badge,
        },
        variant: null,
      });
      lines.push(line);
      issues.push({
        code: "variantMissing",
        message: line.messages[0]!,
        productId: item.productId,
        variantId: null,
        lineKey,
      });
      continue;
    }

    const variant = item.variantId
      ? product.variants.find((v) => v.id === item.variantId) ?? null
      : null;

    if (item.variantId && !variant) {
      const line = baseLine({
        item,
        lineKey,
        status: "variantMissing",
        messages: ["La opción seleccionada ya no existe."],
        unitPriceMinor,
        currency,
        availableStock: 0,
        maxQuantity: 0,
        product: {
          productId: product.id,
          slug,
          name: displayName,
          imageUrl,
          imageAlt: displayName,
          badge: storePageContent.badge,
        },
        variant: null,
      });
      lines.push(line);
      issues.push({
        code: "variantMissing",
        message: line.messages[0]!,
        productId: item.productId,
        variantId: item.variantId,
        lineKey,
      });
      continue;
    }

    if (variant && !variant.isActive) {
      const line = baseLine({
        item,
        lineKey,
        status: "variantDisabled",
        messages: ["Esta opción ya no está disponible."],
        unitPriceMinor,
        currency,
        availableStock: 0,
        maxQuantity: 0,
        product: {
          productId: product.id,
          slug,
          name: displayName,
          imageUrl,
          imageAlt: displayName,
          badge: storePageContent.badge,
        },
        variant: {
          variantId: variant.id,
          name: variant.name,
          code: variant.code,
        },
      });
      lines.push(line);
      issues.push({
        code: "variantDisabled",
        message: line.messages[0]!,
        productId: item.productId,
        variantId: variant.id,
        lineKey,
      });
      continue;
    }

    const availableStock = variant
      ? publicAvailableStock(variant.stock, variant.reservedStock)
      : 0;

    // Producto simple sin variantes: stock no modelado por variante → no vendible en Etapa 04.
    if (!requiresVariant) {
      const line = baseLine({
        item,
        lineKey,
        status: "unavailable",
        messages: ["Este producto no tiene opciones disponibles para compra."],
        unitPriceMinor,
        currency,
        availableStock: 0,
        maxQuantity: 0,
        product: {
          productId: product.id,
          slug,
          name: displayName,
          imageUrl,
          imageAlt: displayName,
          badge: storePageContent.badge,
        },
        variant: null,
      });
      lines.push(line);
      issues.push({
        code: "unavailable",
        message: line.messages[0]!,
        productId: item.productId,
        variantId: item.variantId,
        lineKey,
      });
      continue;
    }

    if (product.storeStatus === "OUT_OF_STOCK" || availableStock <= 0) {
      const line = baseLine({
        item,
        lineKey,
        status: "outOfStock",
        messages: ["Sin stock disponible. Eliminá esta línea o esperá reposición."],
        unitPriceMinor,
        currency,
        availableStock: 0,
        maxQuantity: 0,
        product: {
          productId: product.id,
          slug,
          name: displayName,
          imageUrl,
          imageAlt: displayName,
          badge: storePageContent.badge,
        },
        variant: variant
          ? { variantId: variant.id, name: variant.name, code: variant.code }
          : null,
      });
      lines.push(line);
      issues.push({
        code: "outOfStock",
        message: line.messages[0]!,
        productId: item.productId,
        variantId: item.variantId,
        lineKey,
      });
      continue;
    }

    const maxQuantity = maxStoreCartQuantity(availableStock);
    const clamped = clampStoreCartQuantity({
      quantity: item.quantity,
      availableStock,
      maxPerLine: STORE_CART_MAX_QUANTITY_PER_LINE,
    });

    let status: StoreCartLineStatus = "valid";
    const messages: string[] = [];
    let quantity = clamped.quantity;

    if (!clamped.ok && clamped.reason === "above_stock") {
      status = "quantityAdjusted";
      quantity = clamped.quantity;
      messages.push(
        `Ajustamos la cantidad a ${quantity} por stock disponible (${availableStock}).`,
      );
    } else if (!clamped.ok && clamped.reason === "above_max") {
      status = "quantityAdjusted";
      quantity = clamped.quantity;
      messages.push(
        `Ajustamos la cantidad al máximo permitido (${STORE_CART_MAX_QUANTITY_PER_LINE}).`,
      );
    } else if (!clamped.ok) {
      status = "insufficientStock";
      quantity = clamped.quantity;
      messages.push("La cantidad solicitada no es válida.");
    }

    // Precio siempre canónico storePrice (nunca del cliente).
    // priceChanged se marca en cliente si había un precio previo distinto en UI.

    const line = baseLine({
      item: { ...item, quantity },
      lineKey,
      status,
      messages,
      unitPriceMinor,
      currency,
      availableStock,
      maxQuantity,
      product: {
        productId: product.id,
        slug,
        name: displayName,
        imageUrl,
        imageAlt: displayName,
        badge: storePageContent.badge,
      },
      variant: variant
        ? { variantId: variant.id, name: variant.name, code: variant.code }
        : null,
      requestedQuantity: item.quantity,
    });
    lines.push(line);
    if (status !== "valid") {
      issues.push({
        code: status,
        message: messages[0] ?? status,
        productId: item.productId,
        variantId: item.variantId,
        lineKey,
      });
    }
  }

  const currency = lines.find((l) => l.currency)?.currency ?? "ARS";
  const totals = computeStoreCartTotals(lines, currency);
  const allLinesOk =
    lines.length > 0 &&
    lines.every((l) => l.status === "valid" || l.status === "quantityAdjusted") &&
    totals.validLineCount > 0 &&
    totals.subtotalMinor > 0;

  return {
    validatedAt: new Date().toISOString(),
    currency,
    lines,
    totals,
    issues,
    checkoutReady: isStoreCheckoutEnabled() && allLinesOk && issues.length === 0,
  };
}

function baseLine(input: {
  item: StoreCartValidationRequestItem;
  lineKey: string;
  status: StoreCartLineStatus;
  messages: string[];
  unitPriceMinor: number;
  currency: string;
  availableStock: number;
  maxQuantity: number;
  product: StoreCartValidatedLine["product"];
  variant: StoreCartValidatedLine["variant"];
  requestedQuantity?: number;
}): StoreCartValidatedLine {
  const quantity = contributes(input.status) ? input.item.quantity : 0;
  const unit = contributes(input.status) ? input.unitPriceMinor : 0;
  return {
    lineKey: input.lineKey,
    productId: input.item.productId,
    variantId: input.item.variantId,
    quantity: contributes(input.status) ? input.item.quantity : input.item.quantity,
    requestedQuantity: input.requestedQuantity ?? input.item.quantity,
    status: input.status,
    contributesToSubtotal: contributes(input.status),
    unitPriceMinor: input.unitPriceMinor,
    currency: input.currency,
    lineSubtotalMinor: contributes(input.status)
      ? lineSubtotalMinor(unit, quantity)
      : 0,
    availableStock: input.availableStock,
    maxQuantity: input.maxQuantity,
    product: input.product,
    variant: input.variant,
    messages: input.messages,
  };
}

function hiddenLine(
  item: StoreCartValidationRequestItem,
  lineKey: string,
  status: StoreCartLineStatus,
  message: string,
  product?: {
    id: string;
    name: string;
    storeTitle: string | null;
    storeSlug: string | null;
    primaryImageAssetId: string | null;
  },
  urlByAssetId?: Map<string, string>,
): StoreCartValidatedLine {
  const name = product
    ? (product.storeTitle?.trim() || product.name).trim()
    : "Producto no disponible";
  return baseLine({
    item,
    lineKey,
    status,
    messages: [message],
    unitPriceMinor: 0,
    currency: "ARS",
    availableStock: 0,
    maxQuantity: 0,
    product: {
      productId: item.productId,
      slug: product?.storeSlug?.trim() || "",
      name,
      imageUrl:
        product?.primaryImageAssetId && urlByAssetId
          ? (urlByAssetId.get(product.primaryImageAssetId) ?? null)
          : null,
      imageAlt: name,
      badge: storePageContent.badge,
    },
    variant: null,
  });
}

/** Helper de display opcional (no usado en cálculo). */
export function formatValidatedLinePrice(line: StoreCartValidatedLine): string {
  return formatPublicPrice(line.unitPriceMinor, line.currency);
}
