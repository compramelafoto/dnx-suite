import "server-only";
import { prisma } from "@repo/db";
import { sanitizeDisplayName, sanitizeReplyTo, type WorkspaceSender } from "./sender-name";

/**
 * El remitente de los correos de una institución: su nombre comercial (o el del workspace) y su
 * casilla de contacto para las respuestas. Nunca lanza: si la base falla, el correo sale con el
 * remitente del entorno, como antes.
 */
export async function loadWorkspaceSender(workspaceId: string): Promise<WorkspaceSender> {
  try {
    const ws = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { name: true, fotofficeBranding: { select: { commercialName: true, contactEmail: true } } },
    });
    if (!ws) return { name: null, replyTo: null };
    return {
      name: sanitizeDisplayName(ws.fotofficeBranding?.commercialName) ?? sanitizeDisplayName(ws.name),
      replyTo: sanitizeReplyTo(ws.fotofficeBranding?.contactEmail),
    };
  } catch (error) {
    console.error("[fotoffice][comunicaciones] no se pudo leer el remitente de la institución", {
      workspaceId,
      detalle: error instanceof Error ? error.message : "error desconocido",
    });
    return { name: null, replyTo: null };
  }
}
