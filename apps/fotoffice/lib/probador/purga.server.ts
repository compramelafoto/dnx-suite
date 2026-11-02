import "server-only";
import { ListObjectsV2Command } from "@aws-sdk/client-s3";
import { prisma } from "@repo/db";
import { borrarArchivoGuardado } from "@/lib/carpetas/almacen";
import { bucketR2Privado, clienteR2Privado } from "@/lib/ficha/adjuntos-r2";

/**
 * Las fotos que el cliente subió desde el probador no quedan para siempre (las corre el cron de
 * impresiones): las de pedidos que nunca se pagaron (o que nunca llegaron a pedido) se borran a las
 * 72 horas; las de pedidos pagados, a los 60 días, cuando el laboratorio ya las imprimió.
 */

const HORA = 60 * 60 * 1000;
export const SIN_PAGAR_MS = 72 * HORA;
export const PAGADO_MS = 60 * 24 * HORA;
const POR_CORRIDA = 500;
const SIN_PAGO = new Set(["PENDIENTE_PAGO", "CANCELADO"]);

/** Si una foto subida hace `edadMs` ya se puede borrar, según el estado de su pedido (null = sin pedido). */
export function sePuedeBorrar(edadMs: number, estadoDelPedido: string | null): boolean {
  if (estadoDelPedido === null || SIN_PAGO.has(estadoDelPedido)) return edadMs >= SIN_PAGAR_MS;
  return edadMs >= PAGADO_MS;
}

export async function purgarOriginalesProbador(ahora: Date): Promise<number> {
  const listado = await clienteR2Privado().send(
    new ListObjectsV2Command({ Bucket: bucketR2Privado(), Prefix: "fotoffice/probador/", MaxKeys: POR_CORRIDA }),
  );
  const viejos = (listado.Contents ?? []).filter((o) => o.Key && o.LastModified && ahora.getTime() - o.LastModified.getTime() >= SIN_PAGAR_MS);
  if (viejos.length === 0) return 0;
  const items = await prisma.fotofficePrintOrderItem.findMany({
    where: { sourceKey: { in: viejos.map((o) => o.Key!) } },
    select: { sourceKey: true, order: { select: { status: true } } },
  });
  const estado = new Map(items.map((i) => [i.sourceKey, i.order.status]));
  let borrados = 0;
  for (const o of viejos) {
    if (!sePuedeBorrar(ahora.getTime() - o.LastModified!.getTime(), estado.get(o.Key!) ?? null)) continue;
    await borrarArchivoGuardado(o.Key!);
    borrados++;
  }
  return borrados;
}
