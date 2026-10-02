import "server-only";
import { prisma } from "@repo/db";
import { vistaDeMensaje, type MensajeVista } from "./vista-mensaje";

/** Lo que se lee de un mensaje registrado para mostrarlo (línea de tiempo e historial). */
export const SELECT_MENSAJE = {
  id: true, channel: true, status: true, automatic: true, toAddress: true, subject: true, body: true, errorCode: true,
  actorLabel: true, createdAt: true, templateId: true,
} as const;

/** Nombre de las plantillas usadas, sólo del workspace (una plantilla borrada no tiene nombre). */
export async function nombresDePlantillas(workspaceId: string, ids: (string | null)[]): Promise<Map<string, string>> {
  const unicos = [...new Set(ids.filter((id): id is string => typeof id === "string" && id.length > 0))];
  if (unicos.length === 0) return new Map();
  const filas = await prisma.fotofficeMessageTemplate.findMany({
    where: { workspaceId, id: { in: unicos } },
    select: { id: true, name: true },
  });
  return new Map(filas.map((p) => [p.id, p.name]));
}

/** Tope de mensajes que se intercalan en el historial de una consulta (como los cambios de "Más datos"). */
export const MENSAJES_EN_HISTORIAL = 100;

/**
 * Mensajes de una consulta, el más nuevo primero, para su historial. Quien llama ya verificó que
 * la consulta es del workspace de la sesión (`cargarFicha` acotada a `workspace.id`); igual se
 * filtra por workspace y tipo.
 */
export async function mensajesDeConsulta(workspaceId: string, consultaId: string): Promise<MensajeVista[]> {
  const leidas = await prisma.fotofficeMessage.findMany({
    where: { workspaceId, entityType: "CONSULTA", entityId: consultaId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: MENSAJES_EN_HISTORIAL,
    select: SELECT_MENSAJE,
  });
  if (leidas.length === 0) return [];
  const nombres = await nombresDePlantillas(workspaceId, leidas.map((f) => f.templateId));
  return leidas.map((f) => vistaDeMensaje(f, f.templateId ? (nombres.get(f.templateId) ?? null) : null));
}
