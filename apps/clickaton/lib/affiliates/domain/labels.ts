/**
 * Textos de los estados de afiliados y comisiones, para el panel y Mi cuenta.
 *
 * Los tipos se declaran acá (y no se importan de Prisma) para que el dominio
 * siga siendo puro; coinciden con los enums del esquema.
 */

export type AffiliateCommissionStatus =
  | "PENDING"
  | "PAID_BY_SPLIT"
  | "OWED"
  | "PAID_OUT"
  | "REVERSED";

export type AffiliateCommissionMode = "SPLIT" | "MANUAL";

/** Estado de la vinculación del fotógrafo con Mercado Pago (Split 1:N). */
export type AffiliateConsentStatus =
  | "NONE"
  | "PENDING"
  | "ACTIVE"
  | "REJECTED"
  | "CANCELED"
  | "EXPIRED";

export const COMMISSION_STATUS_LABELS: Record<AffiliateCommissionStatus, string> = {
  PENDING: "Reservada (falta el pago)",
  PAID_BY_SPLIT: "Cobrada en el mismo pago",
  OWED: "A transferir",
  PAID_OUT: "Transferida",
  REVERSED: "Anulada",
};

export const COMMISSION_MODE_LABELS: Record<AffiliateCommissionMode, string> = {
  SPLIT: "Reparto automático (Mercado Pago)",
  MANUAL: "Transferencia a mano",
};

export const CONSENT_STATUS_LABELS: Record<AffiliateConsentStatus, string> = {
  NONE: "Sin invitar",
  PENDING: "Invitación enviada, falta aceptar",
  ACTIVE: "Vinculado: cobra en el mismo pago",
  REJECTED: "Rechazó la invitación",
  CANCELED: "Vinculación cancelada",
  EXPIRED: "La invitación venció",
};

const CONSENT_STATUSES = Object.keys(CONSENT_STATUS_LABELS) as AffiliateConsentStatus[];

/**
 * Normaliza el estado guardado (columna de texto). Lo que no se reconoce se
 * trata como pendiente: nunca como activo.
 */
export function normalizeAffiliateConsentStatus(
  raw: string | null | undefined,
): AffiliateConsentStatus {
  if (!raw) return "NONE";
  const upper = raw.trim().toUpperCase();
  if (upper.length === 0) return "NONE";
  return (CONSENT_STATUSES as string[]).includes(upper)
    ? (upper as AffiliateConsentStatus)
    : "PENDING";
}

export function commissionStatusLabel(status: string): string {
  return COMMISSION_STATUS_LABELS[status as AffiliateCommissionStatus] ?? status;
}

export function consentStatusLabel(status: string | null | undefined): string {
  return CONSENT_STATUS_LABELS[normalizeAffiliateConsentStatus(status)];
}

/** Puntos básicos a texto: 1000 → "10%", 1250 → "12,5%". */
export function formatCommissionBps(bps: number): string {
  const percent = bps / 100;
  return `${percent.toLocaleString("es-AR", { maximumFractionDigits: 2 })}%`;
}
