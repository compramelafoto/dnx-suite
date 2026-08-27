import { splitMinorByPlatformFee } from "./fee";

/**
 * Contabilidad de la comisión cuando el pago no pasa por Mercado Pago.
 *
 * El dinero de las cuotas nunca pasa por DNX: el socio paga a la cuenta de la institución y
 * Mercado Pago retiene la comisión en la misma operación. Un pago en efectivo o por
 * transferencia no pasa por ahí, así que **no hay de dónde retener**: esa comisión queda como
 * deuda de la institución con la plataforma, y se cobra de los siguientes pagos que sí entren
 * por Mercado Pago.
 *
 * Todo en centavos y con enteros. El dinero no se calcula en coma flotante.
 */

/** Cargo de apertura: el saldo traído del sistema anterior. Ver ANALISIS-PADRON-SFPR.md. */
export const APERTURA_PERIOD = "APERTURA";

/**
 * Desde qué período se cobra comisión.
 *
 * Decisión de Daniel: la comisión rige desde las cuotas de septiembre de 2026, que son las
 * primeras que genera FotOffice. Las anteriores y el cargo de apertura vienen del sistema
 * anterior; cobrar sobre eso sería cobrar por trabajo que FotOffice no hizo.
 *
 * Es una constante y no una configuración porque hoy hay una sola institución y una sola
 * fecha de corte. Cuando haya una segunda, esto pasa a la configuración del workspace.
 */
export const FEE_SINCE_PERIOD = "2026-09";

const PERIODO = /^\d{4}-(0[1-9]|1[0-2])$/;

/**
 * ¿Este cargo devenga comisión?
 *
 * Solo las cuotas desde el período de corte. Quedan afuera las anteriores y el cargo de
 * apertura, que es deuda heredada del sistema anterior: cobrar comisión sobre eso sería
 * cobrar por trabajo que FotoOffice no hizo.
 *
 * Ante un período con formato inesperado devuelve `false`. Si no se puede afirmar que
 * corresponde cobrar, no se cobra.
 */
export function chargeAccruesFee(period: string, sincePeriod: string): boolean {
  if (!PERIODO.test(period) || !PERIODO.test(sincePeriod)) return false;
  return period >= sincePeriod;
}

/**
 * Comisión que queda a deber por un pago manual.
 *
 * Se calcula solo sobre la parte imputada a cuotas que devengan comisión: un pago que solo
 * salda deuda vieja no genera deuda de fee.
 */
export function accrualForManualPayment(
  allocations: { period: string; amountMinor: number }[],
  feeBps: number,
  sincePeriod: string,
): number {
  const base = allocations
    .filter((a) => chargeAccruesFee(a.period, sincePeriod))
    .reduce((s, a) => s + (Number.isInteger(a.amountMinor) && a.amountMinor > 0 ? a.amountMinor : 0), 0);
  return splitMinorByPlatformFee(base, feeBps).feeMinor;
}

export type Withholding = {
  /** Lo que se retiene en total de esta operación. */
  withholdMinor: number;
  /** Cuánto de esa retención va a cancelar deuda arrastrada. */
  appliedToDebtMinor: number;
  /** Deuda que queda pendiente después de aplicar esta retención. */
  remainingDebtMinor: number;
  /** Lo que efectivamente recibe la institución. */
  netMinor: number;
};

/**
 * Cuánto retener de un pago que sí entra por Mercado Pago.
 *
 * Primero la comisión propia de ese pago, después toda la deuda arrastrada que entre. Sin
 * tope: es la decisión tomada. Un pago puede quedar íntegro para la plataforma si la deuda
 * acumulada lo supera.
 *
 * Nunca se retiene más que el pago —no existe un cobro negativo— y lo que no entró sigue
 * pendiente para la próxima operación.
 */
export function withholdingForPayment(input: {
  paymentMinor: number;
  ownFeeMinor: number;
  pendingDebtMinor: number;
}): Withholding {
  const pago = entero(input.paymentMinor);
  const deuda = entero(input.pendingDebtMinor);
  const propia = Math.min(entero(input.ownFeeMinor), pago);
  const aDeuda = Math.min(deuda, pago - propia);

  return {
    withholdMinor: propia + aDeuda,
    appliedToDebtMinor: aDeuda,
    remainingDebtMinor: deuda - aDeuda,
    netMinor: pago - propia - aDeuda,
  };
}

const entero = (n: number) => (Number.isInteger(n) && n > 0 ? n : 0);
