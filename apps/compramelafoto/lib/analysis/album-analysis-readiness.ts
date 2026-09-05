import { prisma } from "@/lib/prisma";

/**
 * ¿El álbum está listo para avisarle al cliente?
 *
 * Un cliente que llega a un álbum a medio analizar no puede usar el reconocimiento
 * facial ni la búsqueda por dorsal (OCR): ve "las fotos se están procesando" y se va.
 * Por eso los mails que llevan gente al álbum esperan a que el análisis termine.
 *
 * La decisión vive en `decideAlbumReadiness`, que es pura y se testea sin base de datos.
 * `getAlbumsAnalysisStats` es la única parte que consulta.
 */

/** Minutos sin fotos nuevas antes de dar el álbum por cerrado (el fotógrafo sube en tandas). */
export const DEFAULT_QUIET_WINDOW_MINUTES = 30;
/** Horas tras las que se avisa igual, aunque el análisis siga trabado. */
export const DEFAULT_MAX_WAIT_HOURS = 24;

export type AlbumAnalysisStats = {
  albumId: number;
  pending: number;
  processing: number;
  done: number;
  error: number;
  /** Cuándo entró la última foto al álbum. */
  lastPhotoAt: Date | null;
};

export type AlbumReadinessReason =
  /** Terminó el análisis y pasó la ventana de calma. */
  | "ready"
  /** Se agotó la espera máxima: avisamos igual y dejamos el warn en el log. */
  | "timeout"
  /** El álbum no tiene fotos. */
  | "no_photos"
  /** Quedan fotos en cola o en proceso. */
  | "analysis_in_progress"
  /** Hay fotos pero ninguna llegó a analizarse bien. */
  | "no_analyzed_photos"
  /** Terminó el análisis pero el fotógrafo subió algo hace muy poco. */
  | "quiet_window";

export type AlbumReadiness = AlbumAnalysisStats & {
  ready: boolean;
  reason: AlbumReadinessReason;
};

function resolveEnvNumber(raw: string | undefined, fallback: number, max: number): number {
  if (raw == null || raw.trim() === "") return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.min(max, n);
}

/** Ventana de calma en milisegundos. `ALBUM_READY_QUIET_MINUTES=0` la desactiva. */
export function resolveQuietWindowMs(): number {
  const minutes = resolveEnvNumber(
    process.env.ALBUM_READY_QUIET_MINUTES,
    DEFAULT_QUIET_WINDOW_MINUTES,
    24 * 60
  );
  return minutes * 60 * 1000;
}

/** Espera máxima en milisegundos antes de avisar igual. */
export function resolveMaxWaitMs(): number {
  const hours = resolveEnvNumber(
    process.env.ALBUM_READY_MAX_WAIT_HOURS,
    DEFAULT_MAX_WAIT_HOURS,
    30 * 24
  );
  return hours * 60 * 60 * 1000;
}

/**
 * Decide si se puede avisar. Pura: no consulta nada.
 *
 * Las fotos en ERROR no bloquean —una sola foto corrupta congelaría el álbum para
 * siempre—, pero tampoco alcanzan por sí solas: hace falta al menos una analizada bien.
 */
export function decideAlbumReadiness(
  stats: AlbumAnalysisStats,
  now: Date = new Date()
): AlbumReadiness {
  const total = stats.pending + stats.processing + stats.done + stats.error;
  if (total === 0) {
    return { ...stats, ready: false, reason: "no_photos" };
  }

  const waitedMs = stats.lastPhotoAt
    ? now.getTime() - stats.lastPhotoAt.getTime()
    : 0;
  const pendingWork = stats.pending + stats.processing;
  const analysisComplete = pendingWork === 0 && stats.done > 0;

  if (analysisComplete && waitedMs >= resolveQuietWindowMs()) {
    return { ...stats, ready: true, reason: "ready" };
  }

  if (waitedMs >= resolveMaxWaitMs()) {
    return { ...stats, ready: true, reason: "timeout" };
  }

  if (pendingWork > 0) {
    return { ...stats, ready: false, reason: "analysis_in_progress" };
  }
  if (stats.done === 0) {
    return { ...stats, ready: false, reason: "no_analyzed_photos" };
  }
  return { ...stats, ready: false, reason: "quiet_window" };
}

/** Conteos por estado y fecha de la última foto, para varios álbumes de una sola consulta. */
export async function getAlbumsAnalysisStats(
  albumIds: number[]
): Promise<Map<number, AlbumAnalysisStats>> {
  const result = new Map<number, AlbumAnalysisStats>();
  const unique = [...new Set(albumIds)].filter((id) => Number.isFinite(id));
  if (unique.length === 0) return result;

  for (const albumId of unique) {
    result.set(albumId, {
      albumId,
      pending: 0,
      processing: 0,
      done: 0,
      error: 0,
      lastPhotoAt: null,
    });
  }

  const groups = await prisma.photo.groupBy({
    by: ["albumId", "analysisStatus"],
    where: { albumId: { in: unique }, isRemoved: false },
    _count: { _all: true },
    _max: { createdAt: true },
  });

  for (const group of groups) {
    const stats = result.get(group.albumId);
    if (!stats) continue;
    const count = group._count._all;
    switch (group.analysisStatus) {
      case "PENDING":
        stats.pending += count;
        break;
      case "PROCESSING":
        stats.processing += count;
        break;
      case "DONE":
        stats.done += count;
        break;
      case "ERROR":
        stats.error += count;
        break;
    }
    const groupLast = group._max.createdAt;
    if (groupLast && (!stats.lastPhotoAt || groupLast > stats.lastPhotoAt)) {
      stats.lastPhotoAt = groupLast;
    }
  }

  return result;
}

/** Igual que `getAlbumsAnalysisStats` pero ya resuelto a la decisión, para varios álbumes. */
export async function getAlbumsReadiness(
  albumIds: number[],
  now: Date = new Date()
): Promise<Map<number, AlbumReadiness>> {
  const stats = await getAlbumsAnalysisStats(albumIds);
  const readiness = new Map<number, AlbumReadiness>();
  for (const [albumId, value] of stats) {
    const decision = decideAlbumReadiness(value, now);
    if (decision.reason === "timeout") {
      console.warn("[album-readiness] timeout", {
        albumId,
        pending: decision.pending,
        processing: decision.processing,
        done: decision.done,
        error: decision.error,
        last_photo_at: decision.lastPhotoAt,
      });
    }
    readiness.set(albumId, decision);
  }
  return readiness;
}

/** Atajo para un solo álbum. */
export async function getAlbumReadiness(
  albumId: number,
  now: Date = new Date()
): Promise<AlbumReadiness> {
  const map = await getAlbumsReadiness([albumId], now);
  return (
    map.get(albumId) ?? {
      albumId,
      pending: 0,
      processing: 0,
      done: 0,
      error: 0,
      lastPhotoAt: null,
      ready: false,
      reason: "no_photos",
    }
  );
}
