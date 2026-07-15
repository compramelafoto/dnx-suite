/**
 * Shared enums and branded primitives for DNX Payments.
 */

export type ProductId =
  | "compramelafoto"
  | "infospot"
  | "fotorank"
  | "clickaton"
  | "fotooffice"
  | "dnx";

export type PaymentEnvironment = "sandbox" | "production";

export type CurrencyCode = "ARS" | "BRL" | "USD" | "MXN" | "CLP" | "UYU";

export type RecipientRole =
  | "PLATFORM"
  | "PHOTOGRAPHER"
  | "ORGANIZER"
  | "LAB"
  | "INFOSPOT_EDITOR"
  | "REFERRAL"
  | "AMBASSADOR"
  | "DELEGATE"
  | "SPONSOR"
  | "AFFILIATE"
  | "OTHER";

export type PaymentIntentKind =
  | "PHOTO_PURCHASE"
  | "PRINT_ORDER"
  | "PRECOMPRA"
  | "CONTEST_ENTRY"
  | "MARATHON_ENTRY"
  | "ATTRIBUTED_SALE"
  | "MARKETPLACE_SALE"
  | "COURSE_ENROLLMENT"
  | "OTHER";

/** Marker for decisions blocked on Mercado Pago official answers. */
export type WaitingMpConfirmation = "WAITING_MP_CONFIRMATION";

export type ProviderName =
  | "mercadopago"
  | "mercadopago_preferences_legacy"
  | "stripe"
  | "paypal"
  | "transfer"
  | "manual"
  | "other";
