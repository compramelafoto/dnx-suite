/**
 * Contratos de diseño 10D1 — inscripción / QR / check-in / kit.
 * Solo tipos: no persisten, no tocan Neon, no generan migración.
 *
 * Refinamiento 10D2 (persistencia):
 * - Estados de pago viven en `ClickatonPaymentStatus` (ver domain/types).
 * - `ClickatonKit` / `ClickatonKitItem` → `ClickatonTicketTypeItem` (productos incluidos en ticket).
 * - Este archivo conserva el vocabulario de diseño 10D1 para selfcheck y auditoría.
 */

/** Ciclo de vida comercial de la inscripción (sin mezclar check-in ni kit). */
export type ClickatonRegistrationStatus =
  | "DRAFT"
  | "PENDING_PAYMENT"
  | "PAYMENT_PROCESSING"
  | "CONFIRMED"
  | "PAYMENT_FAILED"
  | "PAYMENT_EXPIRED"
  | "CANCELLED"
  | "REFUNDED"
  | "TRANSFER_PENDING_REVIEW"
  | "TRANSFER_REJECTED"
  | "WAITLISTED"
  | "DISQUALIFIED";

/** Check-in presencial (entidad separada). */
export type ClickatonCheckInStatus = "NOT_CHECKED_IN" | "CHECKED_IN" | "REVERTED";

/** Entrega de merchandising (entidad separada del check-in). */
export type ClickatonKitDeliveryStatus =
  | "NOT_APPLICABLE"
  | "PENDING"
  | "PARTIAL"
  | "DELIVERED"
  | "REVERTED";

export type ClickatonQrStrategy = "OPAQUE_TOKEN";

export type ClickatonVisibleCodeFormat = {
  /** Prefijo de edición (ej. COR26). */
  editionPrefix: string;
  /** Ancho mínimo del secuencial (zero-padded). */
  sequenceWidth: number;
  /** Ejemplo conceptual: COR26-00428 — no es PK. */
  example: "COR26-00428";
};

/** Payload del QR: nunca PII. Lookup server-side por token opaco. */
export type ClickatonQrPayload = {
  strategy: ClickatonQrStrategy;
  /** Token aleatorio (≥128 bits), único, revocable. */
  token: string;
  /** Opcional: URL de deep-link sin PII, ej. https://…/a/{token} */
  url?: string;
};

export type ClickatonRegistrationDesignEntity =
  | "ClickatonTicketType"
  | "ClickatonProduct"
  | "ClickatonProductVariant"
  | "ClickatonTicketTypeItem"
  | "ClickatonRegistration"
  | "ClickatonRegistrationItem"
  | "ClickatonRegistrationStatusHistory"
  | "ClickatonParticipantCredential"
  | "ClickatonQrToken"
  | "ClickatonCheckIn"
  | "ClickatonKitDelivery"
  | "ClickatonKitDeliveryItem"
  | "ClickatonRegistrationAudit"
  | "ClickatonCapacityHold"
  | "ClickatonStockHold"
  | "ClickatonEditionSequence";

export const CLICKATON_REGISTRATION_MVP_ENTITIES: readonly ClickatonRegistrationDesignEntity[] =
  [
    "ClickatonTicketType",
    "ClickatonProduct",
    "ClickatonProductVariant",
    "ClickatonTicketTypeItem",
    "ClickatonRegistration",
    "ClickatonRegistrationItem",
    "ClickatonRegistrationStatusHistory",
    "ClickatonParticipantCredential",
    "ClickatonQrToken",
    "ClickatonCheckIn",
    "ClickatonKitDelivery",
    "ClickatonRegistrationAudit",
    "ClickatonCapacityHold",
    "ClickatonStockHold",
    "ClickatonEditionSequence",
  ] as const;

export type ClickatonAdminCapability =
  | "edition.configure"
  | "pricing.manage"
  | "registration.read"
  | "registration.mutate_exceptional"
  | "payment.read"
  | "payment.refund"
  | "checkin.perform"
  | "checkin.revert"
  | "kit.deliver"
  | "kit.revert"
  | "reports.read"
  | "exports.pii";

export type ClickatonOperatorRole =
  | "ADMIN_GENERAL"
  | "ACCREDITATION_OPERATOR"
  | "KIT_OPERATOR"
  | "AUDITOR_PARTNER";

export const CLICKATON_ROLE_CAPABILITIES: Record<
  ClickatonOperatorRole,
  readonly ClickatonAdminCapability[]
> = {
  ADMIN_GENERAL: [
    "edition.configure",
    "pricing.manage",
    "registration.read",
    "registration.mutate_exceptional",
    "payment.read",
    "payment.refund",
    "checkin.perform",
    "checkin.revert",
    "kit.deliver",
    "kit.revert",
    "reports.read",
    "exports.pii",
  ],
  ACCREDITATION_OPERATOR: [
    "registration.read",
    "checkin.perform",
    "checkin.revert",
  ],
  KIT_OPERATOR: ["registration.read", "kit.deliver", "kit.revert"],
  AUDITOR_PARTNER: ["registration.read", "payment.read", "reports.read"],
};

/** Transiciones de inscripción (pago / confirmación). Check-in y kit viven aparte. */
export type RegistrationTransition = {
  from: ClickatonRegistrationStatus | "*";
  action: string;
  to: ClickatonRegistrationStatus;
  actor: "participant" | "system" | "admin" | "payments_webhook";
  reversible: boolean;
};

export const REGISTRATION_TRANSITIONS: readonly RegistrationTransition[] = [
  { from: "DRAFT", action: "submit_checkout", to: "PENDING_PAYMENT", actor: "participant", reversible: true },
  { from: "DRAFT", action: "confirm_free_or_courtesy", to: "CONFIRMED", actor: "system", reversible: false },
  { from: "PENDING_PAYMENT", action: "provider_processing", to: "PAYMENT_PROCESSING", actor: "payments_webhook", reversible: false },
  { from: "PENDING_PAYMENT", action: "mark_paid", to: "CONFIRMED", actor: "payments_webhook", reversible: false },
  { from: "PAYMENT_PROCESSING", action: "mark_paid", to: "CONFIRMED", actor: "payments_webhook", reversible: false },
  { from: "PENDING_PAYMENT", action: "expire_hold", to: "PAYMENT_EXPIRED", actor: "system", reversible: false },
  { from: "PENDING_PAYMENT", action: "fail", to: "PAYMENT_FAILED", actor: "payments_webhook", reversible: false },
  { from: "PENDING_PAYMENT", action: "cancel", to: "CANCELLED", actor: "participant", reversible: false },
  { from: "CONFIRMED", action: "refund", to: "REFUNDED", actor: "admin", reversible: false },
  { from: "CONFIRMED", action: "cancel_admin", to: "CANCELLED", actor: "admin", reversible: false },
  { from: "CONFIRMED", action: "disqualify", to: "DISQUALIFIED", actor: "admin", reversible: true },
  { from: "PENDING_PAYMENT", action: "transfer_submitted", to: "TRANSFER_PENDING_REVIEW", actor: "participant", reversible: false },
  { from: "TRANSFER_PENDING_REVIEW", action: "transfer_approve", to: "CONFIRMED", actor: "admin", reversible: false },
  { from: "TRANSFER_PENDING_REVIEW", action: "transfer_reject", to: "TRANSFER_REJECTED", actor: "admin", reversible: false },
  { from: "DRAFT", action: "waitlist", to: "WAITLISTED", actor: "system", reversible: true },
] as const;
