"use client";

import { useState, useTransition } from "react";
import { updateEditorialCoverFocalAction } from "@/app/actions/editorial-photos";

type Props = {
  usageId: string;
  imageSrc: string;
  initialFocalX?: number | null;
  initialFocalY?: number | null;
};

/**
 * Ajuste de encuadre de portada (16:10) sobre la foto original limpia.
 * Persiste focalX/focalY (0–1) para object-position en el sitio público.
 */
export function CoverFocalEditor({
  usageId,
  imageSrc,
  initialFocalX,
  initialFocalY,
}: Props) {
  const [focalX, setFocalX] = useState(initialFocalX ?? 0.5);
  const [focalY, setFocalY] = useState(initialFocalY ?? 0.5);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    setMessage(null);
    startTransition(async () => {
      const result = await updateEditorialCoverFocalAction({
        usageId,
        focalX,
        focalY,
      });
      if (!result.ok) {
        setMessage(result.error);
        return;
      }
      setMessage("Encuadre guardado.");
    });
  }

  return (
    <div className="space-y-4 rounded-[var(--is-radius-md)] border border-[var(--is-border)] bg-white p-4 sm:p-5">
      <div>
        <p className="text-sm font-semibold text-[var(--is-text)]">
          Encuadre de portada (16:10)
        </p>
        <p className="mt-1 text-sm leading-relaxed text-[var(--is-muted)]">
          Mové el punto focal para decidir qué parte de la foto queda centrada
          en el recorte de portada. La imagen publicada es el original sin marca
          de agua.
        </p>
      </div>

      <div
        className="relative aspect-[16/10] w-full overflow-hidden rounded-[var(--is-radius-sm)] bg-[var(--is-bg-muted)]"
        aria-hidden
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageSrc}
          alt=""
          className="h-full w-full object-cover"
          style={{
            objectPosition: `${Math.round(focalX * 100)}% ${Math.round(focalY * 100)}%`,
          }}
          draggable={false}
        />
        <span
          className="pointer-events-none absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-[var(--is-accent)] shadow"
          style={{
            left: `${Math.round(focalX * 100)}%`,
            top: `${Math.round(focalY * 100)}%`,
          }}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-2 text-sm">
          <span className="font-medium text-[var(--is-text)]">Horizontal</span>
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(focalX * 100)}
            onChange={(e) => setFocalX(Number(e.target.value) / 100)}
            className="w-full accent-[var(--is-accent)]"
          />
        </label>
        <label className="block space-y-2 text-sm">
          <span className="font-medium text-[var(--is-text)]">Vertical</span>
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(focalY * 100)}
            onChange={(e) => setFocalY(Number(e.target.value) / 100)}
            className="w-full accent-[var(--is-accent)]"
          />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="inline-flex min-h-11 items-center rounded-[var(--is-radius-sm)] bg-[var(--is-accent)] px-4 text-sm font-semibold text-white hover:bg-[var(--is-accent-hover)] disabled:opacity-60"
        >
          {pending ? "Guardando…" : "Guardar encuadre"}
        </button>
        <button
          type="button"
          onClick={() => {
            setFocalX(0.5);
            setFocalY(0.5);
          }}
          className="inline-flex min-h-11 items-center rounded-[var(--is-radius-sm)] border border-[var(--is-border)] px-4 text-sm font-medium"
        >
          Centrar
        </button>
        {message ? (
          <p className="text-sm text-[var(--is-muted)]" role="status">
            {message}
          </p>
        ) : null}
      </div>
    </div>
  );
}
