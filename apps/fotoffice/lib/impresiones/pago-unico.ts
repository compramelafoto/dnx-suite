import type { Prisma } from "@repo/db";

/**
 * Un pago de Mercado Pago acredita una sola cosa. Los pagos por link traen su referencia; una
 * transferencia verificada por comprobante no, así que antes de acreditarla se revisa que ese id de
 * pago no figure ya en un pedido de copias (como pago o como pago extra) ni en un cobro de Pedidos.
 * El candado por pago lo comparten las dos acreditaciones (copias y pedidos de catálogo).
 */

type Tx = Prisma.TransactionClient;

export async function bloquearPagoMp(tx: Pick<Tx, "$executeRaw">, providerPaymentId: string): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`fotoffice-pago-mp:${providerPaymentId}`}))`;
}

/** ¿Ese pago ya está en un pedido de copias o en un cobro? Con `sinCobros`, sólo mira los pedidos de copias. */
export async function pagoMpYaUsado(
  cliente: Pick<Tx, "fotofficePrintOrder" | "fotofficeCobro">,
  workspaceId: string,
  providerPaymentId: string,
  opciones: { sinCobros?: boolean } = {},
): Promise<boolean> {
  const [copias, extra, cobro] = await Promise.all([
    cliente.fotofficePrintOrder.findFirst({ where: { providerPaymentRef: providerPaymentId }, select: { id: true } }),
    cliente.fotofficePrintOrder.findFirst({ where: { workspaceId, pagosExtra: { array_contains: [providerPaymentId] } }, select: { id: true } }),
    opciones.sinCobros ? Promise.resolve(null) : cliente.fotofficeCobro.findFirst({ where: { providerPaymentRef: providerPaymentId }, select: { id: true } }),
  ]);
  return copias !== null || extra !== null || cobro !== null;
}
