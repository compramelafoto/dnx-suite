import { prisma } from "@/lib/prisma";
import { searchFacesByFaceId } from "@/lib/faces/rekognition";
import { FACE_SEARCH_GROWING_PACK } from "@/lib/faces/face-search-limits";
import { getAlbumsReadiness } from "@/lib/analysis/album-analysis-readiness";
import { pickPhotosToAdd, shouldSyncGrowingFace } from "./pick-photos-to-add";
import { notifyGrowingPackNewPhotos } from "./notify-growing-pack-new-photos";

/** Cuántas caras se buscan por corrida (cada una es una consulta a Rekognition). */
const MAX_FACES_PER_RUN = 50;

type ActiveFace = {
  id: number;
  albumId: number;
  orderId: number;
  faceId: string;
};

/** Busca las fotos del álbum donde aparece la cara guardada y las suma al pedido. */
export async function syncGrowingPackFace(
  face: ActiveFace,
  search: typeof searchFacesByFaceId = searchFacesByFaceId
): Promise<number> {
  const startedAt = new Date();
  const matches = await search(face.faceId, FACE_SEARCH_GROWING_PACK);
  const similarityByFaceId = new Map(matches.map((m) => [m.rekognitionFaceId, m.similarity]));

  const detections =
    matches.length === 0
      ? []
      : await prisma.faceDetection.findMany({
          where: {
            rekognitionFaceId: { in: [...similarityByFaceId.keys()] },
            photo: { albumId: face.albumId, isRemoved: false },
          },
          select: { photoId: true, rekognitionFaceId: true },
        });

  const [orderItems, alreadyAdded] = await Promise.all([
    prisma.orderItem.findMany({
      where: { orderId: face.orderId, productType: "DIGITAL" },
      select: { photoId: true },
    }),
    prisma.orderAddedPhoto.findMany({
      where: { orderId: face.orderId },
      select: { photoId: true },
    }),
  ]);
  const inOrder = new Set<number>([
    ...orderItems.map((i) => Number(i.photoId)),
    ...alreadyAdded.map((a) => a.photoId),
  ]);

  const toAdd = pickPhotosToAdd(
    detections.map((d) => ({
      photoId: d.photoId,
      similarity: similarityByFaceId.get(d.rekognitionFaceId) ?? null,
    })),
    inOrder
  );

  if (toAdd.length > 0) {
    await prisma.orderAddedPhoto.createMany({
      data: toAdd.map((p) => ({ orderId: face.orderId, photoId: p.photoId, similarity: p.similarity })),
      skipDuplicates: true,
    });
  }
  await prisma.growingPackFace.update({
    where: { id: face.id },
    data: { lastSyncedAt: startedAt },
  });
  return toAdd.length;
}

/**
 * Corrida del cron: para cada comprador con un pack que se va sumando (pedido pagado),
 * busca fotos nuevas en cuanto el álbum termina de analizarse, y le avisa por mail.
 */
export async function runGrowingPackSync(now: Date = new Date()): Promise<{
  candidates: number;
  synced: number;
  photosAdded: number;
  emailsSent: number;
  errors: number;
}> {
  const faces = await prisma.growingPackFace.findMany({
    where: {
      orderId: { not: null },
      faceId: { not: null },
      endedAt: null,
      biometricDeletedAt: null,
      order: { status: "PAID" },
      album: { deletedAt: null },
    },
    select: { id: true, albumId: true, orderId: true, faceId: true, lastSyncedAt: true },
    orderBy: [{ lastSyncedAt: { sort: "asc", nulls: "first" } }, { id: "asc" }],
  });

  const result = { candidates: faces.length, synced: 0, photosAdded: 0, emailsSent: 0, errors: 0 };
  if (faces.length === 0) return result;

  const readiness = await getAlbumsReadiness([...new Set(faces.map((f) => f.albumId))], now);
  const due = faces
    .filter((f) => {
      const r = readiness.get(f.albumId);
      return shouldSyncGrowingFace({
        albumReady: r?.ready === true,
        lastPhotoAt: r?.lastPhotoAt ?? null,
        lastSyncedAt: f.lastSyncedAt,
      });
    })
    .slice(0, MAX_FACES_PER_RUN);

  for (const face of due) {
    try {
      const added = await syncGrowingPackFace({
        id: face.id,
        albumId: face.albumId,
        orderId: face.orderId!,
        faceId: face.faceId!,
      });
      result.synced += 1;
      result.photosAdded += added;
      if (added > 0 && (await notifyGrowingPackNewPhotos(face.orderId!))) {
        result.emailsSent += 1;
      }
    } catch (err) {
      result.errors += 1;
      console.error("[growing-pack-sync] error con la cara", face.id, err);
    }
  }
  return result;
}
