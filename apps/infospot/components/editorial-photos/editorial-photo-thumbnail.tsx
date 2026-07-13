"use client";

import { useCallback, useState } from "react";
import type { EditorialPhotoPreview } from "@/lib/editorial-photo-previews";
import { canSelectEditorialPhoto } from "@/lib/editorial-photo-previews";

type Props = {
  preview: EditorialPhotoPreview;
  /** Si true, el botón de seleccionar se deshabilita cuando falla la preview. */
  selectable?: boolean;
  selected?: boolean;
  onSelect?: () => void;
  selectLabel?: string;
  className?: string;
  showPhotographer?: boolean;
};

/**
 * Miniatura editorial con skeleton, onError, retry y placeholder propio.
 * Nunca muestra el ícono roto nativo del navegador.
 */
export function EditorialPhotoThumbnail({
  preview,
  selectable = false,
  selected = false,
  onSelect,
  selectLabel = "Seleccionar",
  className = "",
  showPhotographer = true,
}: Props) {
  const [status, setStatus] = useState<"loading" | "ready" | "failed">(
    preview.previewUrl ? "loading" : "failed",
  );
  const [retryKey, setRetryKey] = useState(0);

  const canSelect =
    selectable &&
    canSelectEditorialPhoto(preview) &&
    status === "ready";

  const retry = useCallback(() => {
    if (!preview.previewUrl) return;
    setStatus("loading");
    setRetryKey((k) => k + 1);
  }, [preview.previewUrl]);

  const aspect = preview.aspectRatio && preview.aspectRatio > 0 ? preview.aspectRatio : 1;

  return (
    <div className={`space-y-2 ${className}`}>
      <div
        className="relative w-full overflow-hidden rounded-[var(--is-radius-sm)] bg-[var(--is-bg-secondary)]"
        style={{ aspectRatio: String(aspect) }}
      >
        {status === "loading" ? (
          <div
            className="absolute inset-0 animate-pulse bg-gradient-to-br from-[var(--is-border)] to-[var(--is-bg-secondary)]"
            aria-hidden
          />
        ) : null}

        {preview.previewUrl && status !== "failed" ? (
          // eslint-disable-next-line @next/next/no-img-element -- proxy same-origin auth
          <img
            key={retryKey}
            src={`${preview.previewUrl}${preview.previewUrl.includes("?") ? "&" : "?"}r=${retryKey}`}
            alt=""
            loading="lazy"
            draggable={false}
            className={`absolute inset-0 size-full object-cover transition-opacity ${
              status === "ready" ? "opacity-100" : "opacity-0"
            }`}
            onLoad={() => setStatus("ready")}
            onError={() => setStatus("failed")}
            onContextMenu={(e) => e.preventDefault()}
          />
        ) : null}

        {status === "failed" ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-3 text-center">
            <p className="text-xs font-medium text-[var(--is-muted)]">
              Vista previa no disponible
            </p>
            {preview.previewUrl ? (
              <button
                type="button"
                onClick={retry}
                className="min-h-9 rounded-[var(--is-radius-sm)] border border-[var(--is-border-strong)] bg-white px-3 text-xs font-semibold text-[var(--is-text)] hover:border-[var(--is-accent)]"
              >
                Reintentar
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      {showPhotographer ? (
        <p className="truncate text-xs text-[var(--is-muted)]">{preview.photographerName}</p>
      ) : null}

      {selectable ? (
        <button
          type="button"
          disabled={!canSelect}
          onClick={() => {
            if (!canSelect) return;
            onSelect?.();
          }}
          aria-pressed={selected}
          className="w-full rounded-[var(--is-radius-sm)] bg-[var(--is-accent)] px-2 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          title={
            canSelect
              ? undefined
              : "No se puede seleccionar: la vista previa no está disponible"
          }
        >
          {selectLabel}
        </button>
      ) : null}
    </div>
  );
}
