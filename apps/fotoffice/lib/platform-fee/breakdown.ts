import { Prisma } from "@repo/db";
import { formatFeeBpsAsPercent, splitByPlatformFee } from "./fee";

const arsFormatter = new Intl.NumberFormat("es-AR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatArs(value: Prisma.Decimal): string {
  return `$${arsFormatter.format(Number(value.toFixed(2)))}`;
}

export type FeeBreakdown = {
  hasFee: boolean;
  /** null cuando la comisión es cero: no hay nada que descontar que mostrar. */
  feeLine: string | null;
  netLine: string;
  warningLine: string;
  feeArs: Prisma.Decimal;
  netArs: Prisma.Decimal;
};

/**
 * Arma el desglose que se le muestra al dueño mientras escribe un precio.
 *
 * Es la fuente única del texto: la spec exige que sea idéntico en toda pantalla donde se
 * configure un precio, para que no haya una que lo muestre y otra que se lo olvide.
 *
 * Devuelve `null` si el importe todavía no es un número positivo — el campo recién
 * empezado a tipear no debe mostrar un desglose de cero.
 *
 * Dice "aproximadamente" y advierte por impuestos y MercadoPago a propósito: esas
 * retenciones dependen de la condición fiscal de cada institución y del medio de pago que
 * elija quien compra, así que no las podemos calcular. Prometer un neto exacto sería
 * mentirle al dueño del workspace.
 */
export function buildFeeBreakdown(
  amountArs: string | number,
  feeBps: number,
): FeeBreakdown | null {
  let total: Prisma.Decimal;
  try {
    total = new Prisma.Decimal(String(amountArs).trim().replace(",", "."));
  } catch {
    return null;
  }
  if (!total.isFinite() || total.lte(0)) return null;

  const { fee, net } = splitByPlatformFee(total, feeBps);
  const warningLine =
    "⚠️ Ese monto es antes de impuestos y de la comisión de MercadoPago, que se descuentan aparte.";

  if (fee.isZero()) {
    return {
      hasFee: false,
      feeLine: null,
      netLine: `Sin comisión de plataforma. Recibís aproximadamente ${formatArs(net)}.`,
      warningLine,
      feeArs: fee,
      netArs: net,
    };
  }

  return {
    hasFee: true,
    feeLine: `Fee de plataforma (${formatFeeBpsAsPercent(feeBps)}): ${formatArs(fee)}`,
    netLine: `Recibís aproximadamente ${formatArs(net)}.`,
    warningLine,
    feeArs: fee,
    netArs: net,
  };
}
