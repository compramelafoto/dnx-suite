import "server-only";
import { prisma } from "@repo/db";
import { puedeVerGalerias, type CtxGalerias } from "./acceso";
import { listarEventos } from "./eventos";
import { EVENTOS_DEL_CLIENTE, MOTIVO_CORREO, etiquetaDeEvento } from "./eventos-etiquetas";

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
  if (tipo === "SELECCION_ENVIADA" && typeof d.cantidad === "number") return d.cantidad === 1 ? "Eligió 1 foto" : `Eligió ${d.cantidad} fotos`;
  if ((tipo === "CONFIRMACION_NO_ENVIADA" || tipo === "AVISO_ESTUDIO_NO_ENVIADO") && typeof d.motivo === "string") return `Motivo: ${MOTIVO_CORREO[d.motivo] ?? "no se pudo enviar"}`;
  if (tipo === "FOTO_BORRADA" && typeof d.selecciones === "number") {
    return d.selecciones === 0 ? null : d.selecciones === 1 ? "Se llevó 1 elección de un cliente" : `Se llevó ${d.selecciones} elecciones de clientes`;
  }
  return null;
}

export const TAMANO_PAGINA_HISTORIAL = 50;

export type PaginaHistorial = { items: ItemHistorial[]; pagina: number; hayMas: boolean };

/**
 * El historial de una galería, del más nuevo al más viejo y de a 50, con quién lo hizo (el usuario del
 * estudio o, en lo que hace el cliente desde su enlace, el cliente) y a qué cliente se refiere. Todo acotado al
 * workspace de la sesión.
 */
export async function cargarHistorial(ctx: CtxGalerias, galeriaId: string, pagina = 1): Promise<PaginaHistorial> {
  const n = Number.isInteger(pagina) && pagina >= 1 && pagina <= 10_000 ? pagina : 1;
  if (!puedeVerGalerias(ctx)) return { items: [], pagina: n, hayMas: false };
  const { workspaceId } = ctx;
  // Uno de más para saber si hay página siguiente.
  const leidos = await listarEventos(workspaceId, galeriaId, TAMANO_PAGINA_HISTORIAL + 1, (n - 1) * TAMANO_PAGINA_HISTORIAL);
  const hayMas = leidos.length > TAMANO_PAGINA_HISTORIAL;
  const eventos = leidos.slice(0, TAMANO_PAGINA_HISTORIAL);
  const actorIds = [...new Set(eventos.map((e) => e.actorUserId).filter((x): x is number => x !== null))];
  const clienteIds = [...new Set(eventos.map((e) => e.galeriaClienteId).filter((x): x is string => x !== null))];
  const [usuarios, clientes] = await Promise.all([
    actorIds.length ? prisma.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true, email: true } }) : Promise.resolve([]),
    clienteIds.length ? prisma.fotofficeGaleriaCliente.findMany({ where: { workspaceId, galeriaId, id: { in: clienteIds } }, select: { id: true, name: true } }) : Promise.resolve([]),
  ]);
  const nombreDeUsuario = new Map(usuarios.map((u) => [u.id, u.name?.trim() || u.email || "Equipo"]));
  const nombreDeCliente = new Map(clientes.map((c) => [c.id, c.name]));
  const items = eventos.map((e) => {
    const cliente = e.galeriaClienteId ? (nombreDeCliente.get(e.galeriaClienteId) ?? null) : null;
    const delCliente = e.actorUserId === null && EVENTOS_DEL_CLIENTE.includes(e.tipo);
    return {
      id: e.id,
      fecha: e.createdAt.toISOString(),
      actor: e.actorUserId !== null ? (nombreDeUsuario.get(e.actorUserId) ?? null) : delCliente ? cliente : null,
      etiqueta: etiquetaDeEvento(e.tipo),
      // Si el actor ya es el cliente no se repite al final.
      cliente: delCliente ? null : cliente,
      detalle: detalleDe(e.tipo, e.data),
    };
  });
  return { items, pagina: n, hayMas };
}
