"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { isAccusatorySignal } from "@/lib/editorial-photos/capture-notice-policy";
import { PHOTO_PROTECTION_LEGAL_TEXT } from "@/lib/editorial-photos/legal-text";

type Props = {
  photographerName?: string | null;
  credit?: string | null;
  children: ReactNode;
  purchaseHref?: string | null;
  albumHref?: string | null;
  /** Ej.: para que un carrusel contenedor pause el autoplay mientras se ve el aviso. */
  onNoticeChange?: (visible: boolean) => void;
};

/**
 * Protección disuasoria de una fotografía editorial: sin menú contextual
 * nativo, sin arrastre, sin selección, con aviso legal claro al intentar
 * copiarla. No afirma ni promete imposibilidad de captura de pantalla —
 * eso es técnicamente indetectable/inevitable a nivel de página web.
 */
export function ProtectedEditorialImage({
  photographerName,
  credit,
  children,
  purchaseHref,
  albumHref,
  onNoticeChange,
}: Props) {
  const [notice, setNotice] = useState(false);
  const attribution = credit || (photographerName ? `Foto: ${photographerName}` : null);
  const onNoticeChangeRef = useRef(onNoticeChange);
  onNoticeChangeRef.current = onNoticeChange;

  function updateNotice(visible: boolean) {
    setNotice(visible);
    onNoticeChange?.(visible);
  }

  // Si el nodo se desmonta (p. ej. el carrusel lo saca de la ventana de
  // precarga) mientras el aviso estaba abierto, avisar igual que se cerró
  // — evita que el contenedor quede "pausado" para siempre.
  useEffect(() => {
    return () => {
      if (notice) onNoticeChangeRef.current?.(false);
    };
  }, [notice]);

  return (
    <div
      className="relative h-full w-full"
      onContextMenu={(e) => {
        e.preventDefault();
        if (isAccusatorySignal("contextmenu")) updateNotice(true);
      }}
    >
      <div
        className="h-full w-full select-none"
        draggable={false}
        onDragStart={(e) => {
          e.preventDefault();
          if (isAccusatorySignal("dragstart")) updateNotice(true);
        }}
        style={{ WebkitUserDrag: "none" } as React.CSSProperties}
      >
        {children}
      </div>
      {notice ? (
        <div
          role="dialog"
          aria-modal="false"
          aria-label="Aviso de protección de fotografía"
          className="absolute inset-x-4 bottom-4 z-10 rounded-[var(--is-radius)] border border-[var(--is-border)] bg-white/95 p-4 text-sm shadow-lg backdrop-blur"
        >
          <p className="font-medium">{PHOTO_PROTECTION_LEGAL_TEXT}</p>
          {attribution ? (
            <p className="mt-1 text-xs text-[var(--is-muted)]">{attribution}</p>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2">
            {purchaseHref ? (
              <a
                href={purchaseHref}
                className="rounded bg-[var(--is-accent)] px-3 py-2 text-xs font-semibold text-white"
                rel="noopener noreferrer"
              >
                Ver opciones de compra
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
              onClick={() => updateNotice(false)}
              autoFocus
            >
              Entendido
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
