/**
 * Lo que Caja necesita saber de un pago de Mercado Pago. Módulo PURO.
 *
 * El adaptador de `@repo/payments` sanea la respuesta y descarta justo lo que hace falta para
 * que Caja coincida con la cuenta real: cuánto se quedó Mercado Pago, cuánto retuvo la
 * plataforma, cuándo se aprobó de verdad y cuánto se devolvió. Por eso FOTOFFICE lee el pago
 * crudo y lo resume acá, sin guardar nada personal del comprador.
 *
 * `fee_details` trae una fila por cargo. Sólo restan a la institución las que paga el
 * cobrador (`fee_payer: "collector"`): un recargo por cuotas que paga el comprador no sale de
 * la plata de la institución. `application_fee` es la comisión de la plataforma (el
 * `marketplace_fee` de la preferencia); el resto es de Mercado Pago.
 */

export type MpPaymentFacts = {
  id: string;
  status: string;
  statusDetail: string | null;
  externalReference: string | null;
  /** Lo que pagó el comprador, en centavos. */
  grossMinor: number;
  /** Lo que se quedó Mercado Pago (procesamiento, financiación a cargo del vendedor, etc.). */
  mpFeeMinor: number;
  /** Lo que retuvo la plataforma (`application_fee`). */
  platformFeeMinor: number;
  /** Lo que se devolvió al comprador, en centavos. */
  refundedMinor: number;
  /** Cuándo se aprobó, según Mercado Pago. Null si nunca se aprobó. */
  approvedAt: Date | null;
  lastUpdatedAt: Date | null;
  paymentMethodId: string | null;
  /** Cómo se obtuvo la comisión: de las filas, del neto recibido, o no se pudo saber. */
  feeSource: "fee_details" | "net_received" | "unknown";
};

function toMinor(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.round(value * 100) : 0;
}

function toDate(value: unknown): Date | null {
  if (typeof value !== "string" || value === "") return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function str(value: unknown): string | null {
  if (typeof value === "string" && value !== "") return value;
  if (typeof value === "number") return String(value);
  return null;
}

export function parseMpPayment(raw: Record<string, unknown>): MpPaymentFacts {
  const grossMinor = toMinor(raw.transaction_amount);

  let mpFeeMinor = 0;
  let platformFeeMinor = 0;
  let feeSource: MpPaymentFacts["feeSource"] = "unknown";

  const filas = Array.isArray(raw.fee_details) ? raw.fee_details : [];
  for (const fila of filas) {
    if (typeof fila !== "object" || fila === null) continue;
    const f = fila as Record<string, unknown>;
    // Sin `fee_payer` se asume el cobrador: es el caso de todas las comisiones de
    // procesamiento, y suponer lo contrario haría que Caja muestre plata que no está.
    if (f.fee_payer !== undefined && f.fee_payer !== "collector") continue;
    const monto = toMinor(f.amount);
    if (monto <= 0) continue;
    if (f.type === "application_fee") platformFeeMinor += monto;
    else mpFeeMinor += monto;
    feeSource = "fee_details";
  }

  if (feeSource === "unknown") {
    const detalle =
      typeof raw.transaction_details === "object" && raw.transaction_details !== null
        ? (raw.transaction_details as Record<string, unknown>)
        : null;
    const neto = detalle?.net_received_amount;
    if (typeof neto === "number" && grossMinor > 0) {
      const total = Math.max(0, grossMinor - toMinor(neto));
      platformFeeMinor = Math.min(total, toMinor(raw.marketplace_fee));
      mpFeeMinor = total - platformFeeMinor;
      feeSource = "net_received";
    }
  }

  return {
    id: str(raw.id) ?? "",
    status: str(raw.status) ?? "",
    statusDetail: str(raw.status_detail),
    externalReference: str(raw.external_reference),
    grossMinor,
    mpFeeMinor,
    platformFeeMinor,
    refundedMinor: toMinor(raw.transaction_amount_refunded),
    approvedAt: toDate(raw.date_approved),
    lastUpdatedAt: toDate(raw.date_last_updated),
    paymentMethodId: str(raw.payment_method_id),
    feeSource,
  };
}

/** Había plata y se fue entera: devolución total o contracargo. */
export function isFullyReversed(facts: MpPaymentFacts): boolean {
  return facts.status === "refunded" || facts.status === "charged_back";
}

/**
 * La fecha con la que el cobro entra a Caja: la de aprobación. Si Mercado Pago no la informa,
 * la que se pase como respaldo (normalmente, ahora).
 */
export function collectionDate(facts: MpPaymentFacts, fallback: Date): Date {
  return facts.approvedAt ?? fallback;
}
