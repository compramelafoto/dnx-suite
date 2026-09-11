import type { PrismaClient } from "@/lib/prisma";
import { deleteMultipleFromR2 } from "@/lib/r2-client";

/**
 * Limpieza de videos vencidos.
 *
 * Un video vive 15 días (VIDEO_ACTIVE_DAYS). Pasada esa ventana la galería
 * pública deja de mostrarlo, pero hasta ahora el archivo seguía en R2 para
 * siempre: no había ninguna tarea que lo borrara. Esto lo borra.
 *
 * Por qué un marcador en `originalKey` y no un campo nuevo: `schema.prisma` es
 * compartido por las cinco bases de la suite, así que agregar una columna
 * obliga a aplicarla a mano en todas o se rompen las escrituras de las otras
 * apps. `originalKey` no admite null, así que el marcador ocupa su lugar y de
 * paso hace que el worker y los scripts —que ya chequean que la key tenga
 * contenido— saltren el registro solos.
 */
export const PURGED_ORIGINAL_KEY = "__purged__";

export type PurgeCandidate = {
  originalKey: string;
  previewKey: string | null;
  thumbnailKey: string | null;
  isRemoved: boolean;
  expiresAt: Date;
};

/** Un video ya purgado no tiene archivos que borrar. */
export function isAlreadyPurged(video: { originalKey: string }): boolean {
  const key = video.originalKey?.trim() ?? "";
  return key === "" || key === PURGED_ORIGINAL_KEY;
}

/**
 * Se purga cuando pasó su ventana de publicación o cuando el fotógrafo lo borró.
 *
 * El vencimiento es estricto: en el instante exacto de `expiresAt` el video
 * todavía está vigente.
 */
export function shouldPurgeVideo(video: PurgeCandidate, now: Date): boolean {
  if (isAlreadyPurged(video)) return false;
  if (video.isRemoved) return true;
  return video.expiresAt.getTime() < now.getTime();
}

/** Las keys de R2 a borrar: original, preview y miniatura, sin repetir. */
export function collectPurgeKeys(video: PurgeCandidate): string[] {
  const keys = [video.originalKey, video.previewKey, video.thumbnailKey];
  const limpias = keys
    .map((k) => k?.trim() ?? "")
    .filter((k) => k !== "" && k !== PURGED_ORIGINAL_KEY);
  return [...new Set(limpias)];
}

export type VideoCleanupResult = {
  ok: true;
  revisados: number;
  purgados: number;
  archivosBorrados: number;
  bytesLiberados: string;
  errores: { videoId: number; error: string }[];
};

/**
 * Borra de R2 los archivos de los videos que ya no corresponden y marca el
 * registro. La fila se conserva: sirve de historia y no hay nada que la
 * referencie que se rompa por dejarla.
 *
 * Es idempotente: un video ya purgado no vuelve a entrar.
 */
export async function runVideoCleanup(
  prisma: PrismaClient,
  opts: { maxVideos?: number; now?: Date; dryRun?: boolean } = {}
): Promise<VideoCleanupResult> {
  const now = opts.now ?? new Date();
  const maxVideos = opts.maxVideos ?? 200;
  const dryRun = opts.dryRun ?? false;

  const candidatos = await prisma.videoAsset.findMany({
    where: {
      OR: [{ isRemoved: true }, { expiresAt: { lt: now } }],
      NOT: { originalKey: { in: [PURGED_ORIGINAL_KEY, ""] } },
    },
    select: {
      id: true,
      originalKey: true,
      previewKey: true,
      thumbnailKey: true,
      isRemoved: true,
      expiresAt: true,
      fileSizeBytes: true,
    },
    orderBy: { expiresAt: "asc" },
    take: maxVideos,
  });

  const errores: { videoId: number; error: string }[] = [];
  let purgados = 0;
  let archivosBorrados = 0;
  let bytes = 0n;

  for (const video of candidatos) {
    if (!shouldPurgeVideo(video, now)) continue;

    const keys = collectPurgeKeys(video);

    if (dryRun) {
      purgados += 1;
      archivosBorrados += keys.length;
      bytes += video.fileSizeBytes ?? 0n;
      continue;
    }

    try {
      if (keys.length > 0) {
        await deleteMultipleFromR2(keys);
      }

      await prisma.videoAsset.update({
        where: { id: video.id },
        data: {
          originalKey: PURGED_ORIGINAL_KEY,
          previewKey: null,
          thumbnailKey: null,
          processingStatus: "EXPIRED",
          processingError: video.isRemoved
            ? "Archivos borrados: el fotógrafo eliminó el video"
            : "Archivos borrados: pasaron los 15 días de publicación",
        },
      });

      purgados += 1;
      archivosBorrados += keys.length;
      bytes += video.fileSizeBytes ?? 0n;
      console.info("[video-cleanup] purgado", {
        videoId: video.id,
        archivos: keys.length,
        motivo: video.isRemoved ? "eliminado" : "vencido",
      });
    } catch (err: unknown) {
      const error = err instanceof Error ? err.message : String(err);
      console.error("[video-cleanup] error al purgar", { videoId: video.id, error });
      errores.push({ videoId: video.id, error });
    }
  }

  return {
    ok: true,
    revisados: candidatos.length,
    purgados,
    archivosBorrados,
    bytesLiberados: formatBytes(bytes),
    errores,
  };
}

function formatBytes(bytes: bigint): string {
  const mb = Number(bytes) / (1024 * 1024);
  if (mb >= 1024) return `${(mb / 1024).toFixed(2)} GB`;
  return `${mb.toFixed(1)} MB`;
}
