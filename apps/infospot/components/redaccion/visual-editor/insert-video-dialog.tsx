"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  parseVideoUrl,
  type EditorialVideoAttrs,
  type VideoAlignment,
  type VideoWidth,
} from "@repo/editor";
import { VideoEmbed } from "@/components/editorial/video-embed";
import { useDialogFocusTrap } from "@/components/redaccion/use-dialog-focus-trap";

type Props = {
  open: boolean;
  onClose: () => void;
  onInsert: (attrs: EditorialVideoAttrs) => void;
  initial?: EditorialVideoAttrs | null;
};

export function InsertVideoDialog({ open, onClose, onInsert, initial }: Props) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const [url, setUrl] = useState(initial?.url ?? "");
  const [caption, setCaption] = useState(initial?.caption ?? "");
  const [width, setWidth] = useState<VideoWidth>(initial?.width ?? "full");
  const [alignment, setAlignment] = useState<VideoAlignment>(initial?.alignment ?? "center");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setUrl(initial?.url ?? "");
    setCaption(initial?.caption ?? "");
    setWidth(initial?.width ?? "full");
    setAlignment(initial?.alignment ?? "center");
    setError(null);
  }, [open, initial]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const parsed = useMemo(
    () => parseVideoUrl(url, { caption, width, alignment }),
    [url, caption, width, alignment],
  );

  useDialogFocusTrap(open, panelRef);

  if (!open) return null;

  function submit() {
    if (!parsed.ok) {
      setError(parsed.message);
      return;
    }
    onInsert(parsed.value);
  }

  const isEdit = Boolean(initial?.videoId);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-[var(--is-radius-md)] border border-[var(--is-border)] bg-white p-6 shadow-sm"
      >
        <h2 id={titleId} className="font-[family-name:var(--font-source-serif)] text-xl font-semibold">
          {isEdit ? "Editar video" : "Insertar video"}
        </h2>
        <p className="mt-2 text-sm text-[var(--is-muted)]">
          Admitimos YouTube, Vimeo e Instagram (publicaciones, Reels y videos públicos). Pegá
          solo el enlace, no el código embed.
        </p>

        <div className="mt-6 space-y-5">
          <div>
            <label className="text-sm font-semibold" htmlFor="video-url">
              Pegá el enlace del video
            </label>
            <input
              id="video-url"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                setError(null);
              }}
              className="mt-2 w-full rounded-[var(--is-radius-sm)] border border-[var(--is-border-strong)] px-3 py-3 text-sm"
              placeholder="https://www.youtube.com/watch?v=…"
              autoComplete="off"
            />
          </div>

          {url.trim() ? (
            <div>
              <p className="text-sm font-semibold">Vista previa</p>
              <div className="mt-3">
                {parsed.ok ? (
                  <VideoEmbed video={parsed.value} />
                ) : (
                  <p className="rounded-[var(--is-radius-sm)] border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-800">
                    {parsed.message}
                  </p>
                )}
              </div>
            </div>
          ) : null}

          <fieldset>
            <legend className="text-sm font-semibold">Tamaño</legend>
            <div className="mt-3 flex flex-wrap gap-3">
              <label className="inline-flex min-h-11 items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="video-width"
                  checked={width === "full"}
                  onChange={() => setWidth("full")}
                />
                Ancho completo
              </label>
              <label className="inline-flex min-h-11 items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="video-width"
                  checked={width === "content"}
                  onChange={() => setWidth("content")}
                />
                Ancho contenido
              </label>
            </div>
          </fieldset>

          {width === "content" ? (
            <fieldset>
              <legend className="text-sm font-semibold">Alineación</legend>
              <div className="mt-3 flex flex-wrap gap-3">
                {(
                  [
                    ["left", "Izquierda"],
                    ["center", "Centro"],
                    ["right", "Derecha"],
                  ] as const
                ).map(([value, label]) => (
                  <label key={value} className="inline-flex min-h-11 items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="video-align"
                      checked={alignment === value}
                      onChange={() => setAlignment(value)}
                    />
                    {label}
                  </label>
                ))}
              </div>
            </fieldset>
          ) : null}

          <div>
            <label className="text-sm font-semibold" htmlFor="video-caption">
              Epígrafe (opcional)
            </label>
            <input
              id="video-caption"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              className="mt-2 w-full rounded-[var(--is-radius-sm)] border border-[var(--is-border-strong)] px-3 py-3 text-sm"
              placeholder="Texto bajo el video"
            />
          </div>

          {error ? <p className="text-sm text-red-700">{error}</p> : null}
        </div>

        <div className="mt-8 flex flex-wrap justify-end gap-3">
          <button
            type="button"
            className="inline-flex min-h-11 items-center rounded-[var(--is-radius-sm)] border border-[var(--is-border-strong)] px-4 text-sm font-medium"
            onClick={onClose}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="inline-flex min-h-11 items-center rounded-[var(--is-radius-sm)] bg-[var(--is-accent)] px-4 text-sm font-semibold text-white hover:bg-[var(--is-accent-hover)] disabled:opacity-60"
            onClick={submit}
            disabled={!parsed.ok}
          >
            {isEdit ? "Guardar cambios" : "Insertar video"}
          </button>
        </div>
      </div>
    </div>
  );
}
