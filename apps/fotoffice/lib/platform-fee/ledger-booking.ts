import { splitMinorByPlatformFee } from "./fee";
import { withholdingForPayment } from "./debt";

/**
 * Cuánto retiene la plataforma de una reserva cobrada por Mercado Pago.
 *
 * Es exactamente el mismo criterio que las cuotas —comisión propia primero, después la
 * deuda arrastrada de los cobros que no pasaron por Mercado Pago—, con una diferencia que
 * conviene dejar escrita: la base del cálculo es `totalArs`, que ya tiene descontadas las
 * horas bonificadas y ya tiene sumados los extras. **Nadie cobra comisión sobre plata que
 * no entró, ni deja de cobrarla sobre un extra que sí entró.**
 *
 * Módulo PURO: sin base y sin red.
 */
export function feeForBooking(input: {
  totalMinor: number;
  feeBps: number;
  pendingDebtMinor: number;
}): {
  ownFeeMinor: number;
  withholdMinor: number;
  netMinor: number;
  appliedToDebtMinor: number;
} {
  const propio = splitMinorByPlatformFee(input.totalMinor, input.feeBps);
  const reparto = withholdingForPayment({
    paymentMinor: input.totalMinor,
    ownFeeMinor: propio.feeMinor,
    pendingDebtMinor: input.pendingDebtMinor,
  });
  return {
    ownFeeMinor: propio.feeMinor,
    withholdMinor: reparto.withholdMinor,
    netMinor: reparto.netMinor,
    appliedToDebtMinor: reparto.appliedToDebtMinor,
  };
}
