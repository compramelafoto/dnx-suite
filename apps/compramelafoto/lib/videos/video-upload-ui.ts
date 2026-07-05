import type { VideoCategoryId } from "@/lib/videos/video-validation";
import { VIDEO_CATEGORY_LABELS } from "@/lib/videos/video-validation";

export const VIDEO_DESCRIPTION_MAX_LENGTH = 2000;

export const VIDEO_UPLOAD_KEEP_TAB_NOTICE =
  "Los videos pueden tardar más que las fotos. No cierres esta pestaña ni bloquees el dispositivo hasta que la subida termine. La vista previa y el thumbnail aparecerán cuando finalice el procesamiento.";

export type UploadQueueStatus =
  | "queued"
  | "uploading"
  | "completing"
  | "pending_processing"
  | "error";

export type UploadQueueItem = {
  id: string;
  file: File;
  category: VideoCategoryId;
  status: UploadQueueStatus;
  /** 0–100 cuando el navegador informa progreso; null = indeterminado */
  progressPercent: number | null;
  error?: string;
};

export function titleFromFilename(filename: string): string {
  const base = filename.replace(/\.[^.]+$/, "").trim();
  const cleaned = base.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  return cleaned || "Video";
}

export function formatVideoFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "—";
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return `${mb.toFixed(mb >= 10 ? 0 : 1)} MB`;
  const kb = bytes / 1024;
  return `${kb.toFixed(0)} KB`;
}

export function newUploadQueueItem(file: File, category: VideoCategoryId): UploadQueueItem {
  return {
    id: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2, 9)}`,
    file,
    category,
    status: "queued",
    progressPercent: null,
  };
}

const CLIENT_VIDEO_MIMES = new Set(["video/mp4", "video/quicktime", "video/webm"]);

/** Valida extensión/MIME en el cliente (mismo criterio que el servidor). */
export function isClientAllowedVideoFile(file: File): boolean {
  const mime = (file.type || "").trim().toLowerCase();
  if (mime && CLIENT_VIDEO_MIMES.has(mime)) return true;
  const name = file.name.trim().toLowerCase();
  return name.endsWith(".mp4") || name.endsWith(".mov") || name.endsWith(".webm");
}

export function partitionVideoFilesForUpload(files: File[]): {
  accepted: File[];
  rejected: File[];
} {
  const accepted: File[] = [];
  const rejected: File[] = [];
  for (const file of files) {
    if (isClientAllowedVideoFile(file)) accepted.push(file);
    else rejected.push(file);
  }
  return { accepted, rejected };
}

export function formatQueueStatusLabel(
  status: UploadQueueStatus,
  progressPercent: number | null
): string {
  switch (status) {
    case "queued":
      return "En cola";
    case "uploading":
      if (progressPercent != null) return `Subiendo ${progressPercent}%`;
      return "Subiendo…";
    case "completing":
      return "Registrando video";
    case "pending_processing":
      return "Subido, pendiente de procesamiento";
    case "error":
      return "Error";
    default:
      return status;
  }
}

/** @deprecated Usar formatQueueStatusLabel */
export const UPLOAD_QUEUE_STATUS_LABELS: Record<UploadQueueStatus, string> = {
  queued: "En cola",
  uploading: "Subiendo",
  completing: "Registrando video",
  pending_processing: "Subido, pendiente de procesamiento",
  error: "Error",
};

export function queueCategoryLabel(category: VideoCategoryId): string {
  return VIDEO_CATEGORY_LABELS[category];
}

export type BatchUploadDefaults = {
  category: VideoCategoryId;
  description: string;
  priceCents: number;
  eventFolderId: string;
};

/**
 * PUT al signed URL de R2 con progreso vía XMLHttpRequest.
 */
export function uploadFileWithProgress(
  uploadUrl: string,
  file: File,
  contentType: string,
  onProgress: (percent: number | null) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const mime = contentType?.trim() || file.type || "application/octet-stream";

    xhr.open("PUT", uploadUrl);
    xhr.setRequestHeader("Content-Type", mime);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) {
        const pct = Math.min(100, Math.round((event.loaded / event.total) * 100));
        onProgress(pct);
      } else {
        onProgress(null);
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(100);
        resolve();
        return;
      }
      reject(
        new Error(
          xhr.status === 0
            ? "No se pudo subir el archivo. Verificá tu conexión."
            : `No se pudo subir el archivo (${xhr.status}).`
        )
      );
    };

    xhr.onerror = () => {
      reject(new Error("Error de red al subir el video. Mantené la pestaña abierta e intentá de nuevo."));
    };

    xhr.onabort = () => {
      reject(new Error("Subida cancelada."));
    };

    onProgress(null);
    xhr.send(file);
  });
}

export const VIDEO_PROCESSING_POLL_MS = 12_000;

export function videoNeedsProcessingPoll(
  videos: Array<{ processingStatus: string }>
): boolean {
  return videos.some(
    (v) =>
      v.processingStatus === "UPLOADED" ||
      v.processingStatus === "PROCESSING" ||
      v.processingStatus === "PENDING"
  );
}
