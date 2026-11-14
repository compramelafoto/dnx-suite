import "server-only";
import { randomUUID } from "node:crypto";
import { prisma, type Prisma } from "@repo/db";
import { agendaEncendida, crearCitasDelPedido } from "@/lib/agenda/crear";
import { validarItem, type ItemPresupuesto } from "@/lib/presupuestos/constantes";
import { diaEnBuenosAires } from "@/lib/presupuestos/estados";
import { crearProyectosDelPedido, proyectosEncendidos } from "@/lib/proyectos/crear";
import { MENSAJE_INSUMO_NO_SE_VENDE, esVendible } from "@/lib/sales/vendible";
import { MENSAJES_PEDIDO, puedeGestionarPedidos, type CtxPedidos } from "./acceso";
import { ajustarTotales, hayLugarParaOtroItem } from "./cargos-puro";
import { esEstadoPedido, OPCIONES_TRANSACCION_PEDIDO } from "./constantes";
import { crearCuentasDelPedido } from "./cuentas-pagar";
import { apartarStock } from "./pedidos";
import { bloquearPedido, fechaParaBase, pesosDeBase, pesosParaBase } from "./plan";
import { aCentavos, desdeCentavos, esFechaValida } from "./plan-cuotas";
import { claveDeItemAgregado, itemsParaElAgregado, netoDelItem } from "./agregar-item-puro";

/**
 * «Agregar producto» a un pedido ya tomado (pedido de Cami, 14/11/2026): la clienta trajo 2 VHS y
 * después sumó un tercero; o se vendió una foto y después se lleva un portarretrato. En vez de un
 * pedido nuevo, el renglón se suma al mismo pedido como si hubiera estado desde el principio:
 *
 * - El ítem va AL FINAL de `items` (los `pedidoItemIndex` de los trabajos que ya existen no se
 *   mueven), el total sube lo que vale el renglón y se agrega una cuota por esa diferencia que vence
 *   hoy, igual que un cargo (`./cargos.ts`): el plan sigue cuadrando y el saldo nuevo se cobra como
 *   cualquier saldo (Cobrador, «Registrar cobro» o «Cobrar y entregar» del tablero).
 * - Se crean sus trabajos con las mismas reglas que al tomar el pedido (`crearProyectosDelPedido`,
 *   sólo para este renglón); sin regla, entra al flujo «Para retirar» y aparta su stock, como un
 *   renglón marcado «Seña» en el Cobrador. También sus cuentas a pagar y sus citas.
 * - Un trabajo de digitalización queda atado a su renglón: cuenta en los cassettes esperados y sus
 *   videos se entregan con los demás.
 * - Todo con el candado del pedido (`bloquearPedido`). CANCELADO no acepta; COMPLETADO sí y sigue
 *   COMPLETADO (el estado se pasa a mano), como los cargos.
 * - `clave`: la misma clave dos veces (doble clic, reintento) suma un solo renglón.
 *
 * Nunca loguea datos personales.
 */

export type DatosAgregarItem = {
  pedidoId: unknown;
  /** Producto del catálogo, o null para un renglón de texto libre. */
  productId: unknown;
  nombre: unknown;
  cantidad: unknown;
  /** Pesos por unidad. */
  precioUnitario: unknown;
  /** "aaaa-mm-dd": la entrega prometida de los trabajos nuevos (opcional). */
  entrega?: unknown;
  clave: unknown;
};

export type ResultadoAgregarItem =
  | { ok: true; repetido: boolean; trabajos: number; saldoAgregadoArs: number }
  | { ok: false; error: string };

export const MENSAJES_AGREGAR = {
  muchosItems: "El pedido ya tiene demasiados renglones para sumar otro.",
  clave: "Volvé a tocar «Agregar».",
} as const;

class Corte extends Error {
  constructor(readonly mensaje: string) {
    super(mensaje);
  }
}

const CLAVE = /^[A-Za-z0-9_-]{8,40}$/;
const ID = /^[A-Za-z0-9_-]{1,64}$/;

export async function agregarItemAlPedido(ctx: CtxPedidos, datos: DatosAgregarItem, ahora: Date = new Date()): Promise<ResultadoAgregarItem> {
  if (!puedeGestionarPedidos(ctx) || ctx.userId === null) return { ok: false, error: MENSAJES_PEDIDO.sinPermiso };
  if (!datos || typeof datos !== "object") return { ok: false, error: MENSAJES_PEDIDO.datosInvalidos };
  const { workspaceId } = ctx;
  if (typeof datos.pedidoId !== "string" || !ID.test(datos.pedidoId)) return { ok: false, error: MENSAJES_PEDIDO.noExiste };
  if (typeof datos.clave !== "string" || !CLAVE.test(datos.clave)) return { ok: false, error: MENSAJES_AGREGAR.clave };
  const productId = datos.productId === null || datos.productId === undefined || datos.productId === "" ? null : datos.productId;
  if (productId !== null && (typeof productId !== "string" || !ID.test(productId))) return { ok: false, error: MENSAJES_PEDIDO.producto };
  const entrega = datos.entrega === undefined || datos.entrega === null || datos.entrega === "" ? null : datos.entrega;
  if (entrega !== null && !esFechaValida(entrega)) return { ok: false, error: "La fecha de entrega no es válida." };

  const v = validarItem({
    id: claveDeItemAgregado(datos.clave),
    productId,
    nombre: datos.nombre,
    descripcion: null,
    cantidad: datos.cantidad,
    precioUnitario: datos.precioUnitario,
    descuento: null,
    modoPrecio: "LISTA",
    calculo: null,
    seccion: null,
    opcional: false,
  });
  if (!v.ok) return v;
  const item: ItemPresupuesto = { ...v.valor, calculo: null, opcional: false };
  if (!Number.isInteger(item.cantidad)) return { ok: false, error: `La cantidad de "${item.nombre}" tiene que ser un número entero.` };
  const neto = netoDelItem(item);

  // El producto: del catálogo de este workspace y que se venda. ¿Lleva proceso propio?
  let conRegla = false;
  // Con talles no se aparta: acá no se elige talle (`apartarStock` necesitaría cuál).
  let apartaUnidad = false;
  if (item.productId !== null) {
    const p = await prisma.product.findFirst({ where: { id: item.productId, workspaceId }, select: { id: true, kind: true } });
    if (!p) return { ok: false, error: MENSAJES_PEDIDO.producto };
    if (!esVendible(p.kind)) return { ok: false, error: MENSAJE_INSUMO_NO_SE_VENDE };
    apartaUnidad = (await prisma.productVariant.count({ where: { workspaceId, productId: p.id } })) === 0;
    conRegla = (await prisma.fotofficeProductoProyecto.count({ where: { workspaceId, productId: p.id } })) > 0;
  }

  const conProyectos = await proyectosEncendidos(workspaceId);
  const conCitas = await agendaEncendida(workspaceId);
  try {
    return await prisma.$transaction(async (tx): Promise<ResultadoAgregarItem> => {
      await bloquearPedido(tx, datos.pedidoId as string);
      const p = await tx.fotofficePedido.findFirst({
        where: { id: datos.pedidoId as string, workspaceId },
        select: { id: true, number: true, status: true, items: true, totals: true, totalArs: true, clientId: true, eventDate: true, eventLabel: true, ownerUserId: true },
      });
      if (!p || !esEstadoPedido(p.status)) throw new Corte(MENSAJES_PEDIDO.noExiste);
      if (p.status === "CANCELADO") throw new Corte(MENSAJES_PEDIDO.cancelado);
      const actuales = Array.isArray(p.items) ? (p.items as unknown[]) : [];
      // La misma clave otra vez: el renglón ya está. No se escribe nada.
      if (actuales.some((i) => (i as { id?: unknown } | null)?.id === item.id)) {
        return { ok: true, repetido: true, trabajos: 0, saldoAgregadoArs: 0 };
      }
      if (!hayLugarParaOtroItem(p.items)) throw new Corte(MENSAJES_AGREGAR.muchosItems);
      const indice = actuales.length;
      const items = [...(actuales as { opcional?: boolean }[]), item];

      if (neto > 0) {
        const ultima = await tx.fotofficePedidoCuota.findFirst({
          where: { workspaceId, pedidoId: p.id },
          orderBy: [{ position: "desc" }],
          select: { position: true },
        });
        await tx.fotofficePedidoCuota.create({
          data: {
            id: randomUUID(),
            workspaceId,
            pedidoId: p.id,
            position: (ultima?.position ?? 0) + 1,
            dueDate: fechaParaBase(diaEnBuenosAires(ahora)),
            amountArs: pesosParaBase(neto),
            suggestedMethod: null,
          },
          select: { id: true },
        });
      }
      await tx.fotofficePedido.update({
        where: { id: p.id },
        data: {
          items: items as unknown as Prisma.InputJsonValue,
          totals: ajustarTotales(p.totals, item.id, neto, neto) as Prisma.InputJsonValue,
          totalArs: pesosParaBase(desdeCentavos(aCentavos(pesosDeBase(p.totalArs)) + aCentavos(neto))),
        },
        select: { id: true },
      });

      // Sin regla propia va a «Para retirar» y aparta su unidad (`apartarStock` sólo mueve los que controlan stock).
      const lineas = !conRegla && item.productId !== null && apartaUnidad
        ? [{ itemId: item.id, productId: item.productId, variantId: null, cantidad: item.cantidad }]
        : [];
      await apartarStock(tx, { workspaceId, pedidoId: p.id, items: [item], lineas, createdByUserId: ctx.userId });
      await crearCuentasDelPedido(tx, { workspaceId, pedidoId: p.id, items: [item], fechaEvento: p.eventDate, createdByUserId: ctx.userId });

      const soloElNuevo = itemsParaElAgregado(items, indice);
      const antes = conProyectos ? await tx.fotofficeProyecto.count({ where: { workspaceId, pedidoId: p.id } }) : 0;
      if (conProyectos && p.clientId) {
        await crearProyectosDelPedido(tx, ctx, {
          pedidoId: p.id,
          clientId: p.clientId,
          items: soloElNuevo,
          fechaEvento: p.eventDate,
          eventLabel: p.eventLabel,
          numeroPedido: p.number,
          ownerUserId: p.ownerUserId ?? ctx.userId,
          confirmadoEn: ahora,
          paraRetirar: conRegla ? new Set<number>() : new Set([indice]),
        });
        if (entrega !== null) {
          await tx.fotofficeProyecto.updateMany({
            where: { workspaceId, pedidoId: p.id, pedidoItemIndex: indice },
            data: { entregaPrometida: new Date(`${entrega}T12:00:00Z`) },
          });
        }
      }
      if (conCitas && p.clientId) {
        await crearCitasDelPedido(tx, workspaceId, {
          pedidoId: p.id,
          clientId: p.clientId,
          items: soloElNuevo,
          fechaEvento: p.eventDate,
          eventLabel: p.eventLabel,
          numeroPedido: p.number,
          ownerUserId: p.ownerUserId ?? ctx.userId,
          createdByUserId: ctx.userId,
        });
      }
      const despues = conProyectos ? await tx.fotofficeProyecto.count({ where: { workspaceId, pedidoId: p.id } }) : 0;
      return { ok: true, repetido: false, trabajos: despues - antes, saldoAgregadoArs: neto };
    }, OPCIONES_TRANSACCION_PEDIDO);
  } catch (e) {
    if (e instanceof Corte) return { ok: false, error: e.mensaje };
    const err = e as { code?: unknown } | null;
    console.error("[pedidos] agregarItemAlPedido falló", { codigo: typeof err?.code === "string" ? err.code : null });
    return { ok: false, error: MENSAJES_PEDIDO.fallo };
  }
}
