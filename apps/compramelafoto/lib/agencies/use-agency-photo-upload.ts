"use client";

import { useCallback, useState } from "react";
import { runAlbumPhotoUploadQueue, type AlbumPhotoUploadProgress } from "@/lib/albums/run-album-photo-upload-queue";
import { resolveAlbumPhotoContentType } from "@/lib/albums/album-photo-content-type";

/**
 * Subida web del fotógrafo de una agencia: init → PUT directo a R2 → complete (sincrónico, con el
 * punto donde sacó las fotos). No usa la página del álbum del dueño, que el equipo no puede abrir.
 */
export function useAgencyPhotoUpload() {
  const [progress, setProgress] = useState<AlbumPhotoUploadProgress | null>(null);
  const [uploading, setUploading] = useState(false);
  const [summary, setSummary] = useState<{ ok: number; duplicates: number; failed: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const upload = useCallback(
    async ({ albumId, files, point }: { albumId: number; files: File[]; point: { lat: number; lng: number } | null }) => {
      setUploading(true);
      setSummary(null);
      setError(null);
      // La cola ya cuenta por archivo (reintentos incluidos): usamos sus contadores para ok/fallidas
      // y llevamos sólo las repetidas, que para la cola también son un éxito.
      let duplicates = 0;
      try {
        const result = await runAlbumPhotoUploadQueue({
          files,
          concurrency: 3,
          maxAttempts: 2,
          onProgress: setProgress,
          uploadFile: async (file, { onPhase }) => {
            const contentType = resolveAlbumPhotoContentType(file.name, file.type);
            onPhase("init");
            const initRes = await fetch(`/api/dashboard/albums/${albumId}/photos/direct-upload/init`, {
              method: "POST",
              credentials: "include",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ name: file.name, contentType, size: file.size }),
            });
            const init = await initRes.json().catch(() => ({}));
            if (!initRes.ok || !init.uploadUrl || !init.key) {
              throw new Error(init.error || "No se pudo iniciar la subida.");
            }
            onPhase("storage");
            const put = await fetch(init.uploadUrl, { method: "PUT", headers: { "Content-Type": contentType }, body: file });
            if (!put.ok) {
              throw new Error("No se pudo subir el archivo. Revisá tu conexión.");
            }
            onPhase("process");
            const doneRes = await fetch(`/api/dashboard/albums/${albumId}/photos/direct-upload/complete`, {
              method: "POST",
              credentials: "include",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                key: init.key,
                originalName: file.name,
                size: file.size,
                ...(point ? { declaredLat: point.lat, declaredLng: point.lng } : {}),
              }),
            });
            const done = await doneRes.json().catch(() => ({}));
            if (!doneRes.ok || !done.photo) {
              throw new Error(done.error || "No se pudo procesar la foto.");
            }
            if (done.duplicate) duplicates++;
            return { kind: "sync", photoId: done.photo.id };
          },
        });
        setSummary({
          ok: result.successCount - duplicates,
          duplicates,
          failed: result.failed.length,
        });
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
