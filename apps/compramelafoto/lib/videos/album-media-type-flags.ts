import type { PrismaClient } from "@/lib/prisma";
import { isVideoMvpEnabled } from "@/lib/videos/video-feature-flag";
import { publicReadyVideoWhere } from "@/lib/videos/public-ready-videos";

function isMissingVideoAssetRelation(err: unknown): boolean {
  const e = err as { code?: string; message?: string };
  if (e?.code === "P2021") return true;
  const msg = String(e?.message ?? err);
  return /VideoAsset/i.test(msg) && /does not exist|n\u00e3o existe|no existe/i.test(msg);
}

/** Álbumes con al menos un video no removido (dashboard / dueño). */
export async function albumIdsWithAnyVideos(
  prisma: PrismaClient,
  albumIds: number[]
): Promise<Set<number>> {
  if (albumIds.length === 0) return new Set();
  try {
    const rows = await prisma.videoAsset.groupBy({
      by: ["albumId"],
      where: { albumId: { in: albumIds }, isRemoved: false },
      _count: { _all: true },
    });
    return new Set(rows.map((r) => r.albumId));
  } catch (err) {
    // Staging/legacy DBs may lag behind VideoAsset migrations; listing albums must not 500.
    if (isMissingVideoAssetRelation(err)) return new Set();
    throw err;
  }
}

/** Álbumes con videos públicos READY (listados y visitantes anónimos). */
export async function albumIdsWithPublicReadyVideos(
  prisma: PrismaClient,
  albumIds: number[]
): Promise<Set<number>> {
  if (!isVideoMvpEnabled() || albumIds.length === 0) return new Set();
  try {
    const rows = await prisma.videoAsset.groupBy({
      by: ["albumId"],
      where: { albumId: { in: albumIds }, ...publicReadyVideoWhere },
      _count: { _all: true },
    });
    return new Set(rows.map((r) => r.albumId));
  } catch (err) {
    if (isMissingVideoAssetRelation(err)) return new Set();
    throw err;
  }
}
