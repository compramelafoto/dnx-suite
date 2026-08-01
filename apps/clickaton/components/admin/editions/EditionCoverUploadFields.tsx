"use client";

import { useRef, useState, useTransition } from "react";
import {
  uploadEditionCoverAction,
  type EditionCoverUploadState,
} from "@/lib/admin/editions/edition-cover-actions";
import {
  EDITION_COVER_HORIZONTAL,
  EDITION_COVER_VERTICAL,
  editionCoverHorizontalHint,
  editionCoverVerticalHint,
} from "@/lib/admin/editions/cover-specs";

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
  specsLine,
  safeZoneNote,
  aspectClass,
  url,
  error,
  variant,
  editionId,
  onUrl,
}: {
  label: string;
  hint: string;
  specsLine: string;
  safeZoneNote: string;
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
      <div className="space-y-2">
        <p className="text-sm font-semibold text-ck-text">{label}</p>
        <p className="text-sm font-medium text-ck-yellow">{specsLine}</p>
        <p className="text-xs text-ck-text-muted">{hint}</p>
        <p className="text-xs text-ck-text-muted">{safeZoneNote}</p>
      </div>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt=""
          className={`w-full max-w-md rounded border border-ck-border object-contain bg-ck-bg ${aspectClass}`}
        />
      ) : (
        <div
          className={`flex w-full max-w-md flex-col items-center justify-center gap-1 rounded border border-dashed border-ck-border bg-ck-bg px-3 text-center text-xs text-ck-text-muted ${aspectClass}`}
        >
          <span>Sin imagen</span>
          <span className="font-medium text-ck-text-secondary">{specsLine}</span>
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
  const h = EDITION_COVER_HORIZONTAL;
  const v = EDITION_COVER_VERTICAL;

  return (
    <div className="space-y-4">
      <div className="space-y-2 rounded-[var(--ck-radius-card)] border border-ck-border bg-ck-bg/60 p-4">
        <p className="text-sm font-semibold text-ck-text">Medidas obligatorias</p>
        <ul className="list-disc space-y-1 pl-5 text-sm text-ck-text-secondary">
          <li>
            Horizontal:{" "}
            <strong className="text-ck-text">
              {h.width}×{h.height} px
            </strong>{" "}
            ({h.aspectLabel}) — banner Home desktop + miniaturas
          </li>
          <li>
            Vertical:{" "}
            <strong className="text-ck-text">
              {v.width}×{v.height} px
            </strong>{" "}
            ({v.aspectLabel}) — banner Home móvil + stories
          </li>
        </ul>
        <p className="text-xs text-ck-text-muted">
          Exportá en esos píxeles exactos (sin recortes raros). Si subís otra proporción, se verá
          mal con recortes.
        </p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <CoverSlot
          label="Portada horizontal"
          specsLine={`${h.width}×${h.height} px · ${h.aspectLabel}`}
          hint={editionCoverHorizontalHint()}
          safeZoneNote={h.safeZoneNote}
          aspectClass={h.aspectClass}
          url={horizontalUrl}
          error={horizontalError}
          variant="horizontal"
          editionId={editionId}
          onUrl={onHorizontalUrl}
        />
        <CoverSlot
          label="Portada vertical"
          specsLine={`${v.width}×${v.height} px · ${v.aspectLabel}`}
          hint={editionCoverVerticalHint()}
          safeZoneNote={v.safeZoneNote}
          aspectClass={`${v.aspectClass} max-h-96`}
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
