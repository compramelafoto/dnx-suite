"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { EditorialImageAttrs } from "@repo/editor";

export type LibraryAsset = {
  linkId: string;
  usageType: "COVER" | "INLINE" | "GALLERY";
  sortOrder: number;
  captionOverride: string | null;
  url: string;
  thumbnailUrl: string | null;
  credit: string | null;
  photographerName: string | null;
  assetId?: string | null;
  /** InfoSpotEditorialPhotoUsage.id — si existe, guarda directo. */
  usageId?: string | null;
  /** CLF photo id — permite crear el uso editorial al guardar alt. */
  sourcePhotoId?: number | null;
  /** Texto alternativo / descripción de accesibilidad. */
  altText?: string | null;
  /** Título de cobertura / material (periodístico). */
  coverageTitle?: string | null;
  albumTitle?: string | null;
  /** ready | processing | unavailable — sin jerga técnica. */
  availability?: "ready" | "processing" | "unavailable";
};

type Props = {
  articleId?: string;
  fromAssistant?: boolean;
  eventTitle?: string | null;
  albumTitle?: string | null;
  sourceName?: string | null;
  linkedAssets: LibraryAsset[];
  /** assetIds detectados en el cuerpo Markdown/HTML. */
  usedAssetIds?: Set<string> | string[];
  /** assetId resaltado por el cursor del editor. */
  highlightedAssetId?: string | null;
  onInsertInline: (attrs: EditorialImageAttrs) => void;
  onGoToUsed?: (assetId: string) => void;
  /** Desvincular foto de la nota (ArticleAsset linkId). */
  onUnlink?: (linkId: string, asset: LibraryAsset) => void | Promise<void>;
  unlinkingLinkId?: string | null;
  /** Guardar descripción (alt text) de una foto CLF. */
  onSaveAltText?: (altText: string, asset: LibraryAsset) => void | Promise<void>;
  /** linkId de la foto cuya descripción se está guardando. */
  savingAltLinkId?: string | null;
};

const FAVORITES_KEY = "infospot-material-favorites-v1";

function loadFavorites(articleId: string): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(FAVORITES_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as Record<string, string[]>;
    return new Set(parsed[articleId] ?? []);
  } catch {
    return new Set();
  }
}

function saveFavorites(articleId: string, ids: Set<string>) {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(FAVORITES_KEY);
    const parsed = (raw ? JSON.parse(raw) : {}) as Record<string, string[]>;
    parsed[articleId] = Array.from(ids);
    window.localStorage.setItem(FAVORITES_KEY, JSON.stringify(parsed));
  } catch {
    // ignore
  }
}

function availabilityLabel(a: LibraryAsset["availability"]): string {
  switch (a) {
    case "processing":
      return "Procesando";
    case "unavailable":
      return "No disponible";
    default:
      return "Lista";
  }
}

/**
 * Biblioteca lateral: único lugar para consumir material preparado.
 * No abre pickers CLF; “Agregar material” vuelve al asistente.
 */
export function MaterialLibraryPanel({
  articleId,
  fromAssistant = false,
  eventTitle,
  albumTitle,
  sourceName,
  linkedAssets,
  usedAssetIds,
  highlightedAssetId,
  onInsertInline,
  onGoToUsed,
  onUnlink,
  unlinkingLinkId = null,
  onSaveAltText,
  savingAltLinkId = null,
}: Props) {
  const used = useMemo(() => {
    if (!usedAssetIds) return new Set<string>();
    return usedAssetIds instanceof Set ? usedAssetIds : new Set(usedAssetIds);
  }, [usedAssetIds]);

  const [query, setQuery] = useState("");
  const [favorites, setFavorites] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    if (!articleId) return;
    setFavorites(loadFavorites(articleId));
  }, [articleId]);

  const toggleFavorite = useCallback(
    (linkId: string) => {
      if (!articleId) return;
      setFavorites((prev) => {
        const next = new Set(prev);
        if (next.has(linkId)) next.delete(linkId);
        else next.add(linkId);
        saveFavorites(articleId, next);
        return next;
      });
    },
    [articleId],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return linkedAssets;
    return linkedAssets.filter((a) => {
      const hay = [
        a.photographerName,
        a.coverageTitle,
        a.albumTitle,
        albumTitle,
        a.credit,
        a.captionOverride,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [linkedAssets, query, albumTitle]);

  const cover = filtered.filter((a) => a.usageType === "COVER");
  const gallery = filtered.filter((a) => a.usageType === "GALLERY");
  const insertables = filtered.filter((a) => a.usageType === "INLINE");
  const processing = filtered.filter((a) => a.availability === "processing");
  const unavailable = filtered.filter((a) => a.availability === "unavailable");
  const available = filtered.filter(
    (a) =>
      a.usageType === "INLINE" &&
      (a.availability === "ready" || !a.availability) &&
      !(a.assetId && used.has(a.assetId)),
  );
  const usedItems = filtered.filter((a) => a.assetId && used.has(a.assetId));
  const favoriteItems = filtered.filter((a) => favorites.has(a.linkId));

  return (
    <aside className="space-y-8" aria-label="Biblioteca de material editorial">
      <header className="space-y-3">
        <p className="is-editorial-eyebrow">
          {fromAssistant ? "Preparado por el asistente" : "Material editorial"}
        </p>
        <h2 className="is-font-serif text-xl font-semibold leading-snug tracking-tight">
          Biblioteca
        </h2>
        <dl className="space-y-1 text-sm leading-relaxed text-[var(--is-muted)]">
          <div>
            <dt className="inline">Evento · </dt>
            <dd className="inline text-[var(--is-text)]">{eventTitle || "Sin evento"}</dd>
          </div>
          <div>
            <dt className="inline">Cobertura · </dt>
            <dd className="inline text-[var(--is-text)]">
              {albumTitle || "Sin cobertura vinculada"}
            </dd>
          </div>
          {sourceName ? (
            <div>
              <dt className="inline">Autor · </dt>
              <dd className="inline text-[var(--is-text)]">{sourceName}</dd>
            </div>
          ) : null}
        </dl>
        {linkedAssets.length > 0 ? (
          <p className="rounded-[var(--is-radius-sm)] border border-[var(--is-border)] bg-[var(--is-bg-muted)] px-3 py-2 text-[12px] leading-relaxed text-[var(--is-muted)]">
            En cada foto: escribí la <strong className="text-[var(--is-text)]">descripción</strong>{" "}
            (obligatoria para publicar) y usá <strong className="text-[var(--is-text)]">Quitar</strong>{" "}
            para eliminarla de la nota. Para sumar o cambiar fotos:{" "}
            <strong className="text-[var(--is-text)]">Agregar material</strong>.
          </p>
        ) : null}
      </header>

      {linkedAssets.length > 0 ? (
        <label className="block">
          <span className="sr-only">Buscar en material</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar fotógrafo, cobertura…"
            className="is-input"
          />
        </label>
      ) : null}

      {linkedAssets.length === 0 ? (
        <p className="is-empty-editorial">
          Todavía no agregaste fotografías.
          <br />
          Sumá material desde el asistente editorial.
        </p>
      ) : null}

      {favoriteItems.length > 0 ? (
        <LibrarySection
          title="★ Favoritas"
          empty=""
          items={favoriteItems}
          highlightedAssetId={highlightedAssetId}
          favorites={favorites}
          used={used}
          albumFallback={albumTitle}
          onToggleFavorite={articleId ? toggleFavorite : undefined}
          onInsertInline={onInsertInline}
          onGoToUsed={onGoToUsed}
          onUnlink={onUnlink}
          unlinkingLinkId={unlinkingLinkId}
          onSaveAltText={onSaveAltText}
          savingAltLinkId={savingAltLinkId}
        />
      ) : null}

      <LibrarySection
        title="Portada"
        empty="Todavía no hay portada."
        items={cover}
        highlightedAssetId={highlightedAssetId}
        favorites={favorites}
        used={used}
        albumFallback={albumTitle}
        onToggleFavorite={articleId ? toggleFavorite : undefined}
        onUnlink={onUnlink}
        unlinkingLinkId={unlinkingLinkId}
        onSaveAltText={onSaveAltText}
        savingAltLinkId={savingAltLinkId}
      />

      <LibrarySection
        title="Galería"
        empty="Sin fotos de galería."
        items={gallery}
        highlightedAssetId={highlightedAssetId}
        favorites={favorites}
        used={used}
        albumFallback={albumTitle}
        onToggleFavorite={articleId ? toggleFavorite : undefined}
        onUnlink={onUnlink}
        unlinkingLinkId={unlinkingLinkId}
        onSaveAltText={onSaveAltText}
        savingAltLinkId={savingAltLinkId}
      />

      <LibrarySection
        title="Para insertar"
        empty="Sin fotos listas para el texto."
        items={available.length ? available : insertables.filter((a) => !(a.assetId && used.has(a.assetId)))}
        highlightedAssetId={highlightedAssetId}
        favorites={favorites}
        used={used}
        albumFallback={albumTitle}
        onToggleFavorite={articleId ? toggleFavorite : undefined}
        onInsertInline={onInsertInline}
        onGoToUsed={onGoToUsed}
        onUnlink={onUnlink}
        unlinkingLinkId={unlinkingLinkId}
        onSaveAltText={onSaveAltText}
        savingAltLinkId={savingAltLinkId}
      />

      <LibrarySection
        title="Usadas en el texto"
        empty="Ninguna foto insertada todavía."
        items={usedItems}
        highlightedAssetId={highlightedAssetId}
        favorites={favorites}
        used={used}
        albumFallback={albumTitle}
        onToggleFavorite={articleId ? toggleFavorite : undefined}
        onGoToUsed={onGoToUsed}
        onUnlink={onUnlink}
        unlinkingLinkId={unlinkingLinkId}
        onSaveAltText={onSaveAltText}
        savingAltLinkId={savingAltLinkId}
        forceUsedBadge
      />

      {processing.length > 0 ? (
        <LibrarySection
          title="Procesando"
          empty=""
          items={processing}
          highlightedAssetId={highlightedAssetId}
          favorites={favorites}
          used={used}
          albumFallback={albumTitle}
          onToggleFavorite={articleId ? toggleFavorite : undefined}
          onUnlink={onUnlink}
          unlinkingLinkId={unlinkingLinkId}
          onSaveAltText={onSaveAltText}
          savingAltLinkId={savingAltLinkId}
        />
      ) : null}

      {unavailable.length > 0 ? (
        <LibrarySection
          title="No disponibles"
          empty=""
          items={unavailable}
          highlightedAssetId={highlightedAssetId}
          favorites={favorites}
          used={used}
          albumFallback={albumTitle}
          onToggleFavorite={articleId ? toggleFavorite : undefined}
          onUnlink={onUnlink}
          unlinkingLinkId={unlinkingLinkId}
          onSaveAltText={onSaveAltText}
          savingAltLinkId={savingAltLinkId}
        />
      ) : null}

      {articleId ? (
        <div className="border-t border-[var(--is-border)] pt-6">
          <Link
            href={`/redaccion/asistente?mode=photos&articleId=${articleId}`}
            className="is-btn is-btn-secondary w-full"
          >
            Agregar material
          </Link>
          <p className="is-input-helper">
            Abre el asistente. Al terminar volvés al editor con el material listo.
          </p>
        </div>
      ) : null}
    </aside>
  );
}

function LibraryThumb({ src, label }: { src: string | null; label: string }) {
  const [failed, setFailed] = useState(!src);
  const [loaded, setLoaded] = useState(false);

  if (failed || !src) {
    return (
      <div className="flex h-full items-center justify-center bg-[var(--is-bg-muted)] px-2 text-center text-[10px] text-[var(--is-muted)]">
        Vista previa no disponible
      </div>
    );
  }

  return (
    <>
      {!loaded ? (
        <div className="is-skeleton absolute inset-0" aria-hidden />
      ) : null}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={label}
        className={`h-full w-full object-cover transition-opacity duration-200 ${
          loaded ? "opacity-100" : "opacity-0"
        }`}
        loading="lazy"
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
      />
    </>
  );
}

function LibrarySection({
  title,
  empty,
  items,
  highlightedAssetId,
  favorites,
  used,
  albumFallback,
  onToggleFavorite,
  onInsertInline,
  onGoToUsed,
  onUnlink,
  unlinkingLinkId = null,
  onSaveAltText,
  savingAltLinkId = null,
  forceUsedBadge,
}: {
  title: string;
  empty: string;
  items: LibraryAsset[];
  highlightedAssetId?: string | null;
  favorites: Set<string>;
  used: Set<string>;
  albumFallback?: string | null;
  onToggleFavorite?: (linkId: string) => void;
  onInsertInline?: (attrs: EditorialImageAttrs) => void;
  onGoToUsed?: (assetId: string) => void;
  onUnlink?: (linkId: string, asset: LibraryAsset) => void | Promise<void>;
  unlinkingLinkId?: string | null;
  onSaveAltText?: (altText: string, asset: LibraryAsset) => void | Promise<void>;
  savingAltLinkId?: string | null;
  forceUsedBadge?: boolean;
}) {
  if (items.length === 0 && !empty) return null;

  return (
    <section className="space-y-4">
      <h3 className="is-editorial-section-label">
        {title}
        {items.length > 0 ? (
          <span className="ml-2 tabular-nums text-[var(--is-text)]">{items.length}</span>
        ) : null}
      </h3>
      {items.length === 0 ? (
        <p className="text-sm leading-relaxed text-[var(--is-muted)]">{empty}</p>
      ) : (
        <ul className="space-y-3">
          {items.map((asset) => {
            const isUsed = Boolean(
              forceUsedBadge || (asset.assetId && used.has(asset.assetId)),
            );
            const isHi =
              highlightedAssetId &&
              asset.assetId &&
              highlightedAssetId === asset.assetId;
            const coverage =
              asset.coverageTitle || asset.albumTitle || albumFallback || "Cobertura";
            const label =
              asset.altText?.trim() ||
              (asset.photographerName
                ? `Foto de ${asset.photographerName}`
                : "Fotografía editorial");
            const needsAlt = !asset.altText?.trim();
            const savingAlt = savingAltLinkId === asset.linkId;

            const variantClass = [
              "is-material-item",
              isHi ? "is-material-item--active" : "",
              favorites.has(asset.linkId) ? "is-material-item--favorite" : "",
              asset.usageType === "COVER" ? "is-material-item--cover" : "",
              asset.usageType === "GALLERY" ? "is-material-item--gallery" : "",
              asset.usageType === "INLINE" && !isUsed ? "is-material-item--insert" : "",
              isUsed ? "is-material-item--used" : "",
              asset.availability === "processing" ? "is-material-item--processing" : "",
              asset.availability === "unavailable" ? "is-material-item--unavailable" : "",
            ]
              .filter(Boolean)
              .join(" ");

            return (
              <li
                key={asset.linkId}
                id={asset.assetId ? `material-asset-${asset.assetId}` : undefined}
                className={variantClass}
              >
                <div className="flex gap-3 p-3">
                  <div className="relative size-16 shrink-0 overflow-hidden rounded-[var(--is-radius-sm)] bg-[var(--is-bg-muted)]">
                    <LibraryThumb
                      src={asset.thumbnailUrl || asset.url}
                      label={label}
                    />
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="truncate text-sm font-semibold text-[var(--is-text)]">
                        {asset.photographerName || "Fotógrafo"}
                      </p>
                      {onToggleFavorite ? (
                        <button
                          type="button"
                          className="is-btn is-btn-ghost shrink-0 !min-h-0 px-1 text-sm"
                          aria-label={
                            favorites.has(asset.linkId)
                              ? "Quitar de favoritas"
                              : "Marcar favorita"
                          }
                          aria-pressed={favorites.has(asset.linkId)}
                          onClick={() => onToggleFavorite(asset.linkId)}
                        >
                          {favorites.has(asset.linkId) ? "★" : "☆"}
                        </button>
                      ) : null}
                    </div>
                    <p className="truncate text-[11px] text-[var(--is-muted)]">
                      {coverage}
                      {asset.albumTitle && asset.albumTitle !== coverage
                        ? ` · ${asset.albumTitle}`
                        : ""}
                    </p>
                    <p className="truncate text-[11px] text-[var(--is-muted)]">
                      {availabilityLabel(asset.availability)}
                      {asset.credit ? ` · ${asset.credit}` : ""}
                    </p>
                    {isUsed ? (
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-teal-800">
                        Usada en el artículo
                      </p>
                    ) : null}
                    {onSaveAltText ? (
                      <label className="block pt-2">
                        <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-[var(--is-muted)]">
                          Descripción{needsAlt ? " *" : ""}
                        </span>
                        <textarea
                          key={`${asset.linkId}:${asset.usageId ?? "new"}:${asset.altText ?? ""}`}
                          defaultValue={asset.altText ?? ""}
                          rows={2}
                          maxLength={300}
                          placeholder="Ej: Perro blanco en la largada del evento"
                          className={`w-full resize-y rounded-[var(--is-radius-sm)] border px-2 py-1.5 text-[11px] leading-snug text-[var(--is-text)] ${
                            needsAlt
                              ? "border-red-300 bg-red-50/60"
                              : "border-[var(--is-border)] bg-white"
                          }`}
                          disabled={savingAlt}
                          onBlur={(e) => {
                            const next = e.target.value.trim();
                            if (next === (asset.altText ?? "").trim()) return;
                            void onSaveAltText(next, asset);
                          }}
                        />
                        {savingAlt ? (
                          <span className="mt-0.5 block text-[10px] text-[var(--is-muted)]">
                            Guardando…
                          </span>
                        ) : needsAlt ? (
                          <span className="mt-0.5 block text-[10px] text-red-700">
                            Obligatorio para publicar — escribí y tocá afuera para guardar
                          </span>
                        ) : (
                          <span className="mt-0.5 block text-[10px] text-teal-800">
                            Descripción guardada
                          </span>
                        )}
                      </label>
                    ) : null}
                    <div className="flex flex-wrap gap-1.5 pt-2">
                      {onInsertInline && asset.usageType === "INLINE" && !isUsed ? (
                        <button
                          type="button"
                          className="is-btn is-btn-primary !min-h-0 px-2.5 py-1 text-[11px]"
                          onClick={() =>
                            onInsertInline({
                              src: asset.url,
                              alt: label,
                              caption: asset.captionOverride ?? "",
                              credit: asset.credit ?? asset.photographerName ?? "",
                              assetId: asset.assetId ?? null,
                            })
                          }
                        >
                          Insertar
                        </button>
                      ) : null}
                      {isUsed && asset.assetId && onGoToUsed ? (
                        <button
                          type="button"
                          className="is-btn is-btn-secondary !min-h-0 px-2.5 py-1 text-[11px]"
                          onClick={() => onGoToUsed(asset.assetId!)}
                        >
                          Ir al texto
                        </button>
                      ) : null}
                      {onUnlink ? (
                        <button
                          type="button"
                          className="is-btn is-btn-secondary !min-h-0 border-red-200 px-2.5 py-1 text-[11px] text-red-700 hover:border-red-300 hover:bg-red-50"
                          disabled={unlinkingLinkId === asset.linkId}
                          onClick={() => void onUnlink(asset.linkId, asset)}
                        >
                          {unlinkingLinkId === asset.linkId
                            ? "Quitando…"
                            : "Quitar"}
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
