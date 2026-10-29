/**
 * Ventas de ejemplo de la demo escolar: familias inventadas que ya compraron en la preventa, para
 * que el panel del colegio y la línea de producción no arranquen vacíos. Se crean con el mismo
 * proceso que una compra simulada (pedido de prueba + pago simulado), así sus comisiones son reales.
 */

import { prisma, Role } from "@/lib/prisma";
import { DEMO_EMAIL_DOMAIN } from "@/lib/demos/identidad";
import { listActivePacksForPublicCatalog } from "@/lib/preventa-canjeable/pack-service";
import { crearPedidoPreventaSimulado } from "@/lib/preventa-canjeable/precompra-test-order";
import { finalizeAlbumOrderSimulatedApproved } from "@/lib/demos/pago-simulado";

export const VENTAS_EJEMPLO = 12;
const PREFIJO_CORREO = "familia-ejemplo-";
const DIA_MS = 24 * 60 * 60 * 1000;

export function esCorreoDeVentaEjemplo(email: string | null | undefined): boolean {
  return Boolean(email?.startsWith(PREFIJO_CORREO) && email.endsWith(`@${DEMO_EMAIL_DOMAIN}`));
}

export async function sembrarVentasDeEjemplo(opts: {
  albumId: number;
  schoolId: number;
  fotografoId: number;
}): Promise<{ creadas: number; total: number }> {
  const { albumId, schoolId, fotografoId } = opts;
  const yaHay = await prisma.order.count({
    where: { albumId, buyerEmail: { startsWith: PREFIJO_CORREO }, status: "PAID" },
  });
  if (yaHay >= VENTAS_EJEMPLO) return { creadas: 0, total: yaHay };

  const packs = await listActivePacksForPublicCatalog(albumId, new Date(), { hasPhotos: false });
  if (packs.length === 0) throw new Error("La demo no tiene packs de preventa.");
  const alumnos = await prisma.albumStudentRosterEntry.findMany({
    where: { albumId, isActive: true },
    orderBy: { id: "asc" },
    // Saltea uno de cada tres: quedan alumnos sin compra para la familia que compra en vivo.
    take: Math.ceil(VENTAS_EJEMPLO * 1.5),
  });
  const elegidos = alumnos.filter((_, i) => i % 3 !== 2).slice(0, VENTAS_EJEMPLO);

  let creadas = 0;
  for (const [i, alumno] of elegidos.entries()) {
    const correo = `${PREFIJO_CORREO}${alumno.id}@${DEMO_EMAIL_DOMAIN}`;
    const existe = await prisma.order.findFirst({ where: { albumId, buyerEmail: correo, status: "PAID" }, select: { id: true } });
    if (existe) continue;
    // Dos de cada tres eligen el librito: es el pack que se quiere mostrar.
    const pack = packs[i % 3 === 2 ? packs.length - 1 : 0];
    const res = await crearPedidoPreventaSimulado(
      { id: fotografoId, role: Role.PHOTOGRAPHER },
      {
        albumId,
        buyerEmail: correo,
        buyerName: `Familia ${alumno.snapshotLastName}`,
        buyerPhone: "+54 9 341 000-1000",
        albumRosterEntryId: alumno.id,
        organizerReferralSchoolId: schoolId,
        items: [{ packDefinitionId: pack.id, quantity: 1 }],
      },
    );
    if (!res.ok) throw new Error(`Venta de ejemplo: ${res.error}`);
    const pago = await finalizeAlbumOrderSimulatedApproved(res.orderId);
    if (!pago.ok) throw new Error(`Venta de ejemplo: ${pago.error}`);

    // Repartidas en las últimas dos semanas, y las más viejas ya liquidadas al colegio.
    const fecha = new Date(Date.now() - (VENTAS_EJEMPLO - i) * DIA_MS - 3 * 60 * 60 * 1000);
    await prisma.order.update({ where: { id: res.orderId }, data: { createdAt: fecha } });
    await prisma.organizerCommission.updateMany({
      where: { orderId: res.orderId },
      data: i < 4 ? { createdAt: fecha, status: "PAID", paidAt: new Date(fecha.getTime() + 5 * DIA_MS), paymentMethod: "Transferencia" } : { createdAt: fecha },
    });
    creadas += 1;
  }
  return { creadas, total: yaHay + creadas };
}
