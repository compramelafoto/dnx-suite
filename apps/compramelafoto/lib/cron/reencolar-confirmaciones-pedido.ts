import { prisma } from "@/lib/prisma";
import { queueOrderConfirmationEmail } from "@/lib/order-confirmation-email";

/**
 * Red de seguridad del comprobante al comprador ("Tu pedido #N fue confirmado").
 *
 * El comprobante se encola al aprobarse el pago (`runAlbumOrderPaidSideEffects`). Si eso falla,
 * el comprador se queda sin aviso y nadie se entera: pasó con el pedido 3791 (03/10/2026).
 * Esta tarea busca pedidos pagados recientes sin su comprobante en la cola y lo vuelve a encolar.
 *
 * Misma regla que el envío original: todo pedido pagado lleva comprobante, salvo la preventa
 * sin fotos (esa recibe el correo de acceso al pack). Los pedidos de prueba no se tocan.
 *
 * La ventana es corta a propósito: sólo pedidos creados en los últimos 3 días, para no mandarle
 * de golpe un comprobante viejo a alguien que compró hace semanas. Se espera 15 minutos desde la
 * creación para no pisarse con un pago que todavía se está procesando.
 */

export const VENTANA_DIAS = 3;
export const ESPERA_MINUTOS = 15;
const TOPE_PEDIDOS = 500;

export type ReencolarConfirmacionesResult = {
  dryRun: boolean;
  revisados: number;
  faltantes: number[];
  reencolados: number;
  fallidos: number;
};

export function claveConfirmacion(orderId: number): string {
  return `order_confirmed_album_${orderId}`;
}

export async function runReencolarConfirmacionesPedido(options?: {
  dryRun?: boolean;
  now?: Date;
}): Promise<ReencolarConfirmacionesResult> {
  const dryRun = options?.dryRun ?? false;
  const now = options?.now ?? new Date();
  const desde = new Date(now.getTime() - VENTANA_DIAS * 24 * 60 * 60 * 1000);
  const hasta = new Date(now.getTime() - ESPERA_MINUTOS * 60 * 1000);

  const pedidos = await prisma.order.findMany({
    where: {
      status: "PAID",
      isTest: false,
      createdAt: { gte: desde, lte: hasta },
      OR: [{ origin: { not: "PREVENTA_PACK" } }, { items: { some: {} } }],
    },
    select: { id: true },
    orderBy: { id: "asc" },
    take: TOPE_PEDIDOS,
  });

  const result: ReencolarConfirmacionesResult = {
    dryRun,
    revisados: pedidos.length,
    faltantes: [],
    reencolados: 0,
    fallidos: 0,
  };
  if (pedidos.length === 0) return result;

  const encolados = await prisma.emailQueue.findMany({
    where: { idempotencyKey: { in: pedidos.map((p) => claveConfirmacion(p.id)) } },
    select: { idempotencyKey: true },
  });
  const yaEncoladas = new Set(encolados.map((e) => e.idempotencyKey));
  result.faltantes = pedidos
    .map((p) => p.id)
    .filter((id) => !yaEncoladas.has(claveConfirmacion(id)));

  if (dryRun || result.faltantes.length === 0) return result;

  for (const orderId of result.faltantes) {
    try {
      await queueOrderConfirmationEmail(orderId);
      result.reencolados++;
    } catch (err) {
      result.fallidos++;
      console.error("[reencolar-confirmaciones-pedido] fallo", { orderId, err });
    }
  }

  // Que quede a la vista: si esto se repite, el envío original se está rompiendo.
  await prisma.adminSystemMessage.create({
    data: {
      type: "ORDER_CONFIRMATION_REQUEUED",
      title: "Comprobantes de pedido reenviados por el control horario",
      body:
        `Pedidos pagados que no tenían el comprobante al comprador: ${result.faltantes.join(", ")}.\n` +
        `Reencolados: ${result.reencolados}. Fallidos: ${result.fallidos}.`,
    },
  });

  return result;
}
