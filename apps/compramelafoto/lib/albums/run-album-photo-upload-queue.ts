import type { AlbumPhotoUploadOutcome } from "@/lib/albums/album-photo-upload-outcome";

export type AlbumPhotoUploadPhase = "init" | "storage" | "process";

export type AlbumPhotoUploadProgress = {
  total: number;
  /** Archivos ya procesados (éxito o error) */
  processed: number;
  /** Subidas exitosas */
  succeeded: number;
  failed: number;
  /** 0..1 para barra suave (incluye avance parcial del archivo en curso) */
  progressRatio: number;
  currentFile: string | null;
  phase: AlbumPhotoUploadPhase | null;
  activeUploads: number;
};

export type AlbumPhotoUploadQueueItem = {
  file: File;
  error?: string;
};

export type RunAlbumPhotoUploadQueueOptions = {
  files: File[];
  concurrency?: number;
  /** Intentos por archivo (default 2). */
  maxAttempts?: number;
  /** Pausa base entre reintentos del mismo archivo (ms). */
  retryDelayMs?: number;
  /** Pausa entre archivos en colas serializadas (ms). */
  betweenFilesDelayMs?: number;
  uploadFile: (
    file: File,
    hooks: { onPhase: (phase: AlbumPhotoUploadPhase) => void }
  ) => Promise<AlbumPhotoUploadOutcome>;
  onProgress: (progress: AlbumPhotoUploadProgress) => void;
};

const PHASE_WEIGHT: Record<AlbumPhotoUploadPhase, number> = {
  init: 0.12,
  storage: 0.48,
  process: 0.88,
};

function computeProgressRatio(
  total: number,
  processed: number,
  activePhases: AlbumPhotoUploadPhase[]
): number {
  if (total <= 0) return 0;
  const inFlight =
    activePhases.reduce((sum, phase) => sum + PHASE_WEIGHT[phase], 0) / total;
  return Math.min(1, (processed + inFlight) / total);
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Cola de subida con concurrencia limitada y progreso fraccional por fases.
 */
export async function runAlbumPhotoUploadQueue(
  opts: RunAlbumPhotoUploadQueueOptions
): Promise<{
  failed: AlbumPhotoUploadQueueItem[];
  successCount: number;
  asyncJobIds: string[];
}> {
  const { files, uploadFile, onProgress } = opts;
  const concurrency = Math.max(1, Math.min(4, opts.concurrency ?? 3));
  const maxAttempts = Math.max(1, opts.maxAttempts ?? 2);
  const retryDelayMs = opts.retryDelayMs ?? 800;
  const betweenFilesDelayMs = opts.betweenFilesDelayMs ?? 0;
  const total = files.length;
  let nextIndex = 0;
  let processed = 0;
  let successCount = 0;
  const failed: AlbumPhotoUploadQueueItem[] = [];
  const asyncJobIds: string[] = [];
  const activePhases = new Map<number, AlbumPhotoUploadPhase>();

  const emit = (currentFile: string | null) => {
    onProgress({
      total,
      processed,
      succeeded: successCount,
      failed: failed.length,
      progressRatio: computeProgressRatio(
        total,
        processed,
        Array.from(activePhases.values())
      ),
      currentFile,
      phase: activePhases.size > 0 ? Array.from(activePhases.values()).at(-1) ?? null : null,
      activeUploads: activePhases.size,
    });
  };

  async function worker(workerId: number) {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= total) break;

      if (betweenFilesDelayMs > 0 && index > 0) {
        await delay(betweenFilesDelayMs);
      }

      const file = files[index];
      emit(file.name);

      let lastError: string | null = null;
      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        try {
          activePhases.set(workerId, "init");
          emit(file.name);
          const outcome = await uploadFile(file, {
            onPhase: (phase) => {
              activePhases.set(workerId, phase);
              emit(file.name);
            },
          });
          if (outcome.kind === "async") {
            asyncJobIds.push(outcome.jobId);
          }
          successCount += 1;
          lastError = null;
          break;
        } catch (err: unknown) {
          const message =
            err instanceof Error ? err.message : "Error desconocido al subir archivo";
          lastError =
            message === "Failed to fetch" ? "Error de red. Revisá tu conexión." : message;
          if (attempt < maxAttempts - 1) {
            await delay(retryDelayMs * (attempt + 1));
          }
        }
      }

      activePhases.delete(workerId);
      processed += 1;
      if (lastError) {
        failed.push({ file, error: lastError });
      }
      emit(null);
    }
  }

  emit(null);
  await Promise.all(Array.from({ length: concurrency }, (_, i) => worker(i)));
  emit(null);

  return { failed, successCount, asyncJobIds };
}
