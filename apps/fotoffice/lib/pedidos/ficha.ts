import "server-only";
import { prisma } from "@repo/db";
import { CODIGO_ENVIO_EN_CURSO } from "@/lib/plantillas/constantes";
import { MENSAJES_EN_HISTORIAL, nombresDePlantillas, SELECT_MENSAJE } from "@/lib/plantillas/registro";
import { vistaDeMensaje, type MensajeVista } from "@/lib/plantillas/vista-mensaje";
import type { CostosVersion } from "@/lib/presupuestos/costos";
import { veCostosDePedido, type CtxPedidos } from "./acceso";
import type { DetallePedido } from "./pedidos";

/**
 * Lecturas de la ficha del pedido que no están en `leerPedido`: el historial de mensajes (los que
 * quedaron registrados con `entityType` PEDIDO: el recibo automático, "Tu pedido" y los que se
 * mandan desde la ficha), el costo y el margen (sólo con `veCostosDePedido`) y los rubros de
 * ingreso para elegir. Quien llama ya leyó el pedido dentro del workspace de la sesión.
 */

/** Mensajes del pedido, el más nuevo primero. */
export async function mensajesDePedido(workspaceId: string, pedidoId: string): Promise<MensajeVista[]> {
  const leidas = await prisma.fotofficeMessage.findMany({
    where: {
      workspaceId,
      entityType: "PEDIDO",
      entityId: pedidoId,
      // Las reservas de un envío automático en curso (o abandonado) no son mensajes.
      OR: [{ errorCode: null }, { errorCode: { not: CODIGO_ENVIO_EN_CURSO } }],
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: MENSAJES_EN_HISTORIAL,
    select: SELECT_MENSAJE,
  });
  if (leidas.length === 0) return [];
  const nombres = await nombresDePlantillas(workspaceId, leidas.map((f) => f.templateId));
  return leidas.map((f) => vistaDeMensaje(f, f.templateId ? (nombres.get(f.templateId) ?? null) : null));
}

/**
 * Costo y margen del pedido: los de la versión aceptada del presupuesto (su `costSnapshot`, con las
 * mismas claves de renglón que los ítems del pedido). Sólo con `configurar` o `verDinero`; a quien
 * no los tiene le devuelve null sin leer nada. Un pedido cargado a mano no tiene costos guardados.
 */
export async function costosDelPedido(ctx: CtxPedidos, detalle: Pick<DetallePedido, "acceptedVersionId">): Promise<CostosVersion | null> {
  if (!veCostosDePedido(ctx) || !detalle.acceptedVersionId) return null;
  const v = await prisma.fotofficePresupuestoVersion.findFirst({
    where: { id: detalle.acceptedVersionId, workspaceId: ctx.workspaceId },
    select: { costSnapshot: true },
  });
  const c = v?.costSnapshot as CostosVersion | null | undefined;
  return c && typeof c === "object" && typeof c.costoTotal === "number" ? c : null;
}

/** Rubros de ingreso activos del workspace (más el actual del pedido, aunque esté inactivo). */
export async function rubrosDeIngreso(workspaceId: string, actual: string | null): Promise<{ id: string; nombre: string }[]> {
  const filas = await prisma.cashCategory.findMany({
    where: { workspaceId, kind: "INGRESO", OR: [{ isActive: true }, ...(actual ? [{ id: actual }] : [])] },
    orderBy: [{ order: "asc" }, { name: "asc" }],
    select: { id: true, name: true },
    take: 500,
  });
  return filas.map((f) => ({ id: f.id, nombre: f.name }));
}

/** Nombre del archivo de cada comprobante adjunto a los cobros (sólo del workspace). */
export async function comprobantesDeCobros(workspaceId: string, cobroIds: readonly string[]): Promise<Map<string, string>> {
  if (cobroIds.length === 0) return new Map();
  const cobros = await prisma.fotofficeCobro.findMany({
    where: { workspaceId, id: { in: [...cobroIds] }, attachmentId: { not: null } },
    select: { id: true, attachmentId: true },
  });
  const ids = cobros.map((c) => c.attachmentId).filter((x): x is string => !!x);
  if (ids.length === 0) return new Map();
  const adjuntos = await prisma.fotofficeAttachment.findMany({ where: { workspaceId, id: { in: ids } }, select: { id: true, fileName: true } });
  const nombre = new Map(adjuntos.map((a) => [a.id, a.fileName]));
  return new Map(cobros.flatMap((c) => (c.attachmentId && nombre.has(c.attachmentId) ? [[c.id, nombre.get(c.attachmentId)!]] : [])));
}
