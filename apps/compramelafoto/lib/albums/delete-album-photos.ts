/**
 * Borrado masivo de fotos del panel del álbum, en dos tiempos:
 *
 * 1. `markAlbumPhotosForDeletion` (instantáneo, dentro del pedido): marca las fotos como
 *    retiradas. El panel y la galería pública ya filtran `isRemoved`, así que desaparecen
 *    para todos en el momento, sea una foto o diez mil.
 * 2. `purgePhotosPendingDeletion` (segundo plano): borra los archivos de R2 y las filas.
 *    Corre con `after()` apenas responde el pedido y, si esa ejecución se corta por
 *    tiempo, el cron `purge-deleted-photos` termina lo que quedó. Es idempotente.
 *
 * Antes el navegador borraba de a una foto por pedido y esperando cada respuesta: un
 * álbum de 73 fotos tardaba minutos y cerrar la pestaña dejaba el borrado a medias.
 *
 * No hace falta columna nueva: la marca de "pendiente de purga" es el `removedReason`.
 */

import { prisma } from "@/lib/prisma";
import { deletePhotoR2Assets } from "@/lib/photo-r2-cleanup";

export const PENDING_PURGE_REASON = "Eliminada por el fotógrafo; archivos pendientes de borrado";
const ORDERED_REASON = "Retirada por el fotógrafo; no se borra porque figura en pedidos";

/** Tope por pedido: protege la consulta `IN (...)` y el cuerpo del pedido. */
export const MAX_PHOTOS_PER_DELETE_REQUEST = 5000;

export type MarkPhotosResult = {
  /** Fotos que se van a borrar del todo (archivos y fila). */
  pendingPurge: number;
  /** Fotos vendidas: se retiran del álbum pero se conservan para el comprador. */
  retiredBecauseOrdered: number;
  /** Ids pedidos que no existen en el álbum o no son de este fotógrafo. */
  skipped: number;
};

/**
 * Marca como retiradas las fotos propias del fotógrafo. Mismas reglas que el borrado de
 * a una (`DELETE /photos/[photoId]`): sólo las propias (las heredadas sin `userId` son
 * del dueño del álbum) y las que figuran en pedidos se retiran sin tocar los archivos.
 */
export async function markAlbumPhotosForDeletion(params: {
  albumId: number;
  albumOwnerId: number;
  userId: number;
  photoIds: number[];
}): Promise<MarkPhotosResult> {
  const { albumId, albumOwnerId, userId } = params;
  const requested = Array.from(new Set(params.photoIds)).filter(
    (n) => Number.isInteger(n) && n > 0
  );
  if (requested.length === 0) return { pendingPurge: 0, retiredBecauseOrdered: 0, skipped: 0 };

  const isOwner = albumOwnerId === userId;
  const own = await prisma.photo.findMany({
    where: {
      id: { in: requested },
      albumId,
      isRemoved: false,
      OR: [{ userId }, ...(isOwner ? [{ userId: null }] : [])],
    },
    select: { id: true },
  });
  const ownIds = own.map((p) => p.id);
  if (ownIds.length === 0) {
    return { pendingPurge: 0, retiredBecauseOrdered: 0, skipped: requested.length };
  }

  // OrderItem_photoId_fkey es RESTRICT y el comprador puede volver a descargar: una foto
  // vendida se retira sin borrar archivos.
  const ordered = await prisma.orderItem.findMany({
    where: { photoId: { in: ownIds } },
    select: { photoId: true },
    distinct: ["photoId"],
  });
  const orderedIds = new Set(ordered.map((o) => o.photoId));
  const toPurge = ownIds.filter((id) => !orderedIds.has(id));
  const now = new Date();

  await prisma.$transaction([
    prisma.album.updateMany({
      where: { id: albumId, coverPhotoId: { in: ownIds } },
      data: { coverPhotoId: null },
    }),
    prisma.photo.updateMany({
      where: { id: { in: toPurge } },
      data: { isRemoved: true, removedAt: now, removedReason: PENDING_PURGE_REASON },
    }),
    prisma.photo.updateMany({
      where: { id: { in: Array.from(orderedIds) } },
      data: { isRemoved: true, removedAt: now, removedReason: ORDERED_REASON },
    }),
  ]);

  return {
    pendingPurge: toPurge.length,
    retiredBecauseOrdered: orderedIds.size,
    skipped: requested.length - ownIds.length,
  };
}

/** Corre `worker` sobre `items` con a lo sumo `concurrency` en paralelo. */
async function forEachConcurrent<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>
): Promise<void> {
  let next = 0;
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (next < items.length) {
      const item = items[next++];
      await worker(item);
    }
  });
  await Promise.all(runners);
}

export type PurgeResult = { purged: number; failed: number; remaining: boolean };

/**
 * Borra archivos y filas de las fotos marcadas por `markAlbumPhotosForDeletion`.
 * Corta cuando se acaba `deadlineMs` y deja el resto para la próxima corrida.
 */
export async function purgePhotosPendingDeletion(opts: {
  albumId?: number;
  batchSize?: number;
  concurrency?: number;
  deadlineMs: number;
}): Promise<PurgeResult> {
  const batchSize = opts.batchSize ?? 100;
  const concurrency = opts.concurrency ?? 8;
  let purged = 0;
  let failed = 0;
  // Una foto que falla no se reintenta en la misma corrida: sin esto, una sola foto
  // rota se pediría una y otra vez hasta agotar el tiempo.
  const failedIds = new Set<number>();

  while (Date.now() < opts.deadlineMs) {
    const batch = await prisma.photo.findMany({
      where: {
        isRemoved: true,
        removedReason: PENDING_PURGE_REASON,
        ...(opts.albumId ? { albumId: opts.albumId } : {}),
        ...(failedIds.size > 0 ? { id: { notIn: Array.from(failedIds) } } : {}),
      },
      select: {
        id: true,
        originalKey: true,
        previewUrl: true,
        thumbWatermarkedKey: true,
        previewWatermarkedKey: true,
      },
      orderBy: { id: "asc" },
      take: batchSize,
    });
    if (batch.length === 0) return { purged, failed, remaining: false };

    await forEachConcurrent(batch, concurrency, async (photo) => {
      if (Date.now() >= opts.deadlineMs) return;
      try {
        await deletePhotoR2Assets(photo);
        await prisma.removalRequest.deleteMany({ where: { photoId: photo.id } });
        await prisma.photo.delete({ where: { id: photo.id } });
        purged++;
      } catch (err) {
        failed++;
        failedIds.add(photo.id);
        console.error("[purge-deleted-photos] no se pudo borrar la foto", photo.id, err);
      }
    });
  }
  return { purged, failed, remaining: true };
}
