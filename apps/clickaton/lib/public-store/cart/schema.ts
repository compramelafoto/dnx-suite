import {
  STORE_CART_MAX_LINES,
  STORE_CART_MAX_QUANTITY_PER_LINE,
  STORE_CART_PLATFORM,
  STORE_CART_SCHEMA_VERSION,
  STORE_CART_VALIDATE_MAX_ITEMS,
} from "@/lib/public-store/cart/constants";
import { storeCartLineKey } from "@/lib/public-store/cart/line-key";
import { clampStoreCartQuantity } from "@/lib/public-store/cart/quantities";
import type {
  StoreCartItem,
  StoreCartPersistedState,
  StoreCartValidationRequestItem,
} from "@/lib/public-store/cart/types";

const ID_RE = /^[a-zA-Z0-9_-]{8,64}$/;

export function isStoreCartId(value: unknown): value is string {
  return typeof value === "string" && ID_RE.test(value.trim());
}

function normalizeVariantId(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!ID_RE.test(trimmed)) return null;
  return trimmed;
}

/**
 * Parsea y saneá el envelope de localStorage.
 * Ante corrupción → carrito vacío (no rompe la app).
 */
export function parsePersistedStoreCart(raw: unknown): {
  state: StoreCartPersistedState;
  recovered: boolean;
} {
  const empty: StoreCartPersistedState = {
    version: STORE_CART_SCHEMA_VERSION,
    platform: STORE_CART_PLATFORM,
    items: [],
    updatedAt: new Date(0).toISOString(),
  };

  if (!raw || typeof raw !== "object") {
    return { state: empty, recovered: true };
  }

  const obj = raw as Record<string, unknown>;
  if (obj.version !== STORE_CART_SCHEMA_VERSION) {
    return { state: empty, recovered: true };
  }
  if (obj.platform !== STORE_CART_PLATFORM) {
    return { state: empty, recovered: true };
  }
  if (!Array.isArray(obj.items)) {
    return { state: empty, recovered: true };
  }

  const seen = new Set<string>();
  const items: StoreCartItem[] = [];
  let recovered = false;

  for (const entry of obj.items.slice(0, STORE_CART_MAX_LINES)) {
    if (!entry || typeof entry !== "object") {
      recovered = true;
      continue;
    }
    const row = entry as Record<string, unknown>;
    if (!isStoreCartId(row.productId)) {
      recovered = true;
      continue;
    }
    const productId = row.productId.trim();
    const variantId = normalizeVariantId(row.variantId);
    if (row.variantId != null && row.variantId !== "" && variantId == null) {
      recovered = true;
      continue;
    }
    const clamped = clampStoreCartQuantity({
      quantity: row.quantity,
      maxPerLine: STORE_CART_MAX_QUANTITY_PER_LINE,
    });
    if (!clamped.ok && clamped.reason === "invalid") {
      recovered = true;
      continue;
    }
    const quantity = clamped.ok
      ? clamped.quantity
      : Math.max(1, Math.min(STORE_CART_MAX_QUANTITY_PER_LINE, clamped.quantity));
    if (!clamped.ok) recovered = true;

    const lineKey = storeCartLineKey(productId, variantId);
    if (seen.has(lineKey)) {
      // Merge duplicados en persistencia corrupta.
      const existing = items.find((i) => i.lineKey === lineKey);
      if (existing) {
        const merged = clampStoreCartQuantity({
          quantity: existing.quantity + quantity,
        });
        existing.quantity = merged.quantity;
      }
      recovered = true;
      continue;
    }
    seen.add(lineKey);

    const addedAt =
      typeof row.addedAt === "string" && row.addedAt.trim()
        ? row.addedAt
        : new Date().toISOString();

    items.push({
      productId,
      variantId,
      quantity,
      addedAt,
      lineKey,
    });
  }

  if (obj.items.length > STORE_CART_MAX_LINES) recovered = true;

  const updatedAt =
    typeof obj.updatedAt === "string" && obj.updatedAt.trim()
      ? obj.updatedAt
      : new Date().toISOString();

  return {
    state: {
      version: STORE_CART_SCHEMA_VERSION,
      platform: STORE_CART_PLATFORM,
      items: items.map(({ productId, variantId, quantity, addedAt }) => ({
        productId,
        variantId,
        quantity,
        addedAt,
      })),
      updatedAt,
    },
    recovered,
  };
}

export function toStoreCartItems(
  persisted: StoreCartPersistedState,
): StoreCartItem[] {
  return persisted.items.map((item) => ({
    ...item,
    lineKey: storeCartLineKey(item.productId, item.variantId),
  }));
}

/**
 * Parsea payload de validación (cliente → servidor).
 * Rechaza payloads abusivos.
 */
export function parseStoreCartValidationRequest(raw: unknown): {
  ok: true;
  items: StoreCartValidationRequestItem[];
} | {
  ok: false;
  error: string;
} {
  if (!raw || typeof raw !== "object") {
    return { ok: false, error: "Payload inválido." };
  }
  const itemsRaw = (raw as Record<string, unknown>).items;
  if (!Array.isArray(itemsRaw)) {
    return { ok: false, error: "items debe ser un array." };
  }
  if (itemsRaw.length > STORE_CART_VALIDATE_MAX_ITEMS) {
    return {
      ok: false,
      error: `Máximo ${STORE_CART_VALIDATE_MAX_ITEMS} ítems por validación.`,
    };
  }

  const items: StoreCartValidationRequestItem[] = [];
  for (const entry of itemsRaw) {
    if (!entry || typeof entry !== "object") {
      return { ok: false, error: "Ítem inválido." };
    }
    const row = entry as Record<string, unknown>;
    if (!isStoreCartId(row.productId)) {
      return { ok: false, error: "productId inválido." };
    }
    const variantId = normalizeVariantId(row.variantId);
    if (row.variantId != null && row.variantId !== "" && variantId == null) {
      return { ok: false, error: "variantId inválido." };
    }
    const clamped = clampStoreCartQuantity({ quantity: row.quantity });
    if (!clamped.ok && (clamped.reason === "invalid" || clamped.reason === "not_integer")) {
      return { ok: false, error: "quantity inválida." };
    }
    items.push({
      productId: row.productId.trim(),
      variantId,
      quantity: clamped.quantity,
    });
  }

  return { ok: true, items };
}
