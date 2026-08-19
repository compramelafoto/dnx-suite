"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  CoverImageField,
  type ClfCoverOption,
  type CoverAssetOption,
  type CoverImageChange,
} from "@/components/redaccion/cover-image-field";
import { useDialogFocusTrap } from "@/components/redaccion/use-dialog-focus-trap";

type Props = {
  open: boolean;
  onClose: () => void;
  onConfirm: (next: CoverImageChange) => void;
  articleId?: string;
  initialCoverImageId?: string | null;
  initialCredit?: string | null;
  initialCaption?: string | null;
  assets: CoverAssetOption[];
  clfOptions?: ClfCoverOption[];
};

/**
 * Selector de portada como diálogo: la selección queda en borrador local
 * (`staged`) y solo se aplica a la nota al confirmar con "Usar como portada".
 * Cancelar descarta la selección sin tocar el estado real del formulario.
 */
export function CoverImageModal({
  open,
  onClose,
  onConfirm,
  articleId,
  initialCoverImageId,
  initialCredit,
  initialCaption,
  assets,
  clfOptions = [],
}: Props) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const [staged, setStaged] = useState<CoverImageChange | null>(null);

  useEffect(() => {
    if (open) setStaged(null);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useDialogFocusTrap(open, panelRef);

  if (!open) return null;

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
        className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-[var(--is-radius-md)] border border-[var(--is-border)] bg-white shadow-sm"
      >
        <div className="border-b border-[var(--is-border)] px-6 py-5">
          <h2 id={titleId} className="font-[family-name:var(--font-source-serif)] text-xl font-semibold">
            Portada de la nota
          </h2>
          <p className="mt-1 text-sm text-[var(--is-muted)]">
            Subí una imagen propia o elegí una foto de cobertura CLF. Los cambios se aplican al
            confirmar.
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <CoverImageField
            articleId={articleId}
            initialCoverImageId={initialCoverImageId}
            initialCredit={initialCredit}
            initialCaption={initialCaption}
            assets={assets}
            clfOptions={clfOptions}
            onChange={(next) => setStaged(next)}
          />
        </div>

        <div className="flex flex-wrap justify-end gap-3 border-t border-[var(--is-border)] px-6 py-4">
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
            disabled={!staged}
            onClick={() => {
              if (staged) onConfirm(staged);
              onClose();
            }}
          >
            Usar como portada
          </button>
        </div>
      </div>
    </div>
  );
}

/** Tarjeta compacta para el panel lateral: reemplaza la biblioteca inline. */
export function CoverSummaryCard({
  previewUrl,
  credit,
  caption,
  onChange,
  onRemove,
}: {
  previewUrl: string | null;
  credit?: string | null;
  caption?: string | null;
  onChange: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="space-y-3">
      {previewUrl ? (
        <div className="overflow-hidden rounded-[var(--is-radius-sm)] border border-[var(--is-border)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={previewUrl} alt="" className="aspect-[16/10] w-full object-cover" />
        </div>
      ) : (
        <div className="flex aspect-[16/10] w-full items-center justify-center rounded-[var(--is-radius-sm)] border border-dashed border-[var(--is-border-strong)] bg-[var(--is-bg-secondary)] text-xs text-[var(--is-muted)]">
          Sin portada — se usará el placeholder institucional
        </div>
      )}
      {caption?.trim() || credit?.trim() ? (
        <div className="space-y-0.5 text-xs leading-relaxed">
          {caption?.trim() ? <p className="text-[var(--is-text)]">{caption}</p> : null}
          {credit?.trim() ? <p className="text-[var(--is-text-secondary)]">{credit}</p> : null}
        </div>
      ) : null}
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={onChange}
          className="inline-flex min-h-11 items-center rounded-[var(--is-radius-sm)] border border-[var(--is-border-strong)] px-3 text-xs font-semibold text-[var(--is-text)]"
        >
          {previewUrl ? "Cambiar portada" : "Elegir portada"}
        </button>
        {previewUrl ? (
          <button
            type="button"
            onClick={onRemove}
            className="inline-flex min-h-11 items-center text-xs font-medium text-[var(--is-text-secondary)] hover:text-red-700"
          >
            Quitar
          </button>
        ) : null}
      </div>
    </div>
  );
}
