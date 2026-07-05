import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getPhotoOrderItemBlockers } from "@/lib/album-cleanup/blockers";
import type {
  AlbumBlockerReport,
  DestructiveAlbumDeleteAttempt,
} from "@/lib/album-cleanup/types";

export function isPrismaFkViolation(err: unknown): boolean {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2003"
  );
}

function prismaErrorCode(err: unknown): string | null {
  if (err instanceof Prisma.PrismaClientKnownRequestError) return err.code;
  return null;
}

/**
 * Hard delete de filas Photo/Album. Solo invocar con ALBUM_CLEANUP_DESTRUCTIVE_DELETE=true.
 * Nunca lanza P2003: devuelve resultado con error capturado.
 */
export async function tryDestructiveAlbumRowDelete(
  albumId: number,
  blockers: AlbumBlockerReport
): Promise<DestructiveAlbumDeleteAttempt> {
  const base: DestructiveAlbumDeleteAttempt = {
    attempted: true,
    albumDeleted: false,
    photosDeleted: 0,
    blockers: blockers.primaryReason,
    error: null,
    errorCode: null,
  };

  if (blockers.hasAlbumTableBlockers) {
    return {
      ...base,
      error: `BLOCKED_ALBUM_TABLE_FK:${blockers.primaryReason ?? "unknown"}`,
    };
  }

  try {
    await prisma.album.update({
      where: { id: albumId },
      data: { coverPhotoId: null, coverThumbnailKey: null },
    });

    const photoIds = (
      await prisma.photo.findMany({
        where: { albumId },
        select: { id: true },
      })
    ).map((p) => p.id);

    if (photoIds.length > 0) {
      const orderItemBlocked = await getPhotoOrderItemBlockers(photoIds);
      const deletableIds = photoIds.filter((id) => !orderItemBlocked.has(id));

      if (deletableIds.length > 0) {
        try {
          const result = await prisma.photo.deleteMany({
            where: { id: { in: deletableIds } },
          });
          base.photosDeleted = result.count;
        } catch (err: unknown) {
          if (isPrismaFkViolation(err)) {
            return {
              ...base,
              error: err instanceof Error ? err.message : String(err),
              errorCode: "P2003",
            };
          }
          throw err;
        }
      }

      const photosLeft = await prisma.photo.count({ where: { albumId } });
      if (photosLeft > 0) {
        return {
          ...base,
          error: `PHOTO_ROWS_REMAIN:${photosLeft}`,
        };
      }
    }

    try {
      await prisma.album.delete({ where: { id: albumId } });
      return { ...base, albumDeleted: true, error: null };
    } catch (err: unknown) {
      if (isPrismaFkViolation(err)) {
        return {
          ...base,
          error: err instanceof Error ? err.message : String(err),
          errorCode: "P2003",
        };
      }
      throw err;
    }
  } catch (err: unknown) {
    return {
      ...base,
      error: err instanceof Error ? err.message : String(err),
      errorCode: prismaErrorCode(err),
    };
  }
}
