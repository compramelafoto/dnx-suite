import "server-only";
import { prisma, type Prisma } from "@repo/db";
import { decimalArsToMinor } from "@/lib/membership/money";
import { cuotasDeCargo } from "@/lib/pedidos/cargos-puro";
import { OPCIONES_TRANSACCION_PEDIDO, esEstadoPedido } from "@/lib/pedidos/constantes";
import { bloquearPedido, fechaParaBase, pesosDeBase, pesosParaBase } from "@/lib/pedidos/plan";
import { diaEnBuenosAires } from "@/lib/presupuestos/estados";
import {
  calcularBonificacion, descuentoDelRenglonMinor, itemsConBonificacion, pesosTexto, repartirBonificacion, tareaBonificacionAMano, tareaDeshacerAMano,
  totalesConBonificacion,
} from "../bonificacion";

/**
 * El pedido de un cassette que no se pudo digitalizar (ver `../bonificacion.ts`): al registrarlo se
 * le descuenta al pedido la diferencia con el precio configurado; al «Quitar», se devuelve.
 *
 * - Todo con el candado del pedido (`bloquearPedido`), el mismo de cobrar y de los cargos extra.
 * - **Dinero ya cobrado, nunca se toca:** sólo se achican cuotas sin ningún cobro imputado (ni
 *   anulado), sin transferencia anunciada y que no son de un cargo extra. Si no alcanzan, no se
 *   descuenta nada y queda una tarea en el pedido para que una persona lo resuelva.
 * - Lo descontado se anota en la grabación (`bonificacionArs`) para poder deshacerlo.
 * - Nunca lanza: un problema con el pedido no impide registrar el cassette.
 *
 * Todo filtra por `workspaceId`. Nunca loguea datos personales.
 */

type Tx = Prisma.TransactionClient;

export type ResultadoBonificacion =
  | { estado: "APLICADA"; bonificacionArs: number; precioArs: number }
  | { estado: "A_MANO"; bonificacionArs: number }
  | { estado: "NADA" };

function falla(donde: string, e: unknown): void {
  const c = e as { code?: unknown } | null;
  console.error(`[digitalizacion][bonificacion] ${donde} falló`, { codigo: typeof c?.code === "string" ? c.code : null });
}

async function dejarTarea(tx: Tx, workspaceId: string, pedidoId: string, title: string): Promise<void> {
  const ya = await tx.fotofficePedidoTarea.findFirst({ where: { workspaceId, pedidoId, title, doneAt: null }, select: { id: true } });
  if (ya) return;
  const ultima = await tx.fotofficePedidoTarea.findFirst({ where: { workspaceId, pedidoId }, orderBy: [{ position: "desc" }], select: { position: true } });
  await tx.fotofficePedidoTarea.create({ data: { workspaceId, pedidoId, position: (ultima?.position ?? 0) + 1, title }, select: { id: true } });
}

async function dejarNota(tx: Tx, workspaceId: string, proyectoId: string, body: string): Promise<void> {
  await tx.fotofficeProyectoNota.create({ data: { workspaceId, proyectoId, body, authorUserId: null }, select: { id: true } });
}

/** Las cuotas que se pueden achicar sin tocar dinero cobrado ni pagos en curso. */
async function cuotasDelPedido(tx: Tx, workspaceId: string, pedidoId: string, items: unknown) {
  const cuotas = await tx.fotofficePedidoCuota.findMany({
    where: { workspaceId, pedidoId },
    orderBy: [{ position: "asc" }],
    select: { id: true, position: true, amountArs: true },
  });
  const ids = cuotas.map((c) => c.id);
  const [imputadas, esperas] = await Promise.all([
    tx.fotofficeCobroImputacion.findMany({ where: { workspaceId, cuotaId: { in: ids } }, select: { cuotaId: true } }),
    tx.fotofficeEsperaPago.findMany({ where: { workspaceId, cuotaId: { in: ids }, estado: "ESPERANDO" }, select: { cuotaId: true } }),
  ]);
  const ocupadas = new Set([...imputadas.map((i) => i.cuotaId), ...esperas.map((e) => e.cuotaId), ...cuotasDeCargo(items)]);
  return cuotas.map((c) => ({ id: c.id, position: c.position, montoMinor: decimalArsToMinor(c.amountArs), libre: !ocupadas.has(c.id) }));
}

/** Borra las cuotas `ids` y corre hacia arriba las que quedan, sin huecos en `position`. */
async function borrarCuotas(tx: Tx, workspaceId: string, pedidoId: string, ids: readonly string[]): Promise<void> {
  if (ids.length === 0) return;
  await tx.fotofficePedidoCuota.deleteMany({ where: { workspaceId, pedidoId, id: { in: [...ids] } } });
  const quedan = await tx.fotofficePedidoCuota.findMany({ where: { workspaceId, pedidoId }, orderBy: [{ position: "asc" }], select: { id: true, position: true } });
  for (const [i, c] of quedan.entries()) {
    if (c.position !== i + 1) await tx.fotofficePedidoCuota.update({ where: { id: c.id }, data: { position: i + 1 }, select: { id: true } });
  }
}

/**
 * Registrado un cassette que no se pudo digitalizar (`grabacionId`, del trabajo `proyectoId`):
 * descuenta del pedido del trabajo la diferencia con el precio configurado.
 */
export async function bonificarNoDigitalizable(a: { workspaceId: string; proyectoId: string; grabacionId: string; cassette: string }): Promise<ResultadoBonificacion> {
  try {
    const [ajustes, trabajo] = await Promise.all([
      prisma.digitalizacionAjustes.findUnique({ where: { workspaceId: a.workspaceId }, select: { precioNoDigitalizableArs: true } }),
      prisma.fotofficeProyecto.findFirst({ where: { id: a.proyectoId, workspaceId: a.workspaceId }, select: { pedidoId: true, pedidoItemIndex: true } }),
    ]);
    const precio = ajustes?.precioNoDigitalizableArs == null ? null : pesosDeBase(ajustes.precioNoDigitalizableArs);
    if (precio === null || !trabajo?.pedidoId) return { estado: "NADA" };
    const pedidoId = trabajo.pedidoId;
    return await prisma.$transaction(async (tx) => {
      await bloquearPedido(tx, pedidoId);
      const p = await tx.fotofficePedido.findFirst({ where: { id: pedidoId, workspaceId: a.workspaceId }, select: { id: true, status: true, items: true, totals: true, totalArs: true } });
      if (!p || !esEstadoPedido(p.status) || p.status === "CANCELADO") return { estado: "NADA" } as const;
      const previas = await tx.digitalizacionGrabacion.findMany({
        where: { workspaceId: a.workspaceId, proyectoId: a.proyectoId, estado: "COMPLETA", bonificacionArs: { not: null }, id: { not: a.grabacionId } },
        select: { bonificacionArs: true },
      });
      const c = calcularBonificacion({
        items: p.items,
        totals: p.totals,
        pedidoItemIndex: trabajo.pedidoItemIndex,
        bonificacionesPreviasArs: previas.reduce((s, g) => s + (g.bonificacionArs ? pesosDeBase(g.bonificacionArs) : 0), 0),
        precioNoDigitalizableArs: precio,
      });
      if (!c.ok) return { estado: "NADA" } as const;
      const bonifMinor = Math.round(c.bonificacionArs * 100);
      const descuento = descuentoDelRenglonMinor(p.totals, c.itemId);
      const items = descuento === null ? null : itemsConBonificacion(p.items, c.itemId, descuento, c.bonificacionArs);
      const cambios = repartirBonificacion(await cuotasDelPedido(tx, a.workspaceId, p.id, p.items), bonifMinor);
      if (!items || !cambios || decimalArsToMinor(p.totalArs) < bonifMinor) {
        await dejarTarea(tx, a.workspaceId, p.id, tareaBonificacionAMano(a.cassette, c.bonificacionArs));
        return { estado: "A_MANO", bonificacionArs: c.bonificacionArs } as const;
      }
      for (const k of cambios.filter((k) => k.montoMinor > 0)) {
        await tx.fotofficePedidoCuota.update({ where: { id: k.id }, data: { amountArs: pesosParaBase(k.montoMinor / 100) }, select: { id: true } });
      }
      await borrarCuotas(tx, a.workspaceId, p.id, cambios.filter((k) => k.montoMinor === 0).map((k) => k.id));
      const seccion = (p.items as { id?: unknown; seccion?: unknown }[]).find((x) => x?.id === c.itemId)?.seccion;
      await tx.fotofficePedido.update({
        where: { id: p.id },
        data: {
          items: items as unknown as Prisma.InputJsonValue,
          totals: totalesConBonificacion(p.totals, c.itemId, typeof seccion === "string" ? seccion : null, c.bonificacionArs) as Prisma.InputJsonValue,
          totalArs: pesosParaBase(pesosDeBase(p.totalArs) - c.bonificacionArs),
        },
        select: { id: true },
      });
      await tx.digitalizacionGrabacion.update({ where: { id: a.grabacionId }, data: { bonificacionArs: pesosParaBase(c.bonificacionArs) }, select: { id: true } });
      await dejarNota(tx, a.workspaceId, a.proyectoId, `${a.cassette} no se pudo digitalizar: se cobra ${pesosTexto(precio)}. Se descontaron ${pesosTexto(c.bonificacionArs)} del pedido.`);
      return { estado: "APLICADA", bonificacionArs: c.bonificacionArs, precioArs: precio } as const;
    }, OPCIONES_TRANSACCION_PEDIDO);
  } catch (e) {
    falla("bonificarNoDigitalizable", e);
    return { estado: "NADA" };
  }
}

export type ResultadoDeshacer = { estado: "DEVUELTA"; bonificacionArs: number } | { estado: "A_MANO"; bonificacionArs: number } | { estado: "NADA" };

/**
 * «Quitar» un cassette que no se pudo digitalizar: si se había descontado algo, vuelve al pedido
 * (el descuento del renglón baja, el total sube y se suma una cuota que vence hoy por ese importe).
 * Si el renglón ya no tiene ese descuento (alguien lo editó), no toca el pedido y deja una tarea.
 * En los dos casos la grabación queda sin `bonificacionArs`.
 */
export async function deshacerBonificacion(a: { workspaceId: string; grabacionId: string; cassette: string; ahora?: Date }): Promise<ResultadoDeshacer> {
  try {
    const g = await prisma.digitalizacionGrabacion.findFirst({
      where: { id: a.grabacionId, workspaceId: a.workspaceId },
      select: { id: true, bonificacionArs: true, proyectoId: true },
    });
    if (!g?.bonificacionArs || !g.proyectoId) return { estado: "NADA" };
    const proyecto = await prisma.fotofficeProyecto.findFirst({ where: { id: g.proyectoId, workspaceId: a.workspaceId }, select: { id: true, pedidoId: true, pedidoItemIndex: true } });
    if (!proyecto?.pedidoId) return { estado: "NADA" };
    const monto = pesosDeBase(g.bonificacionArs);
    const pedidoId = proyecto.pedidoId;
    return await prisma.$transaction(async (tx) => {
      await bloquearPedido(tx, pedidoId);
      // Otra pestaña ya lo deshizo: no se devuelve dos veces.
      const r = await tx.digitalizacionGrabacion.updateMany({ where: { id: g.id, workspaceId: a.workspaceId, bonificacionArs: { not: null } }, data: { bonificacionArs: null } });
      if (r.count !== 1) return { estado: "NADA" } as const;
      const p = await tx.fotofficePedido.findFirst({ where: { id: pedidoId, workspaceId: a.workspaceId }, select: { id: true, status: true, items: true, totals: true, totalArs: true } });
      const idx = proyecto.pedidoItemIndex;
      const it = p && Array.isArray(p.items) && idx !== null ? (p.items[idx] as { id?: unknown; seccion?: unknown } | undefined) : undefined;
      const itemId = typeof it?.id === "string" ? it.id : null;
      const descuento = p && itemId ? descuentoDelRenglonMinor(p.totals, itemId) : null;
      const items = p && itemId && descuento !== null ? itemsConBonificacion(p.items, itemId, descuento, -monto) : null;
      if (!p || p.status === "CANCELADO" || !itemId || !items) {
        if (p) await dejarTarea(tx, a.workspaceId, p.id, tareaDeshacerAMano(a.cassette, monto));
        return { estado: "A_MANO", bonificacionArs: monto } as const;
      }
      const ultima = await tx.fotofficePedidoCuota.findFirst({ where: { workspaceId: a.workspaceId, pedidoId: p.id }, orderBy: [{ position: "desc" }], select: { position: true } });
      await tx.fotofficePedidoCuota.create({
        data: {
          workspaceId: a.workspaceId,
          pedidoId: p.id,
          position: (ultima?.position ?? 0) + 1,
          dueDate: fechaParaBase(diaEnBuenosAires(a.ahora ?? new Date())),
          amountArs: pesosParaBase(monto),
          suggestedMethod: null,
        },
        select: { id: true },
      });
      await tx.fotofficePedido.update({
        where: { id: p.id },
        data: {
          items: items as unknown as Prisma.InputJsonValue,
          totals: totalesConBonificacion(p.totals, itemId, typeof it?.seccion === "string" ? it.seccion : null, -monto) as Prisma.InputJsonValue,
          totalArs: pesosParaBase(pesosDeBase(p.totalArs) + monto),
        },
        select: { id: true },
      });
      await dejarNota(tx, a.workspaceId, proyecto.id, `Se quitó «${a.cassette} no se pudo digitalizar»: volvieron ${pesosTexto(monto)} al pedido.`);
      return { estado: "DEVUELTA", bonificacionArs: monto } as const;
    }, OPCIONES_TRANSACCION_PEDIDO);
  } catch (e) {
    falla("deshacerBonificacion", e);
    return { estado: "NADA" };
  }
}
