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

/**
 * Comisión que queda a deber por un pago manual.
 *
 * Se calcula sobre **todo lo cobrado**, sin mirar a qué cuota se imputa. Decisión de Daniel
 * (02/10/2026): un cobro en efectivo, por transferencia o por el link de pago del sistema
 * anterior es plata que la institución cobró sin que la plataforma pudiera retener nada, y
 * eso vale igual si salda septiembre o el arrastre de apertura. Antes la comisión sólo corría
 * sobre las cuotas desde 2026-09, y la imputación de la más vieja primero hacía que casi
 * ningún cobro manual la generara.
 */
export function accrualForManualPayment(amountMinor: number, feeBps: number): number {
  const base = Number.isInteger(amountMinor) && amountMinor > 0 ? amountMinor : 0;
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
