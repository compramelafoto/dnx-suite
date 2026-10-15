"use client";

import { useRef, useState } from "react";
import { requestTemplateVersionImageUpload } from "@repo/template-editor-core";

/**
 * Imagen del fondo: miniatura, cargar o quitar. Antes sólo había un campo para pegar una URL,
 * y nadie tiene la URL de su foto: la tiene en la computadora.
 */
export function BackgroundImageField({
  templateId,
  versionId,
  src,
  onChange,
}: {
  templateId: string;
  versionId: string;
  src: string;
  onChange: (src: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasImage = src.trim() !== "";

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      onChange(await requestTemplateVersionImageUpload(templateId, versionId, file));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo subir la imagen");
    } finally {
      setUploading(false);
    }
  }

  const btn =
    "h-6 rounded-[var(--te-radius)] border border-[color:var(--te-line)] bg-[color:var(--te-surface)] px-2 text-[11px] font-medium text-[color:var(--te-ink)] transition-colors hover:bg-[color:var(--te-chrome-sunken)] disabled:opacity-50";

  return (
    <div className="space-y-1.5">
      <input
        ref={fileRef}
        type="file"
        accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => void onFileChange(e)}
      />
      <div className="flex items-center gap-2">
        <div
          className="h-10 w-14 shrink-0 overflow-hidden rounded-[var(--te-radius)] border border-[color:var(--te-line)] bg-[color:var(--te-chrome-sunken)] bg-cover bg-center"
          style={hasImage ? { backgroundImage: `url("${src}")` } : undefined}
          aria-hidden
        />
        <div className="flex min-w-0 flex-wrap gap-1">
          <button type="button" className={btn} disabled={uploading} onClick={() => fileRef.current?.click()}>
            {uploading ? "Subiendo…" : hasImage ? "Cambiar imagen" : "Cargar imagen"}
          </button>
          {hasImage ? (
            <button type="button" className={btn} disabled={uploading} onClick={() => onChange("")}>
              Quitar
            </button>
          ) : null}
        </div>
      </div>
      {error ? <p className="text-[11px] text-[color:var(--te-danger)]">{error}</p> : null}
      <details className="text-[11px] text-[color:var(--te-ink-muted)]">
        <summary className="cursor-pointer select-none">Pegar una dirección (URL)</summary>
        <input
          className="mt-1 h-6 w-full rounded-[var(--te-radius)] border border-[color:var(--te-line)] bg-[color:var(--te-surface)] px-1.5 text-[11px] text-[color:var(--te-ink)] outline-none focus:border-[color:var(--te-accent)]"
          value={src}
          placeholder="https://…"
          onChange={(e) => onChange(e.target.value)}
        />
      </details>
    </div>
  );
}
