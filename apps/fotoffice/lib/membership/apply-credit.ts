import type { OpenCredit } from "./credit";
import { sortOldestFirst, type OpenCharge } from "./select-charges";

/**
 * Cómo se consume el saldo a favor cuando aparecen cargos nuevos.
 *
 * Es lo que hacía el sistema anterior de la SFPR y FotoOffice no: el socio 617 transfirió de
 * más y se le fue descontando mes a mes. Sin esto, el mes siguiente se le cobra la cuota
 * completa como si no hubiera adelantado nada.
 *
 * Del cargo más viejo al más nuevo, igual que `selectChargesToPay`: dejar una cuota vieja
 * impaga y saldar la nueva ensucia el cálculo de mora.
 *
 * Módulo PURO: decide plata, así que tiene que poder probarse hasta el borde.
 */

export type CreditApplication = {
  paymentId: string;
  chargeId: string;
  /** Cuánto de ese pago se imputa a ese cargo, en centavos. */
  amountMinor: number;
  /** Lo que le queda al cargo después de esta imputación, en centavos. */
  chargeRemainingMinor: number;
};

export function planCreditApplication(input: {
  /** En el orden en que se van a consumir: el pago más viejo primero. */
  credits: OpenCredit[];
  charges: OpenCharge[];
}): CreditApplication[] {
  const disponibles = input.credits
    .map((c) => ({ ...c }))
    .filter((c) => c.remainingMinor > 0);
  const cargos = sortOldestFirst(input.charges.filter((c) => c.balanceMinor > 0));

  const salida: CreditApplication[] = [];

  for (const cargo of cargos) {
    let pendiente = cargo.balanceMinor;
    for (const credito of disponibles) {
      if (pendiente <= 0) break;
      if (credito.remainingMinor <= 0) continue;
      const usado = Math.min(pendiente, credito.remainingMinor);
      pendiente -= usado;
      credito.remainingMinor -= usado;
      salida.push({
        paymentId: credito.paymentId,
        chargeId: cargo.id,
        amountMinor: usado,
        chargeRemainingMinor: pendiente,
      });
    }
  }

  return salida;
}
