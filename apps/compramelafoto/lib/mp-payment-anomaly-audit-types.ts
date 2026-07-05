import type { OrderAuditEventType } from "@/lib/antifraud/audit";

/** Eventos de OrderAuditLog que la vista admin de anomalías MP/preventa prioriza */
export const MP_PAYMENT_ANOMALY_AUDIT_EVENT_TYPES: readonly OrderAuditEventType[] = [
  "REDEEM_BLOCKED_STALE_PAYMENT",
  "PAYMENT_REVERSED_AFTER_REDEEM",
  "MP_RECONCILIATION_ALBUM_PAID_CORRECTED",
  "MP_RECONCILIATION_PRECOMPRA_INSPECTED",
  "MP_RECONCILIATION_ENTITLEMENT_VOIDED",
  "MP_RECONCILIATION_PRECOMPRA_NO_MP_PAYMENT",
  "MP_RECONCILIATION_ALBUM_FAILED_RECOVERED",
] as const;
