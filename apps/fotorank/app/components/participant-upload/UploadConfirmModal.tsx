"use client";

import { useEffect, useId, useRef } from "react";

type Props = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

/** Modal accesible simple (sin librería externa). */
export function UploadConfirmModal({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel = "Cancelar",
  busy = false,
  onConfirm,
  onCancel,
}: Props) {
  const titleId = useId();
  const descId = useId();
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    confirmRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, onCancel]);

  if (!open) return null;

  return (
    <div className="fr-upload-modal-root" role="presentation">
      <button
        type="button"
        className="fr-upload-modal-backdrop"
        aria-label="Cerrar"
        disabled={busy}
        onClick={() => {
          if (!busy) onCancel();
        }}
      />
      <div
        className="fr-upload-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
      >
        <h2 id={titleId} className="fr-upload-modal__title">
          {title}
        </h2>
        <p id={descId} className="fr-upload-modal__message">
          {message}
        </p>
        <div className="fr-upload-modal__actions">
          <button
            type="button"
            className="fr-btn fr-btn-secondary"
            disabled={busy}
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            className="fr-btn fr-btn-primary"
            data-testid="upload-confirm-submit"
            disabled={busy}
            onClick={onConfirm}
          >
            {busy ? "Enviando…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
