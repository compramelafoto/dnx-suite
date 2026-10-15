/**
 * Estimación de la comisión de Mercado Pago, sólo para mostrar en el simulador.
 *
 * La comisión real la descuenta Mercado Pago al acreditar; esta tasa es la de Checkout,
 * acreditación inmediata, en Argentina: 6,29% + IVA = 7,61%. Revisarla contra la tabla vigente
 * de Mercado Pago cuando cambie. La pantalla siempre la presenta como estimada.
 */
export const TASA_MP_ESTIMADA_BPS = 761;

export function estimarComisionMp(cobradoCentavos: number, tasaBps: number = TASA_MP_ESTIMADA_BPS): number {
  return Math.round((cobradoCentavos * tasaBps) / 10000);
}
