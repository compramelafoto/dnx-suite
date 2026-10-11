import "server-only";
import type { Prisma } from "@repo/db";
import { MAX_WORKS, authorCredit, contestWorkInGallery } from "@repo/muestras";

/**
 * Llevar una obra del concurso a la galería de la muestra, o sacarla (etapa 7, D13, D14, D16, D28).
 * Una sola regla decide (`contestWorkInGallery`: marcada, con la imagen copiada y con permiso) y esta
 * función deja `CulturalActivityWork` igual a lo que dice. Se llama **dentro de una transacción que ya
 * bloqueó la muestra**: al armar, al copiar cada imagen, al cambiar una casilla y al responder el autor.
 *
 * El nombre del autor sale de `authorCredit` (D28): con atribución en sus bases, su confirmación o una
 * autorización escrita, su nombre (y su perfil); si no, "Autoría reservada" sin perfil. Re-sincronizar
 * actualiza imagen, nombre y perfil: así una obra pasa de "Autoría reservada" al nombre cuando el autor
 * confirma.
 *
 * Si la obra sale de la muestra porque quien organiza la quitó o el autor no quiso, la copia de la
 * imagen ya no tiene que estar en el bucket: se limpia la fila y se devuelve su URL en `borrarImagen`
 * para borrarla **después** de la transacción (`borrarImagenDeConcurso`, a mejor esfuerzo).
 */
export const AVISO_TOPE = `La muestra llegó al máximo técnico de ${MAX_WORKS} obras.`;

export type Sincronizacion = {
  cambio: "CREADA" | "ACTUALIZADA" | "SACADA" | "SIN_CAMBIO" | "TOPE";
  aviso?: string;
  borrarImagen?: string;
};

const FILA = {
  id: true, activityId: true, include: true, imageStatus: true, imageUrl: true, exhibitConsent: true, consentBy: true,
  attributionRequired: true, authorUserId: true, authorName: true, title: true, rank: true, activityWorkId: true,
} as const;

/** Dónde entra una obra nueva: antes de la primera obra del concurso con peor puesto que ya está, o al final. */
async function lugarEnLaGaleria(tx: Prisma.TransactionClient, activityId: string, row: { id: string; rank: number }): Promise<number> {
  const siguientes = await tx.culturalContestWork.findMany({
    where: { activityId, id: { not: row.id }, activityWorkId: { not: null }, rank: { gt: row.rank } },
    select: { activityWorkId: true },
  });
  const ids = siguientes.flatMap((s) => (s.activityWorkId ? [s.activityWorkId] : []));
  if (ids.length) {
    const primera = await tx.culturalActivityWork.aggregate({ where: { activityId, id: { in: ids } }, _min: { sortOrder: true } });
    const lugar = primera._min.sortOrder;
    if (lugar != null) {
      await tx.culturalActivityWork.updateMany({ where: { activityId, sortOrder: { gte: lugar } }, data: { sortOrder: { increment: 1 } } });
      return lugar;
    }
  }
  const ultima = await tx.culturalActivityWork.aggregate({ where: { activityId }, _max: { sortOrder: true } });
  return (ultima._max.sortOrder ?? -1) + 1;
}

export async function sincronizarObraConGaleria(tx: Prisma.TransactionClient, activityId: string, contestWorkId: string): Promise<Sincronizacion> {
  const row = await tx.culturalContestWork.findFirst({ where: { id: contestWorkId, activityId }, select: FILA });
  if (!row) return { cambio: "SIN_CAMBIO" };
  const actual = row.activityWorkId
    ? await tx.culturalActivityWork.findFirst({ where: { id: row.activityWorkId, activityId }, select: { id: true } })
    : null;

  if (contestWorkInGallery(row)) {
    const autor =
      row.authorUserId != null
        ? await tx.culturalContestAuthor.findUnique({
            where: { activityId_userId: { activityId, userId: row.authorUserId } },
            select: { displayName: true, profileId: true },
          })
        : null;
    const credito = authorCredit({
      attributionRequired: row.attributionRequired, exhibitConsent: row.exhibitConsent, consentBy: row.consentBy,
      signedName: autor?.displayName ?? null, defaultName: row.authorName,
    });
    const datos = {
      imageUrl: row.imageUrl!,
      authorName: credito.name,
      authorUserId: row.authorUserId,
      authorProfileId: credito.show ? (autor?.profileId ?? null) : null,
    };
    if (actual) {
      await tx.culturalActivityWork.update({ where: { id: actual.id }, data: datos });
      return { cambio: "ACTUALIZADA" };
    }
    if ((await tx.culturalActivityWork.count({ where: { activityId } })) >= MAX_WORKS) {
      if (row.activityWorkId) await tx.culturalContestWork.update({ where: { id: row.id }, data: { activityWorkId: null } });
      return { cambio: "TOPE", aviso: AVISO_TOPE };
    }
    const sortOrder = await lugarEnLaGaleria(tx, activityId, row);
    const creada = await tx.culturalActivityWork.create({
      data: { ...datos, activityId, title: row.title, isHighlight: false, sortOrder },
      select: { id: true },
    });
    await tx.culturalContestWork.update({ where: { id: row.id }, data: { activityWorkId: creada.id } });
    return { cambio: "CREADA" };
  }

  let cambio: Sincronizacion["cambio"] = "SIN_CAMBIO";
  const limpiar: Prisma.CulturalContestWorkUpdateInput = {};
  if (actual) {
    await tx.culturalActivityWork.deleteMany({ where: { id: actual.id, activityId } });
    // Su código impreso de sala ya no da pase (la obra no está).
    await tx.culturalActivityRoomCode.deleteMany({ where: { activityId, workId: actual.id } });
    cambio = "SACADA";
  }
  if (row.activityWorkId) limpiar.activityWorkId = null;
  // Quien organiza la quitó o el autor no quiso: la copia se borra del bucket (D16).
  const fuera = !row.include || row.exhibitConsent === "DECLINED" || row.exhibitConsent === "WITHDRAWN";
  const borrarImagen = fuera && row.imageUrl ? row.imageUrl : undefined;
  if (borrarImagen) Object.assign(limpiar, { imageStatus: "PENDING", imageUrl: null, imageError: null, copiedAt: null });
  if (Object.keys(limpiar).length) await tx.culturalContestWork.update({ where: { id: row.id }, data: limpiar });
  return borrarImagen ? { cambio, borrarImagen } : { cambio };
}
