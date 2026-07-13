"use client";

import type { ReactNode } from "react";
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
};

type Props = {
  articleId?: string;
  fromAssistant?: boolean;
  eventTitle?: string | null;
  albumTitle?: string | null;
  sourceName?: string | null;
  linkedAssets: LibraryAsset[];
  onInsertInline: (attrs: EditorialImageAttrs) => void;
};

/**
 * Biblioteca lateral contextual: material ya preparado.
 * No es el selector completo ni un formulario administrativo.
 */
export function MaterialLibraryPanel({
  articleId,
  fromAssistant = false,
  eventTitle,
  albumTitle,
  sourceName,
  linkedAssets,
  onInsertInline,
}: Props) {
  const cover = linkedAssets.filter((a) => a.usageType === "COVER");
  const gallery = linkedAssets.filter((a) => a.usageType === "GALLERY");
  const inline = linkedAssets.filter((a) => a.usageType === "INLINE");

  return (
    <aside className="space-y-6" aria-label="Biblioteca de material editorial">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--is-accent)]">
          {fromAssistant ? "Preparado por el asistente" : "Material editorial"}
        </p>
        <h2 className="font-[family-name:var(--font-source-serif)] text-lg font-semibold leading-snug tracking-tight">
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
      </header>

      <LibrarySection title="★ Portada" empty="Todavía no hay portada." items={cover} />

      <LibrarySection
        title="▣ Galería"
        empty="Sin fotos de galería."
        items={gallery}
        badge="Publicación"
      />

      <LibrarySection
        title="¶ Para el texto"
        empty="Sin fotos para insertar."
        items={inline}
        renderAction={(asset) => (
          <button
            type="button"
            className="rounded bg-[var(--is-accent)] px-2 py-1 text-[10px] font-semibold text-white"
            onClick={() =>
              onInsertInline({
                src: asset.url,
                alt: asset.photographerName
                  ? `Foto de ${asset.photographerName}`
                  : "Fotografía editorial",
                caption: asset.captionOverride ?? "",
                credit: asset.credit ?? asset.photographerName ?? "",
                assetId: asset.assetId ?? null,
              })
            }
          >
            Insertar
          </button>
        )}
      />

      {articleId ? (
        <div className="border-t border-[var(--is-border)] pt-4">
          <Link
            href={`/redaccion/asistente?mode=photos&articleId=${articleId}`}
            className="inline-flex min-h-11 w-full items-center justify-center rounded-[var(--is-radius-sm)] border border-[var(--is-border)] px-4 text-sm font-medium text-[var(--is-accent)]"
          >
            Agregar material
          </Link>
          <p className="mt-2 text-xs leading-relaxed text-[var(--is-muted)]">
            Abre el selector del asistente sin mezclarlo con la escritura.
          </p>
        </div>
      ) : null}
    </aside>
  );
}

function LibrarySection({
  title,
  empty,
  items,
  badge,
  renderAction,
}: {
  title: string;
  empty: string;
  items: LibraryAsset[];
  badge?: string;
  renderAction?: (asset: LibraryAsset) => ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--is-muted)]">
        {title}
        {items.length > 0 ? (
          <span className="ml-2 tabular-nums text-[var(--is-text)]">{items.length}</span>
        ) : null}
      </h3>
      {items.length === 0 ? (
        <p className="text-sm text-[var(--is-muted)]">{empty}</p>
      ) : (
        <ul className="grid grid-cols-2 gap-2">
          {items.map((asset) => (
            <li
              key={asset.linkId}
              className="overflow-hidden rounded-[var(--is-radius-sm)] border border-[var(--is-border)] bg-white"
            >
              <div className="aspect-square bg-[var(--is-bg-muted)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={asset.thumbnailUrl || asset.url}
                  alt=""
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              </div>
              <div className="flex items-center justify-between gap-1 px-2 py-1.5">
                <p className="truncate text-[10px] text-[var(--is-muted)]">
                  {badge || asset.photographerName || "Foto"}
                </p>
                {renderAction?.(asset)}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
