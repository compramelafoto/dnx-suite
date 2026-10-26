import "server-only";
import { prisma } from "@repo/db";
import { puedeEnContexto } from "@/lib/access/policy";
import type { PasoVista } from "@/lib/circuitos/ficha-vista";
import { pedidoDelTrabajo, type PedidoDelTrabajo } from "@/lib/impresiones/trabajo-servidor";
import { decimalArsToMinor } from "@/lib/membership/money";
import { ORDERS_MODULE_KEY } from "@/lib/pedidos/acceso";
import { ETIQUETA_ESTADO_PEDIDO, ETIQUETA_MEDIO_COBRO, esEstadoPedido, esMedioCobro } from "@/lib/pedidos/constantes";
import type { CtxProyectos } from "./acceso";
import { cargarFichaProyecto } from "./ficha";

/**
 * Lo que muestra la ficha flotante de "Trabajos en curso" al tocar una tarjeta: lo que la tarjeta no
 * llega a mostrar (qué se vendió, cobros, laboratorio, notas e historial de pasos). Se lee recién
 * al abrirla, acotado al workspace de la sesión, con los mismos permisos que la ficha completa.
 */

export type DetalleTrabajo = {
  descripcion: string | null;
  responsable: string | null;
  /** null si no viene de un pedido o si quien mira no ve Pedidos. */
  pedido: {
    id: string;
    numero: string;
    estado: string;
    items: { nombre: string; cantidad: number }[];
    totalMinor: number;
    cobradoMinor: number;
    cobros: { id: string; fecha: string; medio: string; montoMinor: number }[];
  } | null;
  impresion: PedidoDelTrabajo | null;
  proveedorRef: string | null;
  notas: { id: string; texto: string; autor: string | null; fecha: string }[];
  /** Del más nuevo al más viejo. */
  historial: PasoVista[];
};

const MAX_NOTAS = 5;

export async function cargarDetalleTrabajo(ctx: CtxProyectos, proyectoId: string, ahora: Date): Promise<DetalleTrabajo | null> {
  const ficha = await cargarFichaProyecto(ctx, proyectoId, ahora);
  if (!ficha) return null;
  const { workspaceId } = ctx;
  const vePedido = ficha.pedido !== null && puedeEnContexto(ctx, "ver", ORDERS_MODULE_KEY);

  const [proyecto, pedido, cobros, impresion] = await Promise.all([
    prisma.fotofficeProyecto.findFirst({ where: { id: ficha.id, workspaceId }, select: { proveedorRef: true } }),
    vePedido
      ? prisma.fotofficePedido.findFirst({ where: { id: ficha.pedido!.id, workspaceId }, select: { id: true, number: true, status: true, items: true, totalArs: true } })
      : Promise.resolve(null),
    vePedido
      ? prisma.fotofficeCobro.findMany({
          where: { workspaceId, pedidoId: ficha.pedido!.id, voidedAt: null },
          select: { id: true, paidAt: true, method: true, amountArs: true },
          orderBy: [{ paidAt: "asc" }, { id: "asc" }],
        })
      : Promise.resolve([]),
    pedidoDelTrabajo(workspaceId, ficha.id),
  ]);

  const items = pedido && Array.isArray(pedido.items)
    ? pedido.items
        .filter((i): i is { nombre: string; cantidad: number; opcional?: boolean } => {
          const o = i as Record<string, unknown> | null;
          return !!o && typeof o.nombre === "string" && typeof o.cantidad === "number" && o.opcional !== true;
        })
        .map((i) => ({ nombre: i.nombre, cantidad: i.cantidad }))
    : [];

  return {
    descripcion: ficha.descripcion,
    responsable: ficha.responsable?.nombre ?? null,
    pedido: pedido
      ? {
          id: pedido.id,
          numero: pedido.number,
          estado: esEstadoPedido(pedido.status) ? ETIQUETA_ESTADO_PEDIDO[pedido.status] : pedido.status,
          items,
          totalMinor: decimalArsToMinor(pedido.totalArs),
          cobradoMinor: cobros.reduce((s, c) => s + decimalArsToMinor(c.amountArs), 0),
          cobros: cobros.map((c) => ({
            id: c.id,
            fecha: c.paidAt.toISOString(),
            medio: esMedioCobro(c.method) ? ETIQUETA_MEDIO_COBRO[c.method] : c.method,
            montoMinor: decimalArsToMinor(c.amountArs),
          })),
        }
      : null,
    impresion,
    proveedorRef: proyecto?.proveedorRef ?? null,
    notas: ficha.notas.slice(0, MAX_NOTAS).map((n) => ({ id: n.id, texto: n.texto, autor: n.autor, fecha: n.fecha })),
    historial: ficha.recorrido?.historial ?? [],
  };
}
