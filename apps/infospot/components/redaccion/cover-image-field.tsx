"use client";

import { useEffect, useMemo, useState } from "react";
import {
  resolveCoverOrigin,
  type CoverSourceType,
} from "@/lib/editorial/cover-priority";

export type CoverAssetOption = {
  id: string;
  url: string;
  caption: string | null;
  credit?: string | null;
  alt?: string | null;
  sourceType?: CoverSourceType;
};

export type ClfCoverOption = {
  assetId: string;
  url: string;
  thumbnailUrl?: string | null;
  credit?: string | null;
  photographerName?: string | null;
  albumTitle?: string | null;
  coverageTitle?: string | null;
  caption?: string | null;
};

export type CoverImageChange = {
  id: string;
  credit: string;
  caption: string;
  sourceType?: CoverSourceType;
};

type Props = {
  name?: string;
  articleId?: string;
  initialCoverImageId?: string | null;
  initialCredit?: string | null;
  initialCaption?: string | null;
  assets: CoverAssetOption[];
  /** Fotos ya vinculadas desde cobertura CLF (alternativa a subir). */
  clfOptions?: ClfCoverOption[];
  onChange?: (next: CoverImageChange) => void;
};

type Tab = "upload" | "clf";

export function CoverImageField({
  name = "coverImageId",
  articleId,
  initialCoverImageId,
  initialCredit,
  initialCaption,
  assets,
  clfOptions = [],
  onChange,
}: Props) {
  const [selectedId, setSelectedId] = useState(initialCoverImageId ?? "");
  const [library, setLibrary] = useState(assets);
  const [credit, setCredit] = useState(initialCredit ?? "");
  const [caption, setCaption] = useState(initialCaption ?? "");
  const [alt, setAlt] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const selectedUpload = library.find((a) => a.id === selectedId);
  const selectedClf = clfOptions.find((a) => a.assetId === selectedId);
  const selectedSourceType: CoverSourceType = selectedUpload?.sourceType
    ? selectedUpload.sourceType
    : selectedClf
      ? "CLF_PHOTO"
      : selectedUpload
        ? "UPLOAD"
        : null;

  const origin = useMemo(
    () =>
      resolveCoverOrigin({
        coverImageId: selectedId || null,
        sourceType: selectedSourceType,
      }),
    [selectedId, selectedSourceType],
  );

  const defaultTab: Tab =
    selectedSourceType === "CLF_PHOTO" && clfOptions.length > 0 ? "clf" : "upload";
  const [tab, setTab] = useState<Tab>(defaultTab);

  // Si el servidor trae crédito/pie actualizados (p. ej. al reabrir), sincronizar.
  useEffect(() => {
    if (initialCredit != null) setCredit(initialCredit);
  }, [initialCredit]);
  useEffect(() => {
    if (initialCaption != null) setCaption(initialCaption);
  }, [initialCaption]);

  function emitChange(
    id: string,
    nextCredit: string,
    nextCaption: string,
    sourceType?: CoverSourceType,
  ) {
    onChange?.({
      id,
      credit: nextCredit,
      caption: nextCaption,
      sourceType:
        sourceType ??
        selectedSourceType ??
        (id ? "UPLOAD" : null),
    });
  }

  function select(id: string, nextCredit?: string, sourceType?: CoverSourceType) {
    setSelectedId(id);
    const fromUpload = library.find((a) => a.id === id);
    const fromClf = clfOptions.find((a) => a.assetId === id);
    const resolvedCredit = id
      ? (nextCredit ??
        fromUpload?.credit ??
        fromClf?.credit ??
        fromClf?.photographerName ??
        credit)
      : "";
    // Preferir pie del asset; si no tiene, conservar el que el redactor ya escribió.
    const resolvedCaption = id
      ? (fromUpload?.caption ?? fromClf?.caption ?? caption)
      : "";
    setCredit(resolvedCredit || "");
    setCaption(resolvedCaption || "");
    emitChange(
      id,
      resolvedCredit || "",
      resolvedCaption || "",
      sourceType ??
        fromUpload?.sourceType ??
        (fromClf ? "CLF_PHOTO" : id ? "UPLOAD" : null),
    );
  }

  async function onUpload(file: File | null) {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const body = new FormData();
      body.set("file", file);
      body.set("purpose", "cover");
      if (articleId) body.set("articleId", articleId);
      if (credit.trim()) body.set("credit", credit.trim());
      if (caption.trim()) body.set("caption", caption.trim());
      if (alt.trim()) body.set("alt", alt.trim());
      const res = await fetch("/api/redaccion/upload", { method: "POST", body });
      const data = (await res.json()) as {
        asset?: CoverAssetOption;
        error?: string;
      };
      if (!res.ok || !data.asset) {
        throw new Error(data.error || "No se pudo subir la imagen");
      }
      const asset: CoverAssetOption = {
        ...data.asset,
        sourceType: "UPLOAD",
      };
      setLibrary((prev) => [asset, ...prev]);
      const nextCaption = asset.caption || caption;
      const nextCredit = asset.credit || credit;
      setCaption(nextCaption || "");
      setCredit(nextCredit || "");
      setSelectedId(asset.id);
      setTab("upload");
      emitChange(asset.id, nextCredit || "", nextCaption || "", "UPLOAD");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error de subida");
    } finally {
      setUploading(false);
    }
  }

  const previewUrl = selectedUpload?.url || selectedClf?.url || selectedClf?.thumbnailUrl || null;

  return (
    <div className="space-y-4">
      <input type="hidden" name={name} value={selectedId} />
      <input type="hidden" name="coverCredit" value={credit} />
      <input type="hidden" name="coverCaption" value={caption} />

      <div>
        <label className="text-sm font-semibold text-[var(--is-text)]">Imagen de portada</label>
        <p className="mt-1 text-sm leading-relaxed text-[var(--is-muted)]">
          Podés subir una imagen propia o elegir una foto de una cobertura CLF. No hace falta
          tener un álbum asociado para publicar con portada.
        </p>
        <p
          className="mt-2 rounded-[var(--is-radius-sm)] border border-[var(--is-border)] bg-[var(--is-bg-secondary)] px-3 py-2 text-xs leading-relaxed text-[var(--is-text-secondary)]"
          role="status"
        >
          <span className="font-semibold text-[var(--is-text)]">{origin.label}.</span>{" "}
          {origin.priorityNote}
        </p>
      </div>

      <div
        className="flex gap-2 border-b border-[var(--is-border)] pb-2"
        role="tablist"
        aria-label="Origen de la portada"
      >
        <button
          type="button"
          role="tab"
          aria-selected={tab === "upload"}
          className={`min-h-10 rounded-[var(--is-radius-sm)] px-3 text-sm font-semibold ${
            tab === "upload"
              ? "bg-[var(--is-accent)] text-white"
              : "border border-[var(--is-border)] text-[var(--is-text-secondary)]"
          }`}
          onClick={() => setTab("upload")}
        >
          Subir imagen
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "clf"}
          className={`min-h-10 rounded-[var(--is-radius-sm)] px-3 text-sm font-semibold ${
            tab === "clf"
              ? "bg-[var(--is-accent)] text-white"
              : "border border-[var(--is-border)] text-[var(--is-text-secondary)]"
          }`}
          onClick={() => setTab("clf")}
        >
          Elegir desde cobertura CLF
        </button>
      </div>

      {tab === "upload" ? (
        <div>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              void onUpload(e.dataTransfer.files?.[0] ?? null);
            }}
            className={`rounded-[var(--is-radius-sm)] border border-dashed px-4 py-5 text-center transition ${
              dragOver
                ? "border-[var(--is-accent)] bg-[var(--is-orange-50)]"
                : "border-[var(--is-border-strong)] bg-[var(--is-bg-secondary)]"
            }`}
          >
            <p className="text-sm text-[var(--is-text-secondary)]">
              Arrastrá una imagen acá o elegí un archivo · JPG/PNG/WebP · máx. 5 MB
            </p>
            <label className="mt-3 inline-flex min-h-11 cursor-pointer items-center justify-center rounded-[var(--is-radius-sm)] bg-[var(--is-accent)] px-4 text-sm font-semibold text-white hover:bg-[var(--is-accent-hover)]">
              {uploading ? "Subiendo…" : "Subir portada propia"}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={uploading}
                className="sr-only"
                onChange={(e) => {
                  void onUpload(e.target.files?.[0] ?? null);
                  e.target.value = "";
                }}
              />
            </label>
          </div>
          {error ? <p className="mt-2 text-sm text-red-700">{error}</p> : null}

          {library.length > 0 ? (
            <div className="mt-4">
              <p className="mb-2 text-sm font-semibold">Biblioteca de subidas recientes</p>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {library.map((asset) => (
                  <button
                    key={asset.id}
                    type="button"
                    onClick={() => select(asset.id, undefined, asset.sourceType ?? "UPLOAD")}
                    className={`overflow-hidden rounded-[var(--is-radius-sm)] border ${
                      selectedId === asset.id
                        ? "border-[var(--is-accent)] ring-2 ring-[var(--is-accent)]/30"
                        : "border-[var(--is-border)]"
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={asset.url} alt="" className="aspect-square w-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <div>
          {clfOptions.length === 0 ? (
            <div className="rounded-[var(--is-radius-sm)] border border-[var(--is-border)] bg-[var(--is-bg-secondary)] px-4 py-4 text-sm leading-relaxed text-[var(--is-muted)]">
              <p>
                Todavía no hay fotos de cobertura vinculadas a esta nota. Podés subir una portada
                propia o preparar material desde el Asistente Editorial.
              </p>
              {articleId ? (
                <a
                  href={`/redaccion/asistente?mode=photos&articleId=${articleId}`}
                  className="mt-3 inline-flex min-h-11 items-center font-semibold text-[var(--is-accent)] hover:underline"
                >
                  Abrir Asistente para elegir fotos CLF
                </a>
              ) : (
                <p className="mt-2 text-xs">
                  Guardá el borrador primero para vincular una cobertura CLF.
                </p>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {clfOptions.map((asset) => (
                <button
                  key={asset.assetId}
                  type="button"
                  onClick={() =>
                    select(
                      asset.assetId,
                      asset.credit || asset.photographerName || undefined,
                      "CLF_PHOTO",
                    )
                  }
                  className={`overflow-hidden rounded-[var(--is-radius-sm)] border ${
                    selectedId === asset.assetId
                      ? "border-[var(--is-accent)] ring-2 ring-[var(--is-accent)]/30"
                      : "border-[var(--is-border)]"
                  }`}
                  title={asset.albumTitle || asset.coverageTitle || "Foto CLF"}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={asset.thumbnailUrl || asset.url}
                    alt=""
                    className="aspect-square w-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div>
        <label className="text-sm font-semibold" htmlFor="cover-caption">
          Pie de foto
        </label>
        <input
          id="cover-caption"
          value={caption}
          onChange={(e) => {
            const next = e.target.value;
            setCaption(next);
            emitChange(selectedId, credit, next, selectedSourceType);
          }}
          className="mt-2 w-full rounded-[var(--is-radius-sm)] border border-[var(--is-border-strong)] px-3 py-3 text-sm"
          placeholder="Texto que se muestra bajo la portada en la nota"
        />
        <p className="mt-1.5 text-xs leading-relaxed text-[var(--is-muted)]">
          Aparece en la vista previa y en la nota publicada.
        </p>
      </div>

      <div>
        <label className="text-sm font-semibold" htmlFor="cover-alt">
          Texto alternativo
        </label>
        <input
          id="cover-alt"
          value={alt}
          onChange={(e) => setAlt(e.target.value)}
          className="mt-2 w-full rounded-[var(--is-radius-sm)] border border-[var(--is-border-strong)] px-3 py-3 text-sm"
          placeholder="Descripción breve para accesibilidad (opcional)"
        />
        <p className="mt-1.5 text-xs leading-relaxed text-[var(--is-muted)]">
          No se muestra como pie. Si lo dejás vacío al subir, se usa el pie de foto.
        </p>
      </div>

      <div>
        <label className="text-sm font-semibold" htmlFor="cover-credit">
          Crédito / autor
        </label>
        <input
          id="cover-credit"
          value={credit}
          onChange={(e) => {
            const next = e.target.value;
            setCredit(next);
            emitChange(selectedId, next, caption, selectedSourceType);
          }}
          className="mt-2 w-full rounded-[var(--is-radius-sm)] border border-[var(--is-border-strong)] px-3 py-3 text-sm"
          placeholder="Foto: Nombre / Medio"
        />
      </div>

      {previewUrl ? (
        <div className="overflow-hidden rounded-[var(--is-radius-sm)] border border-[var(--is-border)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt={alt || caption || ""}
            className="aspect-[16/10] w-full object-cover"
          />
          {(caption.trim() || credit.trim()) && (
            <div className="space-y-1 border-t border-[var(--is-border)] px-3 py-2 text-sm">
              {caption.trim() ? <p className="text-[var(--is-text)]">{caption}</p> : null}
              {credit.trim() ? (
                <p className="font-medium text-[var(--is-text-secondary)]">{credit}</p>
              ) : null}
            </div>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-2 text-sm">
            <span className="text-[var(--is-muted)]">
              Origen: {origin.origin === "clf" ? "Cobertura CLF" : "Subida propia"}
            </span>
            <button
              type="button"
              className="min-h-11 text-[var(--is-accent)]"
              onClick={() => select("", "", null)}
            >
              Eliminar portada
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
