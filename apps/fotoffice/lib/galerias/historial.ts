import "server-only";
import { prisma } from "@repo/db";
import { puedeVerGalerias, type CtxGalerias } from "./acceso";
import { listarEventos } from "./eventos";
import { MOTIVO_CORREO, etiquetaDeEvento } from "./eventos-etiquetas";

export type ItemHistorial = {
  id: string;
  /** ISO. */
  fecha: string;
  actor: string | null;
  etiqueta: string;
  cliente: string | null;
  detalle: string | null;
};

function detalleDe(tipo: string, data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  if (tipo === "CORREO_NO_ENVIADO" && typeof d.motivo === "string") return `Motivo: ${MOTIVO_CORREO[d.motivo] ?? "no se pudo enviar"}`;
  if (tipo === "FOTO_BORRADA" && typeof d.selecciones === "number") {
    return d.selecciones === 0 ? null : d.selecciones === 1 ? "Se llevó 1 elección de un cliente" : `Se llevó ${d.selecciones} elecciones de clientes`;
  }
  return null;
}

/** El historial de una galería (del más nuevo al más viejo), con quién lo hizo y a qué cliente se refiere. */
export async function cargarHistorial(ctx: CtxGalerias, galeriaId: string): Promise<ItemHistorial[]> {
  if (!puedeVerGalerias(ctx)) return [];
  const { workspaceId } = ctx;
  const eventos = await listarEventos(workspaceId, galeriaId);
  const actorIds = [...new Set(eventos.map((e) => e.actorUserId).filter((x): x is number => x !== null))];
  const clienteIds = [...new Set(eventos.map((e) => e.galeriaClienteId).filter((x): x is string => x !== null))];
  const [usuarios, clientes] = await Promise.all([
    actorIds.length ? prisma.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true, email: true } }) : Promise.resolve([]),
    clienteIds.length ? prisma.fotofficeGaleriaCliente.findMany({ where: { workspaceId, galeriaId, id: { in: clienteIds } }, select: { id: true, name: true } }) : Promise.resolve([]),
  ]);
  const nombreDeUsuario = new Map(usuarios.map((u) => [u.id, u.name?.trim() || u.email || "Equipo"]));
  const nombreDeCliente = new Map(clientes.map((c) => [c.id, c.name]));
  return eventos.map((e) => ({
    id: e.id,
    fecha: e.createdAt.toISOString(),
    actor: e.actorUserId !== null ? (nombreDeUsuario.get(e.actorUserId) ?? null) : null,
    etiqueta: etiquetaDeEvento(e.tipo),
    cliente: e.galeriaClienteId ? (nombreDeCliente.get(e.galeriaClienteId) ?? null) : null,
    detalle: detalleDe(e.tipo, e.data),
  }));
}
