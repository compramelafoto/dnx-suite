import { isHistoricalPayment } from "./payment-method";

/**
 * Cuánto de lo que pagó un socio todavía no se imputó a ningún cargo.
 *
 * `allocatePayment` ya declaraba que el sobrante «queda a favor del socio», pero no había
 * dónde guardarlo y el valor moría en un mensaje. No hace falta guardarlo: el sobrante **es
 * el pago mismo**, esperando cargos futuros, y `MembershipAllocation` permite imputar un pago
 * a cargos creados después.
 *
 * ── La trampa ──
 *
 * Los pagos históricos importados del sistema anterior **no tienen imputaciones a propósito**:
 * son constancia de un cobro, no un movimiento de cuenta. Con la fórmula de acá, sin
 * excluirlos, los 61 socios de la SFPR aparecerían con $2.213.288 de crédito que no existe.
 *
 * Por eso esta función es la **única puerta** al cálculo del saldo a favor. Ninguna pantalla
 * ni consulta puede calcularlo por su cuenta.
 *
 * Módulo PURO: sin base y sin red.
 */

export type PaymentForCredit = {
  id: string;
  method: string | null;
  providerPaymentRef: string | null;
  /** Importe del pago, en centavos. */
  amountMinor: number;
  /** Lo ya imputado a cargos, en centavos. */
  allocatedMinor: number;
};

export type OpenCredit = {
  paymentId: string;
  /** Lo que le queda a este pago por imputar, en centavos. */
  remainingMinor: number;
};

/** Marca de pago histórico en la referencia del proveedor. Ver `history-import/parse.ts`. */
const HISTORICAL_REF_PREFIX = "HIST:";

/**
 * ¿Este pago puede generar saldo a favor?
 *
 * Se mira el medio **y** la referencia. Un histórico siempre trae los dos, pero alcanzar con
 * cualquiera de ellos hace que un dato incompleto falle del lado seguro: no contar un crédito
 * que existe es un reclamo; contar uno que no existe es plata regalada.
 */
function cuentaParaCredito(p: PaymentForCredit): boolean {
  if (isHistoricalPayment(p.method)) return false;
  if (p.providerPaymentRef?.startsWith(HISTORICAL_REF_PREFIX)) return false;
  return true;
}

export function creditFromPayments(payments: PaymentForCredit[]): {
  creditMinor: number;
  open: OpenCredit[];
} {
  const open: OpenCredit[] = [];
  for (const p of payments) {
    if (!cuentaParaCredito(p)) continue;
    // `Math.max` y no una resta pelada: un pago que figure imputado de más no puede convertir
    // el crédito en deuda por la ventana de atrás.
    const restante = Math.max(0, p.amountMinor - p.allocatedMinor);
    if (restante > 0) open.push({ paymentId: p.id, remainingMinor: restante });
  }
  return { creditMinor: open.reduce((s, o) => s + o.remainingMinor, 0), open };
}
