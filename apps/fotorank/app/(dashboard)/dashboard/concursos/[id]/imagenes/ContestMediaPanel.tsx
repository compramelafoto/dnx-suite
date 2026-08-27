"use client";

/**
 * Carga y reemplazo de las imágenes de un concurso.
 *
 * La vista previa la genera el servidor, no el navegador: así lo que se ve
 * antes de guardar es exactamente el recorte que se va a guardar, y no una
 * aproximación hecha con CSS que después no coincide.
 *
 * Este panel no es la única defensa. El servidor vuelve a validar tipo, peso,
 * dimensiones y permisos en cada acción.
 */

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  deleteContestMediaAction,
  previewContestMediaAction,
  saveContestMediaAction,
} from "../../../../../actions/contest-media";
import {
  CONTEST_MEDIA_SPECS,
  formatBytes,
  formatDimensions,
  type ContestMediaKind,
} from "../../../../../lib/fotorank/contest-media/specs";

export type ExistingMedia = {
  id: string;
  url: string;
  altText: string;
  width: number;
  height: number;
  fileSizeBytes: number;
  focalPointX: number;
  focalPointY: number;
  uploadedAtLabel: string;
  uploadedByName: string | null;
};

export type ContestMediaPanelProps = {
  contestId: string;
  contestTitle: string;
  /** true mientras el concurso no sea público: la imagen sólo se ve acá. */
  isDraft: boolean;
  existing: Partial<Record<ContestMediaKind, ExistingMedia>>;
  history: Array<{
    id: string;
    kindLabel: string;
    uploadedAtLabel: string;
    uploadedByName: string | null;
    isActive: boolean;
    wasDeleted: boolean;
  }>;
};

const KIND_ORDER: ContestMediaKind[] = ["BANNER", "CARD", "SOCIAL"];

export function ContestMediaPanel({
  contestId,
  contestTitle,
  isDraft,
  existing,
  history,
}: ContestMediaPanelProps) {
  return (
    <div className="flex flex-col gap-8">
      {isDraft ? (
        <div className="rounded-lg border border-fr-border bg-fr-card p-4">
          <p className="fr-body text-sm text-fr-muted">
            <strong className="text-fr-primary">El concurso está en borrador.</strong> Las imágenes
            que subas se ven únicamente desde acá y desde la vista previa. No van a aparecer en la
            página pública ni al compartir el enlace hasta que publiques el concurso.
          </p>
        </div>
      ) : null}

      {KIND_ORDER.map((kind) => (
        <MediaSlot
          key={kind}
          contestId={contestId}
          contestTitle={contestTitle}
          kind={kind}
          existing={existing[kind] ?? null}
        />
      ))}

      <HistoryList history={history} />
    </div>
  );
}

function MediaSlot({
  contestId,
  contestTitle,
  kind,
  existing,
}: {
  contestId: string;
  contestTitle: string;
  kind: ContestMediaKind;
  existing: ExistingMedia | null;
}) {
  const spec = CONTEST_MEDIA_SPECS[kind];
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();

  const [preview, setPreview] = useState<string | null>(null);
  const [sourceInfo, setSourceInfo] = useState<{ w: number; h: number; bytes: number } | null>(null);
  const [altText, setAltText] = useState(existing?.altText ?? "");
  const [focalX, setFocalX] = useState(existing?.focalPointX ?? 50);
  const [focalY, setFocalY] = useState(existing?.focalPointY ?? 50);
  const [message, setMessage] = useState<{ tone: "ok" | "error" | "warn"; text: string } | null>(
    null,
  );
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  function buildPreview() {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.set("contestId", contestId);
    fd.set("file", file);
    fd.set("focalPointX", String(focalX));
    fd.set("focalPointY", String(focalY));

    startTransition(async () => {
      const result = await previewContestMediaAction(fd);
      if (!result.ok) {
        setPreview(null);
        setSourceInfo(null);
        setMessage({ tone: "error", text: result.message });
        return;
      }
      setPreview(result.dataUri);
      setSourceInfo({ w: result.width, h: result.height, bytes: result.sizeBytes });
      setMessage(result.warning ? { tone: "warn", text: result.warning } : null);
      /** Sugerencia de texto alternativo, editable: mejor eso que un campo vacío. */
      if (!altText.trim()) setAltText(`${spec.label} de ${contestTitle}`);
    });
  }

  function save() {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setMessage({ tone: "error", text: "Elegí un archivo de imagen." });
      return;
    }
    const fd = new FormData();
    fd.set("contestId", contestId);
    fd.set("kind", kind);
    fd.set("file", file);
    fd.set("altText", altText);
    fd.set("focalPointX", String(focalX));
    fd.set("focalPointY", String(focalY));

    startTransition(async () => {
      const result = await saveContestMediaAction(fd);
      setMessage({
        tone: result.ok ? "ok" : "error",
        text: result.warning ? `${result.message} ${result.warning}` : result.message,
      });
      if (result.ok) {
        setPreview(null);
        setSourceInfo(null);
        if (fileRef.current) fileRef.current.value = "";
        router.refresh();
      }
    });
  }

  function remove() {
    const fd = new FormData();
    fd.set("contestId", contestId);
    fd.set("kind", kind);
    startTransition(async () => {
      const result = await deleteContestMediaAction(fd);
      setMessage({ tone: result.ok ? "ok" : "error", text: result.message });
      setConfirmingDelete(false);
      if (result.ok) router.refresh();
    });
  }

  return (
    <section className="rounded-lg border border-fr-border bg-fr-card p-5">
      <header className="mb-4">
        <h2 className="fr-h3 text-fr-primary">{spec.label}</h2>
        <p className="fr-body mt-1 text-sm text-fr-muted">{spec.description}</p>
        <p className="fr-body mt-1 text-xs text-fr-muted">
          Se guarda en {formatDimensions(spec.width, spec.height)} (16:9). Aceptamos JPG, PNG y
          WebP.
        </p>
      </header>

      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <p className="fr-body mb-2 text-xs font-semibold uppercase tracking-wide text-fr-muted">
            {existing ? "Imagen actual" : "Todavía sin imagen"}
          </p>
          <div className="relative aspect-video w-full overflow-hidden rounded-md border border-fr-border bg-black/30">
            {existing ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={existing.url}
                alt={existing.altText}
                className="h-full w-full object-cover"
                style={{ objectPosition: `${existing.focalPointX}% ${existing.focalPointY}%` }}
              />
            ) : (
              <div className="flex h-full items-center justify-center p-4 text-center">
                <p className="fr-body text-sm text-fr-muted">
                  Sin imagen cargada. La página del concurso usa por ahora su presentación
                  tipográfica.
                </p>
              </div>
            )}
          </div>
          {existing ? (
            <p className="fr-body mt-2 text-xs text-fr-muted">
              {formatDimensions(existing.width, existing.height)} ·{" "}
              {formatBytes(existing.fileSizeBytes)} · subida el {existing.uploadedAtLabel}
              {existing.uploadedByName ? ` por ${existing.uploadedByName}` : ""}
            </p>
          ) : null}
        </div>

        <div>
          <p className="fr-body mb-2 text-xs font-semibold uppercase tracking-wide text-fr-muted">
            {existing ? "Reemplazar" : "Cargar imagen"}
          </p>

          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={buildPreview}
            disabled={pending}
            className="fr-body block w-full text-sm text-fr-muted file:mr-3 file:rounded-md file:border file:border-fr-border file:bg-fr-bg file:px-3 file:py-2 file:text-sm file:text-fr-primary"
            aria-label={`Archivo para ${spec.label}`}
          />

          {preview ? (
            <div className="mt-4">
              <p className="fr-body mb-2 text-xs font-semibold uppercase tracking-wide text-fr-muted">
                Vista previa — así se va a guardar
              </p>
              <div className="aspect-video w-full overflow-hidden rounded-md border border-fr-border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={preview} alt="Vista previa de la imagen a guardar" className="h-full w-full object-cover" />
              </div>
              {sourceInfo ? (
                <p className="fr-body mt-2 text-xs text-fr-muted">
                  Original: {formatDimensions(sourceInfo.w, sourceInfo.h)} ·{" "}
                  {formatBytes(sourceInfo.bytes)}
                </p>
              ) : null}

              <fieldset className="mt-4">
                <legend className="fr-body text-xs font-semibold uppercase tracking-wide text-fr-muted">
                  Encuadre
                </legend>
                <p className="fr-body mb-2 text-xs text-fr-muted">
                  Si hay que recortar, elegí qué parte de la imagen se conserva.
                </p>
                <label className="fr-body block text-xs text-fr-muted">
                  Horizontal: {focalX}%
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={focalX}
                    onChange={(e) => setFocalX(Number(e.target.value))}
                    onMouseUp={buildPreview}
                    onTouchEnd={buildPreview}
                    className="mt-1 w-full"
                  />
                </label>
                <label className="fr-body mt-2 block text-xs text-fr-muted">
                  Vertical: {focalY}%
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={focalY}
                    onChange={(e) => setFocalY(Number(e.target.value))}
                    onMouseUp={buildPreview}
                    onTouchEnd={buildPreview}
                    className="mt-1 w-full"
                  />
                </label>
              </fieldset>
            </div>
          ) : null}

          <label className="fr-body mt-4 block text-xs text-fr-muted">
            Descripción de la imagen (obligatoria)
            <input
              type="text"
              value={altText}
              onChange={(e) => setAltText(e.target.value)}
              maxLength={300}
              placeholder="Por ejemplo: afiche del concurso sobre un paisaje de montaña"
              className="fr-input mt-1 w-full"
            />
          </label>
          <p className="fr-body mt-1 text-xs text-fr-muted">
            La leen los lectores de pantalla y se muestra si la imagen no carga.
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={save}
              disabled={pending || !preview}
              className="fr-btn fr-btn-primary"
            >
              {pending ? "Guardando…" : existing ? "Reemplazar imagen" : "Guardar imagen"}
            </button>

            {existing && !confirmingDelete ? (
              <button
                type="button"
                onClick={() => setConfirmingDelete(true)}
                disabled={pending}
                className="fr-btn fr-btn-secondary"
              >
                Eliminar
              </button>
            ) : null}
          </div>

          {confirmingDelete ? (
            <div className="mt-3 rounded-md border border-fr-border bg-fr-bg p-3">
              <p className="fr-body text-sm text-fr-primary">
                ¿Eliminar la {spec.label.toLowerCase()}? El concurso vuelve a mostrarse sin esta
                imagen.
              </p>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={remove}
                  disabled={pending}
                  className="fr-btn fr-btn-primary"
                >
                  Sí, eliminar
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(false)}
                  disabled={pending}
                  className="fr-btn fr-btn-secondary"
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : null}

          {message ? (
            <p
              role="status"
              className={`fr-body mt-3 text-sm ${
                message.tone === "error"
                  ? "text-red-400"
                  : message.tone === "warn"
                    ? "text-amber-400"
                    : "text-emerald-400"
              }`}
            >
              {message.text}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function HistoryList({ history }: { history: ContestMediaPanelProps["history"] }) {
  if (history.length === 0) return null;

  return (
    <section className="rounded-lg border border-fr-border bg-fr-card p-5">
      <h2 className="fr-h3 text-fr-primary">Historial de cambios</h2>
      <p className="fr-body mt-1 text-sm text-fr-muted">
        Quién cambió cada imagen y cuándo. No se borra al reemplazar.
      </p>
      <ul className="mt-4 flex flex-col gap-2">
        {history.map((h) => (
          <li
            key={h.id}
            className="fr-body flex flex-wrap items-center gap-2 border-b border-fr-border pb-2 text-sm text-fr-muted last:border-b-0"
          >
            <span className="font-semibold text-fr-primary">{h.kindLabel}</span>
            <span>{h.uploadedAtLabel}</span>
            {h.uploadedByName ? <span>· {h.uploadedByName}</span> : null}
            {h.isActive ? (
              <span className="rounded-full border border-fr-border px-2 py-0.5 text-xs">
                vigente
              </span>
            ) : h.wasDeleted ? (
              <span className="rounded-full border border-fr-border px-2 py-0.5 text-xs">
                eliminada
              </span>
            ) : (
              <span className="rounded-full border border-fr-border px-2 py-0.5 text-xs">
                reemplazada
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
