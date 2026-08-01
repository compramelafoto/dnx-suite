/**
 * Canonical Mercado Pago Split 1:N Orders constraints.
 * Keep provider limits here — do not scatter magic numbers.
 */

/** MP Split Payments 1:N: maximum secondary sellers (partners) per Order. */
export const MERCADO_PAGO_SPLIT_1N_MAX_PARTNERS = 10 as const;

/**
 * Preferred strategy when mapping calculated distributions to MP Orders:
 * commercial rules may be % internally; amounts are calculated then sent as fixed.
 * Use `infer_from_rules` only for explicit backwards-compatible paths.
 */
export type MpSplitAmountTypeStrategy = "fixed_preferred" | "infer_from_rules";

export const DEFAULT_MP_SPLIT_AMOUNT_TYPE_STRATEGY: MpSplitAmountTypeStrategy =
  "fixed_preferred";

/** MP statement_descriptor practical length (card statement / extract). */
export const MERCADO_PAGO_STATEMENT_DESCRIPTOR_MAX_LENGTH = 22 as const;

/** Title length bound for intangible items (antifraud / Orders). */
export const MERCADO_PAGO_ORDER_ITEM_TITLE_MAX_LENGTH = 256 as const;

/**
 * Device/session placeholders that must never reach live create unless
 * `allowTestFixtures` is explicitly enabled (unit/CLI dry fixtures).
 */
export const MERCADO_PAGO_FORBIDDEN_DEVICE_SESSION_PLACEHOLDERS = [
  "MISSING_DEVICE",
  "DEVICE_PRESENT",
  "TEST_DEVICE_SESSION_10D3I_E",
] as const;
