"use client";

import { useRef, useState, useTransition } from "react";
import {
  uploadEditionCoverAction,
  type EditionCoverUploadState,
} from "@/lib/admin/editions/edition-cover-actions";

type Props = {
  editionId?: string | null;
  horizontalUrl: string;
  verticalUrl: string;
  onHorizontalUrl: (url: string) => void;
  onVerticalUrl: (url: string) => void;
  horizontalError?: string;
  verticalError?: string;
};

function CoverSlot({
  label,
  hint,
  aspectClass,
  url,
  error,
  variant,
  editionId,
  onUrl,
}: {
  label: string;
  hint: string;
  aspectClass: string;
  url: string;
  error?: string;
  variant: "horizontal" | "vertical";
  editionId: string | null;
  onUrl: (url: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<EditionCoverUploadState | null>(null);

  function upload() {
    const file = inputRef.current?.files?.[0];
    if (!file) {
      setState({ ok: false, error: "Seleccioná una imagen." });
      return;
    }
    const maxBytes = 8 * 1024 * 1024;
    if (file.size > maxBytes) {
      setState({ ok: false, error: "Máximo 8 MB. Comprimí la imagen e intentá de nuevo." });
      return;
    }
    const fd = new FormData();
    fd.set("file", file);
    fd.set("variant", variant);
    if (editionId) fd.set("editionId", editionId);
    startTransition(async () => {
      try {
        const result = await uploadEditionCoverAction(null, fd);
        setState(result);
        if (result.ok && result.publicUrl) onUrl(result.publicUrl);
      } catch {
        setState({
          ok: false,
          error: "No se pudo subir la imagen (archivo muy grande o error de red).",
        });
      }
    });
  }

  return (
    <div className="space-y-3 rounded-[var(--ck-radius-card)] border border-ck-border bg-ck-surface p-4">
      <div>
        <p className="text-sm font-semibold text-ck-text">{label}</p>
        <p className="mt-1 text-xs text-ck-text-muted">{hint}</p>
      </div>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt=""
          className={`w-full max-w-sm rounded border border-ck-border object-cover ${aspectClass}`}
        />
      ) : (
        <div
          className={`flex w-full max-w-sm items-center justify-center rounded border border-dashed border-ck-border bg-ck-bg text-xs text-ck-text-muted ${aspectClass}`}
        >
          Sin imagen
        </div>
      )}
      <div className="space-y-3">
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="block w-full text-sm text-ck-text-secondary file:mr-3 file:rounded file:border-0 file:bg-ck-yellow file:px-3 file:py-2 file:text-sm file:font-semibold file:text-ck-bg"
        />
        <button
          type="button"
          disabled={pending}
          onClick={upload}
          className="rounded bg-ck-yellow px-4 py-2 text-sm font-semibold text-ck-bg disabled:opacity-50"
        >
          {pending ? "Subiendo…" : url ? "Reemplazar imagen" : "Subir imagen"}
        </button>
      </div>
      {state?.error ? <p className="text-sm text-red-400">{state.error}</p> : null}
      {state?.ok ? (
        <p className="text-sm text-emerald-400">Imagen lista. Guardá la edición para confirmar.</p>
      ) : null}
      {error ? <p className="text-sm text-red-400">{error}</p> : null}
    </div>
  );
}

export function EditionCoverUploadFields({
  editionId = null,
  horizontalUrl,
  verticalUrl,
  onHorizontalUrl,
  onVerticalUrl,
  horizontalError,
  verticalError,
}: Props) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-ck-text-secondary">
        Subí archivos (no URL). Horizontal para el banner del home y fichas; vertical para
        mobile / stories.
      </p>
      <div className="grid gap-4 lg:grid-cols-2">
        <CoverSlot
          label="Portada horizontal"
          hint="Recomendado 1920×1080 o similar (16:9)."
          aspectClass="aspect-video"
          url={horizontalUrl}
          error={horizontalError}
          variant="horizontal"
          editionId={editionId}
          onUrl={onHorizontalUrl}
        />
        <CoverSlot
          label="Portada vertical"
          hint="Recomendado 1080×1920 o similar (9:16)."
          aspectClass="aspect-[9/16] max-h-80"
          url={verticalUrl}
          error={verticalError}
          variant="vertical"
          editionId={editionId}
          onUrl={onVerticalUrl}
        />
      </div>
      <input type="hidden" name="coverImageUrl" value={horizontalUrl} />
      <input type="hidden" name="coverImageVerticalUrl" value={verticalUrl} />
    </div>
  );
}
