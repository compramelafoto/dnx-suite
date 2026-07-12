"use client";

import { useState } from "react";
import type { ReactNode } from "react";

type Props = {
  photographerName: string;
  credit: string;
  children: ReactNode;
  purchaseHref?: string | null;
  albumHref?: string | null;
};

/**
 * Protección disuasoria: no draggable, sin menú contextual nativo,
 * aviso con autor + CTA. No afirma imposibilidad de captura.
 */
export function ProtectedEditorialImage({
  photographerName,
  credit,
  children,
  purchaseHref,
  albumHref,
}: Props) {
  const [notice, setNotice] = useState(false);

  return (
    <div
      className="relative"
      onContextMenu={(e) => {
        e.preventDefault();
        setNotice(true);
      }}
    >
      <div
        className="select-none"
        draggable={false}
        onDragStart={(e) => e.preventDefault()}
        style={{ WebkitUserDrag: "none" } as React.CSSProperties}
      >
        {children}
      </div>
      {notice ? (
        <div
          role="dialog"
          className="absolute inset-x-4 bottom-4 z-10 rounded-[var(--is-radius)] border border-[var(--is-border)] bg-white/95 p-4 text-sm shadow-lg backdrop-blur"
        >
          <p className="font-medium">Fotografía de {photographerName}.</p>
          <p className="mt-1 text-[var(--is-muted)]">Disponible en ComprameLaFoto.</p>
          <p className="mt-1 text-xs text-[var(--is-muted)]">{credit}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {purchaseHref ? (
              <a
                href={purchaseHref}
                className="rounded bg-[var(--is-accent)] px-3 py-2 text-xs font-semibold text-white"
                rel="noopener noreferrer"
              >
                Ver y comprar esta foto
              </a>
            ) : null}
            {albumHref ? (
              <a
                href={albumHref}
                className="rounded border border-[var(--is-border)] px-3 py-2 text-xs"
                rel="noopener noreferrer"
              >
                Ver álbum completo
              </a>
            ) : null}
            <button
              type="button"
              className="rounded border border-[var(--is-border)] px-3 py-2 text-xs"
              onClick={() => setNotice(false)}
            >
              Cerrar
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
