import { prisma } from "@/lib/prisma";

/**
 * Control de packs de preventa que perdieron unidades.
 *
 * Cuando una familia compra varias veces el mismo pack en un pedido, el pedido guarda una unidad
 * por pack (`PreCompraOrderItem`) y el snapshot multiplica lo que incluye: 2 packs de "1 carpeta"
 * son "2 carpetas". Si alguien reescribe el snapshot a mano y deja "1 carpeta", la familia canjea
 * una sola y la otra se pierde sin aviso. Pasó el 28/10/2026 con los pedidos 4789 y 4614 del
 * álbum 1075: se enteró la mamá al canjear.
 *
 * Esta tarea revisa los packs pagados sin canjear y avisa en el panel del admin cuáles tienen
 * menos de lo que pagaron, para corregirlos antes de que la familia canjee.
 */

export const TIPO_AVISO = "PREVENTA_PACK_UNIDADES_PERDIDAS";

type Beneficio = { stableKey?: unknown; includedQuantity?: unknown; name?: unknown };

/**
 * Lo que no cierra en un pack: cada beneficio que incluye algo tiene que alcanzar para todas las
 * unidades compradas, en partes iguales (2 packs de 1 carpeta = 2 carpetas, no 1 ni 3).
 */
export function beneficiosQueNoAlcanzan(snapshot: unknown, unidades: number): string[] {
  if (unidades <= 1) return [];
  const beneficios = (snapshot as { benefits?: Beneficio[] } | null)?.benefits;
  if (!Array.isArray(beneficios)) return [];
  const faltan: string[] = [];
  for (const b of beneficios) {
    const cantidad = Number(b.includedQuantity);
    if (!Number.isFinite(cantidad) || cantidad <= 0) continue;
    if (cantidad % unidades !== 0) {
      const nombre = typeof b.name === "string" && b.name.trim() ? b.name.trim() : String(b.stableKey ?? "?");
      faltan.push(`${nombre} (incluye ${cantidad} para ${unidades} packs)`);
    }
  }
  return faltan;
}

export type ControlPacksResult = { dryRun: boolean; revisados: number; conProblemas: number[]; avisado: boolean };

export async function runControlarPacksConUnidades(options?: { dryRun?: boolean }): Promise<ControlPacksResult> {
  const dryRun = options?.dryRun ?? false;
  const packs = await prisma.order.findMany({
    where: {
      origin: "PREVENTA_PACK",
      status: "PAID",
      isTest: false,
      redemptionOrderId: null,
      preCompraPaymentRef: { not: null },
    },
    select: { id: true, preCompraPaymentRef: true, preventaPackSnapshotJson: true },
  });

  // Un pedido de preventa puede traer packs distintos: se cuentan las unidades de cada pack.
  const preCompraIds = [
    ...new Set(packs.map((p) => Number(p.preCompraPaymentRef)).filter((id) => Number.isInteger(id) && id > 0)),
  ];
  const conteos =
    preCompraIds.length > 0
      ? await prisma.preCompraOrderItem.groupBy({
          by: ["orderId", "packDefinitionId"],
          where: { orderId: { in: preCompraIds } },
          _count: { _all: true },
        })
      : [];
  const unidadesDe = new Map<string, number>(
    conteos.map((c) => [`${c.orderId}:${c.packDefinitionId}`, c._count._all])
  );

  const detalle: string[] = [];
  const conProblemas: number[] = [];
  for (const pack of packs) {
    const packDefinitionId = (pack.preventaPackSnapshotJson as { packDefinitionId?: unknown } | null)?.packDefinitionId;
    const unidades = unidadesDe.get(`${Number(pack.preCompraPaymentRef)}:${packDefinitionId}`) ?? 0;
    const faltan = beneficiosQueNoAlcanzan(pack.preventaPackSnapshotJson, unidades);
    if (faltan.length === 0) continue;
    conProblemas.push(pack.id);
    detalle.push(`Pedido #${pack.id}: ${faltan.join("; ")}`);
  }
  conProblemas.sort((a, b) => a - b);

  const result: ControlPacksResult = { dryRun, revisados: packs.length, conProblemas, avisado: false };
  if (dryRun || conProblemas.length === 0) return result;

  const body =
    "Estos packs pagados todavía sin canjear tienen menos de lo que compró la familia " +
    "(el pedido trae varios packs pero el contenido no alcanza para todos). " +
    "Corregí el contenido del pack antes de que canjeen.\n\n" +
    detalle.sort().join("\n");

  // Un aviso por cada cambio en la lista, no uno por hora.
  const ultimo = await prisma.adminSystemMessage.findFirst({
    where: { type: TIPO_AVISO },
    orderBy: { createdAt: "desc" },
    select: { body: true },
  });
  if (ultimo?.body === body) return result;

  await prisma.adminSystemMessage.create({
    data: {
      type: TIPO_AVISO,
      title: `Packs de preventa con unidades perdidas: ${conProblemas.length}`,
      body,
    },
  });
  result.avisado = true;
  return result;
}
