"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@repo/db";
import { activitySalesHref, fulfillmentTransition, isFulfillment } from "@repo/muestras";
import { puede, rolEnMuestra } from "@/lib/equipo/permisos";
import { frenarPorUsuario } from "@/lib/limite";
import { getUsuario, type Usuario } from "@/lib/usuario";
import { conciliarPedido } from "./conciliar";
import { devolverTotal } from "./mp";
import { borrarPrivado } from "./r2-privado";

/**
 * Los pedidos en el panel (etapa 8, D21, D26, D27): la producción de las impresas (`salesFulfill`,
 * también la coorganización), pedir una devolución (`sales`, el dueño), devolver el pago y borrar
 * las ventas de prueba (sólo el super admin). Cada acción vuelve a leer la sesión y el permiso en
 * la base; si no lo tiene, el pedido "no existe".
 */
export type ResultadoPedidoPanel = { ok: true; aviso?: string } | { ok: false; error: string };

const no = (error: string): ResultadoPedidoPanel => ({ ok: false, error });
const NO_EXISTE = "Ese pedido no existe.";
const ES_ID = /^[A-Za-z0-9_-]{1,64}$/;
const TEXTO_MAX = 500;

const PEDIDO = {
  id: true, publicId: true, activityId: true, status: true, delivery: true, fulfillment: true, providerOrderId: true, refundRequestedAt: true, isTest: true,
} as const;

async function conPermiso(orderId: unknown, cap: "sales" | "salesFulfill") {
  const usuario = await getUsuario();
  if (!usuario) return { error: no("Tenés que ingresar.") } as const;
  if (typeof orderId !== "string" || !ES_ID.test(orderId)) return { error: no(NO_EXISTE) } as const;
  if (!frenarPorUsuario("pedidosPanel", usuario.id).allowed) return { error: no("Hiciste muchos cambios seguidos. Esperá unos minutos.") } as const;
  const pedido = await prisma.culturalSaleOrder.findUnique({ where: { id: orderId }, select: PEDIDO });
  if (!pedido) return { error: no(NO_EXISTE) } as const;
  const rol = await rolEnMuestra(pedido.activityId, usuario);
  if (!rol || !puede(usuario, cap, rol.role)) return { error: no(NO_EXISTE) } as const;
  return { usuario, pedido } as const;
}

function refrescar(activityId: string) {
  revalidatePath(`${activitySalesHref(activityId)}/pedidos`);
  revalidatePath("/panel/ventas");
}

const limpio = (s: unknown) => (typeof s === "string" ? s.trim().slice(0, TEXTO_MAX) : "");

/** El siguiente paso de una impresa: en producción → lista para retirar / enviada → entregada. */
export async function cambiarProduccion(orderId: string, siguiente: string, seguimiento?: string): Promise<ResultadoPedidoPanel> {
  const r = await conPermiso(orderId, "salesFulfill");
  if ("error" in r) return r.error!;
  const { pedido, usuario } = r;
  if (pedido.status !== "PAID") return no("Sólo se producen los pedidos pagados.");
  if (!isFulfillment(siguiente) || !fulfillmentTransition(pedido.fulfillment, siguiente, pedido.delivery)) return no("Ese paso no corresponde ahora.");
  const ahora = new Date();
  const texto = limpio(seguimiento);
  const fechas = siguiente === "READY" ? { readyAt: ahora } : siguiente === "SHIPPED" ? { shippedAt: ahora } : siguiente === "DELIVERED" ? { deliveredAt: ahora } : {};
  const cambio = await prisma.$transaction(async (tx) => {
    const { count } = await tx.culturalSaleOrder.updateMany({
      where: { id: pedido.id, status: "PAID", fulfillment: pedido.fulfillment },
      data: { fulfillment: siguiente, ...fechas, ...(texto ? { trackingText: texto } : {}) },
    });
    if (count === 0) return false;
    await tx.culturalSaleEvent.create({
      data: { orderId: pedido.id, source: "STAFF", actorUserId: usuario.id, detail: `Producción: ${pedido.fulfillment} → ${siguiente}${texto ? ` (${texto})` : ""}` },
    });
    return true;
  });
  if (!cambio) return no("El pedido cambió mientras tanto. Recargá la página.");
  refrescar(pedido.activityId);
  return { ok: true };
}

/** El dueño pide que la plataforma devuelva el pago (la devolución la hace el super admin). */
export async function pedirDevolucion(orderId: string, motivo: string): Promise<ResultadoPedidoPanel> {
  const r = await conPermiso(orderId, "sales");
  if ("error" in r) return r.error!;
  const { pedido, usuario } = r;
  if (pedido.status !== "PAID" && pedido.status !== "PAID_NO_COPY") return no("Sólo se devuelven pedidos pagados.");
  const texto = limpio(motivo);
  if (!texto) return no("Escribí el motivo de la devolución.");
  await prisma.$transaction(async (tx) => {
    await tx.culturalSaleOrder.updateMany({ where: { id: pedido.id, refundRequestedAt: null }, data: { refundRequestedAt: new Date() } });
    await tx.culturalSaleEvent.create({ data: { orderId: pedido.id, source: "STAFF", actorUserId: usuario.id, detail: `Devolución pedida: ${texto}` } });
  });
  refrescar(pedido.activityId);
  return { ok: true, aviso: "Pedimos la devolución: la plataforma la revisa y devuelve el pago." };
}

/**
 * Devolver el pago (sólo super admin): la devolución total en Mercado Pago con una clave fija por
 * pedido (dos clics son una sola devolución) y después la conciliación, que pasa el pedido a
 * `REFUNDED` y anula la copia cuando Mercado Pago lo confirma.
 */
export async function devolverPago(orderId: string, motivo: string): Promise<ResultadoPedidoPanel> {
  const usuario: Usuario | null = await getUsuario();
  if (!usuario?.esSuperAdmin) return no(NO_EXISTE);
  if (typeof orderId !== "string" || !ES_ID.test(orderId)) return no(NO_EXISTE);
  if (!frenarPorUsuario("pedidosPanel", usuario.id).allowed) return no("Hiciste muchos cambios seguidos. Esperá unos minutos.");
  const pedido = await prisma.culturalSaleOrder.findUnique({ where: { id: orderId }, select: PEDIDO });
  if (!pedido) return no(NO_EXISTE);
  // También un pedido rechazado que Mercado Pago igual cobró (alerta ALERT_PAID_ON_TERMINAL, con la
  // devolución pedida por la conciliación).
  const cobradoSinPedido = pedido.status === "REJECTED" && pedido.refundRequestedAt != null;
  if (pedido.status !== "PAID" && pedido.status !== "PAID_NO_COPY" && !cobradoSinPedido) return no("Sólo se devuelven pedidos pagados.");
  if (!pedido.providerOrderId) return no("El pedido no tiene una orden de Mercado Pago.");
  const texto = limpio(motivo);
  if (!texto) return no("Escribí el motivo de la devolución.");
  const d = await devolverTotal(pedido.providerOrderId, `refund-${pedido.id}`);
  await prisma.culturalSaleEvent.create({
    data: { orderId: pedido.id, source: "ADMIN", actorUserId: usuario.id, detail: `${d.ok ? "Devolución pedida a Mercado Pago" : "Mercado Pago no aceptó la devolución"}: ${texto}`.slice(0, 600) },
  });
  if (!d.ok) return no(d.error);
  const c = await conciliarPedido({ publicId: pedido.publicId }, "ADMIN").catch(() => null);
  refrescar(pedido.activityId);
  return {
    ok: true,
    aviso: c?.estado === "REFUNDED" ? "Pago devuelto: la copia quedó anulada." : "Mercado Pago está procesando la devolución: el pedido se actualiza solo cuando la confirme.",
  };
}

/**
 * Borra las ventas de prueba de una muestra (sólo super admin): pedidos, su historial y las copias
 * `isTest`, y sus piezas en el bucket privado. Nunca toca nada real (`isTest = false`).
 */
export async function borrarVentasDePrueba(activityId: string): Promise<ResultadoPedidoPanel> {
  const usuario = await getUsuario();
  if (!usuario?.esSuperAdmin) return no("No existe.");
  if (typeof activityId !== "string" || !ES_ID.test(activityId)) return no("No existe.");
  const [pedidos, copias] = await Promise.all([
    prisma.culturalSaleOrder.findMany({ where: { activityId, isTest: true }, select: { id: true } }),
    prisma.culturalEditionCopy.findMany({ where: { activityId, isTest: true }, select: { id: true, orderId: true, certificateCode: true } }),
  ]);
  const idsPedidos = pedidos.map((p) => p.id);
  await prisma.$transaction(async (tx) => {
    if (idsPedidos.length) {
      await tx.culturalSaleEvent.deleteMany({ where: { orderId: { in: idsPedidos } } });
      await tx.culturalSaleOrder.deleteMany({ where: { id: { in: idsPedidos }, isTest: true } });
    }
    await tx.culturalEditionCopy.deleteMany({ where: { activityId, isTest: true } });
  });
  // Las piezas guardadas (a mejor esfuerzo: un archivo que no se pudo borrar no frena nada).
  const claves = [
    ...idsPedidos.flatMap((id) => [`ventas/${id}/certificado.pdf`, `ventas/${id}/etiqueta.pdf`]),
    ...copias.flatMap((c) => (c.orderId
      ? c.certificateCode ? [`ventas/${c.orderId}/${c.certificateCode}.jpg`] : []
      : [`ventas/pa-${c.id}/certificado.pdf`, `ventas/pa-${c.id}/etiqueta.pdf`])),
  ];
  await Promise.all(claves.map((k) => borrarPrivado(k).catch(() => undefined)));
  refrescar(activityId);
  return { ok: true, aviso: `Borramos ${idsPedidos.length} ${idsPedidos.length === 1 ? "pedido" : "pedidos"} y ${copias.length} ${copias.length === 1 ? "copia" : "copias"} de prueba.` };
}
