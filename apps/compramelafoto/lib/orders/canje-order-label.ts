/**
 * Un canje (pack de preventa o combo cobrado por fuera) suele quedar en $0: mostrar "$ 0"
 * al fotógrafo parece un error. Este módulo decide cuándo un pedido es un canje y cómo
 * nombrar su monto, igual en el correo y en el panel de pedidos.
 */

export type CanjeOrderFlags = {
  /** OrderOrigin de Prisma. */
  origin?: string | null;
  /** CheckoutPaymentSource de Prisma. */
  checkoutPaymentSource?: string | null;
};

/**
 * Es canje si viene del canje de un pack de preventa (PACK_REDEMPTION) o si un combo
 * prepago cubrió el pedido (PREPAID_PACK). El pack en sí (PREVENTA_PACK) es una venta, no un canje.
 */
export function isCanjeOrder(flags: CanjeOrderFlags): boolean {
  const origin = (flags.origin ?? "").toUpperCase();
  const source = (flags.checkoutPaymentSource ?? "").toUpperCase();
  return origin === "PACK_REDEMPTION" || source === "PREPAID_PACK";
}

export const CANJE_SIN_CARGO_LABEL = "Canje (sin cargo)";

/**
 * Texto del monto de un pedido. Si no es canje devuelve `formatted` tal cual.
 * Canje en $0 → "Canje (sin cargo)"; canje con fotos extra pagas → "$ 4.500 (extras del canje)".
 */
export function formatCanjeAwareAmount(
  flags: CanjeOrderFlags,
  totalPesos: number,
  formatted: string
): string {
  if (!isCanjeOrder(flags)) return formatted;
  if (!(totalPesos > 0)) return CANJE_SIN_CARGO_LABEL;
  return `${formatted} (extras del canje)`;
}
