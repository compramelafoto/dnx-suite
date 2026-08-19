"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { EditorialImageAttrs } from "@repo/editor";
import { useDialogFocusTrap } from "@/components/redaccion/use-dialog-focus-trap";

type Props = {
  open: boolean;
  onClose: () => void;
  onInsert: (attrs: EditorialImageAttrs) => void;
  articleId?: string | null;
};

export function InsertImageDialog({ open, onClose, onInsert, articleId }: Props) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [alt, setAlt] = useState("");
  const [caption, setCaption] = useState("");
  const [credit, setCredit] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

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

  async function submit() {
    setError(null);
    if (!file) {
      setError("Elegí una imagen.");
      return;
    }
    if (!alt.trim()) {
      setError("El texto alternativo es obligatorio.");
      return;
    }
    if (!credit.trim()) {
      setError("El crédito fotográfico es obligatorio.");
      return;
    }

    setUploading(true);
    try {
      const body = new FormData();
      body.set("file", file);
      body.set("purpose", "inline");
      body.set("alt", alt.trim());
      body.set("caption", caption.trim());
      body.set("credit", credit.trim());
      if (articleId) body.set("articleId", articleId);

      const res = await fetch("/api/redaccion/upload", { method: "POST", body });
      const data = (await res.json()) as {
        asset?: { id: string; url: string; caption: string | null; credit: string | null };
        error?: string;
      };
      if (!res.ok || !data.asset) {
        throw new Error(data.error || "No se pudo subir la imagen");
      }

      onInsert({
        src: data.asset.url,
        alt: alt.trim(),
        caption: caption.trim() || data.asset.caption || "",
        credit: credit.trim() || data.asset.credit || "",
        assetId: data.asset.id,
      });

      setFile(null);
      setAlt("");
      setCaption("");
      setCredit("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al subir");
    } finally {
      setUploading(false);
    }
  }

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
        className="w-full max-w-lg rounded-[var(--is-radius-md)] border border-[var(--is-border)] bg-white p-6 shadow-sm"
      >
        <h2 id={titleId} className="font-[family-name:var(--font-source-serif)] text-xl font-semibold">
          Insertar imagen en la nota
        </h2>
        <p className="mt-2 text-sm text-[var(--is-muted)]">
          Se sube a la biblioteca editorial (R2). Podés combinar imágenes propias con fotos de
          cobertura CLF insertadas desde la biblioteca lateral. Quitar el bloque no borra el
          archivo.
        </p>

        <div className="mt-6 space-y-5">
          <div>
            <label className="text-sm font-semibold">Archivo *</label>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="mt-2 block w-full text-sm"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            {previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewUrl}
                alt=""
                className="mt-3 max-h-48 w-full rounded-[var(--is-radius-sm)] object-cover"
              />
            ) : null}
          </div>
          <div>
            <label className="text-sm font-semibold" htmlFor="img-alt">
              Texto alternativo *
            </label>
            <input
              id="img-alt"
              value={alt}
              onChange={(e) => setAlt(e.target.value)}
              className="mt-2 w-full rounded-[var(--is-radius-sm)] border border-[var(--is-border-strong)] px-3 py-3 text-sm"
              placeholder="Descripción breve de lo que se ve"
            />
          </div>
          <div>
            <label className="text-sm font-semibold" htmlFor="img-caption">
              Epígrafe
            </label>
            <input
              id="img-caption"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              className="mt-2 w-full rounded-[var(--is-radius-sm)] border border-[var(--is-border-strong)] px-3 py-3 text-sm"
              placeholder="Texto bajo la imagen"
            />
          </div>
          <div>
            <label className="text-sm font-semibold" htmlFor="img-credit">
              Crédito fotográfico *
            </label>
            <input
              id="img-credit"
              value={credit}
              onChange={(e) => setCredit(e.target.value)}
              className="mt-2 w-full rounded-[var(--is-radius-sm)] border border-[var(--is-border-strong)] px-3 py-3 text-sm"
              placeholder="Foto: Nombre / Medio"
            />
          </div>
          {error ? <p className="text-sm text-red-700">{error}</p> : null}
        </div>

        <div className="mt-8 flex flex-wrap justify-end gap-3">
          <button
            type="button"
            className="inline-flex min-h-11 items-center rounded-[var(--is-radius-sm)] border border-[var(--is-border-strong)] px-4 text-sm font-medium"
            onClick={onClose}
            disabled={uploading}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="inline-flex min-h-11 items-center rounded-[var(--is-radius-sm)] bg-[var(--is-accent)] px-4 text-sm font-semibold text-white hover:bg-[var(--is-accent-hover)] disabled:opacity-60"
            onClick={() => void submit()}
            disabled={uploading}
          >
            {uploading ? "Subiendo…" : "Insertar"}
          </button>
        </div>
      </div>
    </div>
  );
}
