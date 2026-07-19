/**
 * Reglas de validación de diseño (no Zod productivo todavía).
 */

export const TICKET_TYPE_RULES = {
  name: { required: true, maxLen: 120 },
  code: {
    required: true,
    normalize: "UPPER_SNAKE_OR_ALNUM",
    uniqueWithin: "editionId",
  },
  priceAmount: { type: "int", min: 0, forbidFloat: true },
  currency: { required: true, allowlist: ["ARS"] as const },
  capacity: { type: "int_or_null", min: 1, nullMeans: "unlimited" },
  holdMinutes: { type: "int", min: 5, max: 120, default: 20 },
  salesEndAt: { mustBeAfterOrEqual: "salesStartAt" },
  venueId: { optional: true, mustBelongTo: "editionId" },
  description: { optional: true, maxLen: 2000 },
} as const;

export const PRODUCT_RULES = {
  name: { required: true, maxLen: 120 },
  code: {
    required: true,
    normalize: "UPPER_SNAKE_OR_ALNUM",
    uniqueWithin: "editionId",
  },
  editionId: { required: true },
  description: { optional: true, maxLen: 2000 },
} as const;

export const VARIANT_RULES = {
  name: { required: true, maxLen: 80 },
  code: { required: true, uniqueWithin: "productId" },
  sku: { required: true, uniqueGlobal: true },
  stock: { type: "int", min: 0, forbidFloat: true },
  priceAmount: { type: "int_or_null", min: 0 },
  currency: { requiredIf: "priceAmount != null", allowlist: ["ARS"] as const },
  productEditionConsistency: true,
} as const;

export const TICKET_TYPE_ITEM_RULES = {
  quantity: { type: "int", min: 1 },
  productSameEdition: true,
  variantBelongsToProduct: true,
  noDuplicateProductOnTicket: true,
  requiresVariantChoice: {
    whenTrue: "productVariantId must be null",
    whenFalseWithVariant: "productVariantId set = fixed variant",
    whenFalseWithoutVariant: "invalid for selectable merch MVP",
  },
} as const;

export type EditGate =
  | "allowed"
  | "warn"
  | "block"
  | "duplicate_instead";

export const TICKET_FIELD_GATES: Record<
  string,
  { noRegs: EditGate; draftOrPending: EditGate; confirmed: EditGate }
> = {
  name: { noRegs: "allowed", draftOrPending: "warn", confirmed: "warn" },
  description: { noRegs: "allowed", draftOrPending: "allowed", confirmed: "allowed" },
  code: { noRegs: "allowed", draftOrPending: "block", confirmed: "block" },
  priceAmount: { noRegs: "allowed", draftOrPending: "warn", confirmed: "block" },
  currency: { noRegs: "allowed", draftOrPending: "block", confirmed: "block" },
  capacity: { noRegs: "allowed", draftOrPending: "warn", confirmed: "warn" },
  holdMinutes: { noRegs: "allowed", draftOrPending: "warn", confirmed: "warn" },
  salesStartAt: { noRegs: "allowed", draftOrPending: "warn", confirmed: "warn" },
  salesEndAt: { noRegs: "allowed", draftOrPending: "warn", confirmed: "warn" },
  venueId: { noRegs: "allowed", draftOrPending: "block", confirmed: "block" },
  composition: { noRegs: "allowed", draftOrPending: "warn", confirmed: "block" },
  isActive: { noRegs: "allowed", draftOrPending: "warn", confirmed: "warn" },
};
