"use client";

import { useCallback, useState } from "react";
import { runAlbumPhotoUploadQueue, type AlbumPhotoUploadProgress } from "@/lib/albums/run-album-photo-upload-queue";

/** Punto declarado de la tanda: un lugar de la agencia o un punto del mapa ("mi ubicación"). */
export type AgencyUploadPoint = { placeId: number } | { lat: number; lng: number } | null;

export type AgencyUploadSummary = {
  published: number;
  duplicates: number;
  /** En la fila: esperando al filtro de la nube o a que el cron la procese. */
  waiting: number;
  failed: number;
};

/**
 * Subida web al álbum de una agencia: init → PUT directo a R2 → complete. Pasa por la fila común (`CameraIngestJob`)
 * con el autor y el punto; si la agencia publica al instante, la foto queda publicada en el mismo pedido.
 * Lo usan el miembro (autor = él) y el dueño (autor elegido por foto; null = del dueño, 100 % agencia).
 * No usa las rutas del álbum del dueño (`/api/dashboard/albums/...`), que el equipo no debe abrir.
 */
export function useAgencyPhotoUpload() {
  const [progress, setProgress] = useState<AlbumPhotoUploadProgress | null>(null);
  const [uploading, setUploading] = useState(false);
  const [summary, setSummary] = useState<AgencyUploadSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const upload = useCallback(
    async ({
      agencyId,
      albumId,
      files,
      point,
      authorFor,
    }: {
      agencyId: number;
      albumId: number;
      files: File[];
      point: AgencyUploadPoint;
      /** Autor de cada archivo (sólo el dueño lo usa). */
      authorFor?: (file: File) => number | null;
    }) => {
      setUploading(true);
      setSummary(null);
      setError(null);
      const counts = { published: 0, duplicates: 0, waiting: 0 };
      try {
        const result = await runAlbumPhotoUploadQueue({
          files,
          concurrency: 3,
          maxAttempts: 2,
          onProgress: setProgress,
          uploadFile: async (file, { onPhase }) => {
            const author = authorFor?.(file) ?? null;
            const common = { agencyId, albumId, ...(author ? { authorUserId: author } : {}) };
            onPhase("init");
            const initRes = await fetch("/api/fotografo/agencias/subida-web/init", {
              method: "POST",
              credentials: "include",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ ...common, name: file.name, contentType: "image/jpeg", size: file.size }),
            });
            const init = await initRes.json().catch(() => ({}));
            if (!initRes.ok || !init.uploadUrl || !init.key) {
              throw new Error(init.error || "No se pudo iniciar la subida.");
            }
            onPhase("storage");
            const put = await fetch(init.uploadUrl, { method: "PUT", headers: { "Content-Type": "image/jpeg" }, body: file });
            if (!put.ok) {
              throw new Error("No se pudo subir el archivo. Revisá tu conexión.");
            }
            onPhase("process");
            const doneRes = await fetch("/api/fotografo/agencias/subida-web/complete", {
              method: "POST",
              credentials: "include",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ ...common, key: init.key, originalName: file.name, ...(point ?? {}) }),
            });
            const done = await doneRes.json().catch(() => ({}));
            if (!doneRes.ok || !done.ok) {
              throw new Error(done.error || "No se pudo procesar la foto.");
            }
            if (done.state === "PUBLISHED") counts.published++;
            else if (done.state === "DUPLICATE") counts.duplicates++;
            else counts.waiting++;
            return { kind: "async", jobId: String(done.jobId) };
          },
        });
        setSummary({ ...counts, failed: result.failed.length });
        if (result.failed.length > 0) setError(result.failed[0].error ?? null);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setUploading(false);
      }
    },
    []
  );

  return { upload, progress, uploading, summary, error };
}

export function agencyUploadSummaryText(s: AgencyUploadSummary): string {
  const parts = [`Listo: ${s.published} publicadas`];
  if (s.waiting) parts.push(`${s.waiting} en proceso (aparecen en unos minutos)`);
  if (s.duplicates) parts.push(`${s.duplicates} ya estaban (no se repitieron)`);
  if (s.failed) parts.push(`${s.failed} con error`);
  return `${parts.join(", ")}.`;
}
