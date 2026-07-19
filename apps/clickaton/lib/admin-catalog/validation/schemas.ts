import { normalizeCatalogCode, normalizeSku } from "../domain/codes";
import { CatalogValidationError } from "../domain/errors";
import {
  normalizeCurrency,
  parseMinorUnits,
  parseOptionalMinorUnits,
} from "../domain/money";
import type { TicketTypeItemInput } from "../domain/types";

const HOLD_MIN = 5;
const HOLD_MAX = 120;

function requireString(value: unknown, field: string, maxLen: number): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new CatalogValidationError({ [field]: "Campo obligatorio." });
  }
  const t = value.trim();
  if (t.length > maxLen) {
    throw new CatalogValidationError({ [field]: `Máximo ${maxLen} caracteres.` });
  }
  return t;
}

function optionalString(value: unknown, field: string, maxLen: number): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") {
    throw new CatalogValidationError({ [field]: "Texto inválido." });
  }
  const t = value.trim();
  if (t.length > maxLen) {
    throw new CatalogValidationError({ [field]: `Máximo ${maxLen} caracteres.` });
  }
  return t || null;
}

function parseDate(value: unknown, field: string): Date | null {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === "string") {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) {
      throw new CatalogValidationError({ [field]: "Fecha inválida." });
    }
    return d;
  }
  throw new CatalogValidationError({ [field]: "Fecha inválida." });
}

function parseCapacity(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") {
    if (!Number.isInteger(value) || value < 1) {
      throw new CatalogValidationError({
        capacity: "Capacidad debe ser entera ≥ 1, o vacía (ilimitada).",
      });
    }
    return value;
  }
  if (typeof value === "string" && /^\d+$/.test(value.trim())) {
    const n = Number.parseInt(value.trim(), 10);
    if (n < 1) {
      throw new CatalogValidationError({ capacity: "Capacidad debe ser ≥ 1." });
    }
    return n;
  }
  throw new CatalogValidationError({ capacity: "Capacidad inválida." });
}

function parseHoldMinutes(value: unknown): number {
  const raw = value === undefined || value === null || value === "" ? 20 : value;
  if (typeof raw === "number" && Number.isInteger(raw)) {
    if (raw < HOLD_MIN || raw > HOLD_MAX) {
      throw new CatalogValidationError({
        holdMinutes: `Hold entre ${HOLD_MIN} y ${HOLD_MAX} minutos.`,
      });
    }
    return raw;
  }
  if (typeof raw === "string" && /^\d+$/.test(raw.trim())) {
    return parseHoldMinutes(Number.parseInt(raw.trim(), 10));
  }
  throw new CatalogValidationError({ holdMinutes: "holdMinutes inválido." });
}

export function parseTicketTypeItems(raw: unknown): TicketTypeItemInput[] {
  if (!Array.isArray(raw)) {
    throw new CatalogValidationError({ items: "Composición inválida." });
  }
  const seen = new Set<string>();
  return raw.map((item, idx) => {
    if (!item || typeof item !== "object") {
      throw new CatalogValidationError({ items: `Ítem ${idx} inválido.` });
    }
    const row = item as Record<string, unknown>;
    const productId = requireString(row.productId, `items.${idx}.productId`, 64);
    const productVariantId =
      row.productVariantId === null || row.productVariantId === undefined || row.productVariantId === ""
        ? null
        : requireString(row.productVariantId, `items.${idx}.productVariantId`, 64);
    const quantity =
      typeof row.quantity === "number" && Number.isInteger(row.quantity) && row.quantity >= 1
        ? row.quantity
        : typeof row.quantity === "string" && /^\d+$/.test(row.quantity)
          ? Number.parseInt(row.quantity, 10)
          : NaN;
    if (!Number.isInteger(quantity) || quantity < 1) {
      throw new CatalogValidationError({ [`items.${idx}.quantity`]: "Cantidad ≥ 1." });
    }
    const requiresVariantChoice = Boolean(row.requiresVariantChoice);
    if (requiresVariantChoice && productVariantId) {
      throw new CatalogValidationError({
        [`items.${idx}`]: "Si requiere selección de variante, no fijes productVariantId.",
      });
    }
    if (!requiresVariantChoice && !productVariantId) {
      // Allowed for non-merch included products without variants — OK
    }
    const key = `${productId}:${productVariantId ?? "*"}`;
    if (seen.has(productId)) {
      throw new CatalogValidationError({
        items: `Producto duplicado en composición: ${productId}`,
      });
    }
    seen.add(productId);
    void key;
    return { productId, productVariantId, quantity, requiresVariantChoice };
  });
}

export type TicketTypeCreateInput = {
  editionId: string;
  venueId?: string | null;
  name: string;
  description?: string | null;
  code: string;
  priceAmount: unknown;
  currency?: unknown;
  capacity?: unknown;
  holdMinutes?: unknown;
  isActive?: boolean;
  salesStartAt?: unknown;
  salesEndAt?: unknown;
  items?: unknown;
};

export function parseTicketTypeCreate(input: TicketTypeCreateInput) {
  const editionId = requireString(input.editionId, "editionId", 64);
  const venueId =
    input.venueId === null || input.venueId === undefined || input.venueId === ""
      ? null
      : requireString(input.venueId, "venueId", 64);
  const name = requireString(input.name, "name", 120);
  const description = optionalString(input.description, "description", 2000);
  const code = normalizeCatalogCode(requireString(input.code, "code", 64));
  const priceAmount = parseMinorUnits(input.priceAmount);
  const currency = normalizeCurrency(input.currency ?? "ARS");
  const capacity = parseCapacity(input.capacity);
  const holdMinutes = parseHoldMinutes(input.holdMinutes);
  const isActive = input.isActive !== false;
  const salesStartAt = parseDate(input.salesStartAt, "salesStartAt");
  const salesEndAt = parseDate(input.salesEndAt, "salesEndAt");
  if (salesStartAt && salesEndAt && salesEndAt.getTime() < salesStartAt.getTime()) {
    throw new CatalogValidationError({
      salesEndAt: "La fecha de cierre debe ser posterior o igual al inicio.",
    });
  }
  const items = input.items === undefined ? [] : parseTicketTypeItems(input.items);
  return {
    editionId,
    venueId,
    name,
    description,
    code,
    priceAmount,
    currency,
    capacity,
    holdMinutes,
    isActive,
    salesStartAt,
    salesEndAt,
    items,
  };
}

export function parseTicketTypeUpdate(input: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  if ("name" in input) out.name = requireString(input.name, "name", 120);
  if ("description" in input) out.description = optionalString(input.description, "description", 2000);
  if ("code" in input) out.code = normalizeCatalogCode(requireString(input.code, "code", 64));
  if ("priceAmount" in input) out.priceAmount = parseMinorUnits(input.priceAmount);
  if ("currency" in input) out.currency = normalizeCurrency(input.currency);
  if ("capacity" in input) out.capacity = parseCapacity(input.capacity);
  if ("holdMinutes" in input) out.holdMinutes = parseHoldMinutes(input.holdMinutes);
  if ("venueId" in input) {
    out.venueId =
      input.venueId === null || input.venueId === ""
        ? null
        : requireString(input.venueId, "venueId", 64);
  }
  if ("isActive" in input) out.isActive = Boolean(input.isActive);
  if ("salesStartAt" in input) out.salesStartAt = parseDate(input.salesStartAt, "salesStartAt");
  if ("salesEndAt" in input) out.salesEndAt = parseDate(input.salesEndAt, "salesEndAt");
  const start = (out.salesStartAt as Date | null | undefined) ?? undefined;
  const end = (out.salesEndAt as Date | null | undefined) ?? undefined;
  if (start && end && end.getTime() < start.getTime()) {
    throw new CatalogValidationError({
      salesEndAt: "La fecha de cierre debe ser posterior o igual al inicio.",
    });
  }
  return out;
}

export function parseProductCreate(input: {
  editionId: string;
  name: string;
  description?: string | null;
  code: string;
  isActive?: boolean;
}) {
  return {
    editionId: requireString(input.editionId, "editionId", 64),
    name: requireString(input.name, "name", 120),
    description: optionalString(input.description, "description", 2000),
    code: normalizeCatalogCode(requireString(input.code, "code", 64)),
    isActive: input.isActive !== false,
  };
}

export function parseProductUpdate(input: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  if ("name" in input) out.name = requireString(input.name, "name", 120);
  if ("description" in input) out.description = optionalString(input.description, "description", 2000);
  if ("code" in input) out.code = normalizeCatalogCode(requireString(input.code, "code", 64));
  if ("isActive" in input) out.isActive = Boolean(input.isActive);
  return out;
}

export function parseVariantCreate(input: {
  productId: string;
  code: string;
  name: string;
  sku: string;
  stock?: unknown;
  priceAmount?: unknown;
  currency?: unknown;
  isActive?: boolean;
}) {
  const priceAmount = parseOptionalMinorUnits(input.priceAmount);
  let currency: "ARS" | null = null;
  if (priceAmount != null) {
    currency = normalizeCurrency(input.currency ?? "ARS");
  } else if (input.currency != null && input.currency !== "") {
    throw new CatalogValidationError({
      currency: "Moneda solo se admite si hay precio.",
    });
  }
  const stockRaw = input.stock === undefined || input.stock === "" ? 0 : input.stock;
  const stock = parseMinorUnits(stockRaw, "stock"); // reuse int≥0 parser name is misleading but works
  return {
    productId: requireString(input.productId, "productId", 64),
    code: normalizeCatalogCode(requireString(input.code, "code", 64)),
    name: requireString(input.name, "name", 80),
    sku: normalizeSku(requireString(input.sku, "sku", 80)),
    stock,
    priceAmount,
    currency,
    isActive: input.isActive !== false,
  };
}

export function parseVariantUpdate(input: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  if ("name" in input) out.name = requireString(input.name, "name", 80);
  if ("code" in input) out.code = normalizeCatalogCode(requireString(input.code, "code", 64));
  if ("sku" in input) out.sku = normalizeSku(requireString(input.sku, "sku", 80));
  if ("stock" in input) out.stock = parseMinorUnits(input.stock, "stock");
  if ("priceAmount" in input || "currency" in input) {
    const priceAmount =
      "priceAmount" in input ? parseOptionalMinorUnits(input.priceAmount) : undefined;
    if (priceAmount !== undefined) {
      out.priceAmount = priceAmount;
      if (priceAmount == null) {
        out.currency = null;
      } else {
        out.currency = normalizeCurrency(input.currency ?? "ARS");
      }
    }
  }
  if ("isActive" in input) out.isActive = Boolean(input.isActive);
  return out;
}

export function parseStockAdjustment(input: {
  variantId: string;
  newStock?: unknown;
  delta?: unknown;
  reason: string;
  requestId?: string | null;
}) {
  const variantId = requireString(input.variantId, "variantId", 64);
  const reason = requireString(input.reason, "reason", 500);
  let mode: "absolute" | "delta";
  let value: number;
  if (input.newStock !== undefined && input.newStock !== null && input.newStock !== "") {
    mode = "absolute";
    value = parseMinorUnits(input.newStock, "newStock");
  } else if (input.delta !== undefined && input.delta !== null && input.delta !== "") {
    mode = "delta";
    if (typeof input.delta === "number" && Number.isInteger(input.delta)) {
      value = input.delta;
    } else if (typeof input.delta === "string" && /^-?\d+$/.test(input.delta.trim())) {
      value = Number.parseInt(input.delta.trim(), 10);
    } else {
      throw new CatalogValidationError({ delta: "Delta debe ser entero." });
    }
  } else {
    throw new CatalogValidationError({ newStock: "Indicá newStock o delta." });
  }
  return {
    variantId,
    mode,
    value,
    reason,
    requestId: optionalString(input.requestId, "requestId", 120),
  };
}
