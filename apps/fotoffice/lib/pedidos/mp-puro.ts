/**
 * Lo puro del pago de cuotas con Mercado Pago (etapa 3, Entrega B2): la referencia que viaja en
 * la preferencia y vuelve en el aviso, y los hechos de un pago leído. Sin base ni red.
 */

export const PREFIJO_REFERENCIA_CUOTA = "fo-pedcuota:";

/** Título de la tarea para el responsable cuando un pago aprobado no se pudo aplicar. */
export const TITULO_TAREA_PAGO_SIN_APLICAR = "Pago de Mercado Pago sin aplicar: devolver o aplicar a mano";

export function referenciaCuota(cuotaId: string): string {
  return `${PREFIJO_REFERENCIA_CUOTA}${cuotaId}`;
}

/** El id de cuota que viaja en un pago de Mercado Pago, o null si el pago es de otra cosa. */
export function cuotaDeReferencia(raw: unknown): string | null {
  if (typeof raw !== "string" || !raw.startsWith(PREFIJO_REFERENCIA_CUOTA)) return null;
  const id = raw.slice(PREFIJO_REFERENCIA_CUOTA.length).trim();
  return id.length > 0 && id.length <= 64 ? id : null;
}

/**
 * La comisión de Mercado Pago en centavos: la suma de los `fee_details` de tipo `mercadopago_fee`
 * (montos en pesos). null si no viene, no se entiende, o es mayor que el pago (no se inventa).
 */
export function comisionDeMp(rawSanitized: Record<string, unknown>, brutoMinor: number): number | null {
  const detalle = rawSanitized.fee_details;
  if (!Array.isArray(detalle)) return null;
  let suma = 0;
  let hay = false;
  for (const fila of detalle) {
    if (typeof fila !== "object" || fila === null) continue;
    const { type, amount } = fila as { type?: unknown; amount?: unknown };
    if (type !== "mercadopago_fee") continue;
    if (typeof amount !== "number" || !Number.isFinite(amount) || amount < 0) return null;
    suma += Math.round(amount * 100);
    hay = true;
  }
  if (!hay || suma > brutoMinor) return null;
  return suma;
}

export type HechosDelPago = {
  providerPaymentId: string;
  amountMinor: number;
  currency: string;
  /** `date_approved`; null si no viene o no se entiende. */
  paidAt: Date | null;
  /** Comisión de Mercado Pago en centavos, o null si no viene. */
  feeMinor: number | null;
};

/** Lo que la acreditación necesita de un pago leído: id, monto, moneda, fecha y comisión. */
export function hechosDelPago(pago: {
  providerPaymentId: string;
  amountMinor: number;
  currency: string;
  rawSanitized: Record<string, unknown>;
}): HechosDelPago {
  const crudo = pago.rawSanitized.date_approved;
  const fecha = typeof crudo === "string" ? new Date(crudo) : null;
  return {
    providerPaymentId: pago.providerPaymentId,
    amountMinor: pago.amountMinor,
    currency: pago.currency,
    paidAt: fecha && !Number.isNaN(fecha.getTime()) ? fecha : null,
    feeMinor: comisionDeMp(pago.rawSanitized, pago.amountMinor),
  };
}
