import "server-only";
import { prisma } from "@repo/db";
import { canViewCallImage } from "@repo/muestras";
import { puedeConDueno } from "@/lib/equipo/permisos";
import type { Usuario } from "@/lib/usuario";

/**
 * La URL interna de la imagen de una obra enviada, si esta persona puede verla por la ruta
 * anónima; si no, `null`. La URL nunca sale de acá: la ruta la lee del bucket y la sirve.
 *
 * El permiso se mira contra la convocatoria de ESA obra (su `callId`): ser curador de otra
 * convocatoria no alcanza.
 */
export async function imagenAutorizada(callWorkId: string, usuario: Usuario): Promise<string | null> {
  const w = await prisma.culturalCallWork.findUnique({
    where: { id: callWorkId },
    select: {
      imageUrl: true,
      callId: true,
      anonymousCode: true,
      submission: { select: { status: true } },
      call: { select: { status: true, activity: { select: { proposedByUserId: true } } } },
    },
  });
  // Sin código anónimo la obra todavía no entró a la curaduría: no se sirve por acá.
  if (!w || !w.anonymousCode || w.submission.status !== "ACTIVE") return null;
  const k = await prisma.culturalCallCurator.findFirst({ where: { callId: w.callId, userId: usuario.id }, select: { status: true } });
  const puede = canViewCallImage({
    status: w.call.status,
    // Sólo el dueño (`manageCall`, D4): la coorganización no ve la imagen anónima. El super admin
    // entra por `isSuperAdmin`.
    isOwner: puedeConDueno({ ...usuario, esSuperAdmin: false }, "manageCall", w.call.activity.proposedByUserId),
    isSuperAdmin: usuario.esSuperAdmin,
    curatorStatus: k?.status ?? null,
  });
  return puede ? w.imageUrl : null;
}
