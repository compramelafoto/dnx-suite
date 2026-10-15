/**
 * Ayudas de presentación para el panel de afiliados, comisiones y Mi cuenta.
 * Puras: no tocan la base ni Next.
 */

import {
  normalizeAffiliateConsentStatus,
  type AffiliateCommissionStatus,
  type AffiliateConsentStatus,
} from "../domain/labels";

export type BadgeVariant = "neutral" | "brand" | "accent" | "success" | "warning" | "danger";

/** Orden en que se muestran los totales. */
export const COMMISSION_STATUS_ORDER: readonly AffiliateCommissionStatus[] = [
  "PENDING",
  "PAID_BY_SPLIT",
  "OWED",
  "PAID_OUT",
  "REVERSED",
];

export const COMMISSION_STATUS_BADGE: Record<AffiliateCommissionStatus, BadgeVariant> = {
  PENDING: "neutral",
  PAID_BY_SPLIT: "success",
  OWED: "warning",
  PAID_OUT: "success",
  REVERSED: "danger",
};

export const CONSENT_STATUS_BADGE: Record<AffiliateConsentStatus, BadgeVariant> = {
  NONE: "neutral",
  PENDING: "warning",
  ACTIVE: "success",
  REJECTED: "danger",
  CANCELED: "danger",
  EXPIRED: "warning",
};

export function consentBadgeVariant(status: string | null | undefined): BadgeVariant {
  return CONSENT_STATUS_BADGE[normalizeAffiliateConsentStatus(status)];
}

export function commissionBadgeVariant(status: string): BadgeVariant {
  return COMMISSION_STATUS_BADGE[status as AffiliateCommissionStatus] ?? "neutral";
}

/** Centavos a pesos redondeados: 282000 → "$2.820". */
export function formatArsMinor(amountMinor: number): string {
  return `$${Math.round(amountMinor / 100).toLocaleString("es-AR")}`;
}

/**
 * Porcentaje escrito por una persona a puntos básicos: "10" → 1000,
 * "12,5" → 1250, "0.25" → 25. Admite hasta dos decimales y el signo "%".
 * Devuelve null si no es un número entre 0,01 y 100.
 */
export function parsePercentToBps(raw: string | null | undefined): number | null {
  if (typeof raw !== "string") return null;
  const cleaned = raw.trim().replace(/%$/, "").trim().replace(",", ".");
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(cleaned)) return null;
  const bps = Math.round(Number(cleaned) * 100);
  if (!Number.isSafeInteger(bps) || bps < 1 || bps > 10_000) return null;
  return bps;
}

export type CommissionSummaryRow = {
  status: string;
  netAmount: number;
};

export type CommissionTotals = Record<
  AffiliateCommissionStatus,
  { count: number; netAmount: number }
>;

/** Cantidad y suma del neto por estado. Los estados desconocidos se ignoran. */
export function summarizeCommissions(rows: readonly CommissionSummaryRow[]): CommissionTotals {
  const totals = Object.fromEntries(
    COMMISSION_STATUS_ORDER.map((s) => [s, { count: 0, netAmount: 0 }]),
  ) as CommissionTotals;
  for (const row of rows) {
    const bucket = totals[row.status as AffiliateCommissionStatus];
    if (!bucket) continue;
    bucket.count += 1;
    bucket.netAmount += row.netAmount;
  }
  return totals;
}

export type OwedByAffiliate = {
  affiliateId: string;
  displayName: string;
  owedAmount: number;
  owedCount: number;
};

/**
 * Cuánto se le debe a cada fotógrafo (comisiones "A transferir"), de mayor a
 * menor. Sólo aparecen los que tienen deuda.
 */
export function summarizeOwedByAffiliate(
  rows: ReadonlyArray<{
    status: string;
    netAmount: number;
    affiliateId: string;
    affiliateName: string;
  }>,
): OwedByAffiliate[] {
  const byId = new Map<string, OwedByAffiliate>();
  for (const row of rows) {
    if (row.status !== "OWED") continue;
    const current = byId.get(row.affiliateId) ?? {
      affiliateId: row.affiliateId,
      displayName: row.affiliateName,
      owedAmount: 0,
      owedCount: 0,
    };
    current.owedAmount += row.netAmount;
    current.owedCount += 1;
    byId.set(row.affiliateId, current);
  }
  return [...byId.values()].sort(
    (a, b) => b.owedAmount - a.owedAmount || a.displayName.localeCompare(b.displayName, "es"),
  );
}

/**
 * Mi cuenta: el fotógrafo tiene que hacer algo con Mercado Pago sólo si todavía
 * no está vinculado (sin invitar, pendiente, o la invitación venció/fue
 * rechazada/cancelada).
 */
export function affiliateNeedsMpAction(status: string | null | undefined): boolean {
  return normalizeAffiliateConsentStatus(status) !== "ACTIVE";
}

export type CouponAffiliateFormResult =
  | { ok: true; value: { affiliateId: string; commissionBps: number } | null }
  | { ok: false; error: string };

/**
 * Bloque "Código de fotógrafo" del formulario de cupones: o vienen los dos
 * datos (fotógrafo y %), o ninguno.
 */
export function parseCouponAffiliateForm(input: {
  affiliateId: string | null | undefined;
  percent: string | null | undefined;
}): CouponAffiliateFormResult {
  const affiliateId = (input.affiliateId ?? "").trim();
  const percent = (input.percent ?? "").trim();
  if (!affiliateId && !percent) return { ok: true, value: null };
  if (!affiliateId) {
    return { ok: false, error: "Elegí el fotógrafo dueño del código, o borrá la comisión." };
  }
  if (!percent) {
    return { ok: false, error: "Poné la comisión para el fotógrafo (por ejemplo, 10)." };
  }
  const commissionBps = parsePercentToBps(percent);
  if (commissionBps === null) {
    return {
      ok: false,
      error: "La comisión tiene que ser un número entre 0,01 y 100 (hasta dos decimales).",
    };
  }
  return { ok: true, value: { affiliateId, commissionBps } };
}

/**
 * El link de la invitación viene de Mercado Pago; igual sólo se muestra como
 * enlace si es https (nunca `javascript:` ni similares).
 */
export function safeInviteUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw.trim());
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}
