"use client";

import { useActionState, useTransition } from "react";
import {
  uploadProductPrimaryImageAction,
  uploadProductSizeChartAction,
  uploadProductGalleryImageAction,
  deleteProductMediaAction,
  reorderProductMediaAction,
  type ProductMediaUploadState,
} from "@/lib/admin/catalog/product-media-actions";

export type ProductMediaRow = {
  id: string;
  mediaType: string;
  sortOrder: number;
  altText: string | null;
  assetId: string;
  publicUrl: string | null;
};

type Props = {
  productId: string;
  primaryImageAssetId?: string | null;
  sizeChartAssetId?: string | null;
  mediaRows?: ProductMediaRow[];
};

export function ProductMediaUploadFields({
  productId,
  primaryImageAssetId,
  sizeChartAssetId,
  mediaRows = [],
}: Props) {
  const [primaryState, primaryAction, primaryPending] = useActionState<
    ProductMediaUploadState | null,
    FormData
  >(uploadProductPrimaryImageAction.bind(null, productId), null);
  const [chartState, chartAction, chartPending] = useActionState<
    ProductMediaUploadState | null,
    FormData
  >(uploadProductSizeChartAction.bind(null, productId), null);
  const [galleryState, galleryAction, galleryPending] = useActionState<
    ProductMediaUploadState | null,
    FormData
  >(uploadProductGalleryImageAction.bind(null, productId), null);
  const [pending, startTransition] = useTransition();

  const hasPrimary = Boolean(primaryImageAssetId);
  const hasChart = Boolean(sizeChartAssetId);

  return (
    <div className="space-y-6">
      <p className="text-sm text-ck-text-secondary">
        Subí archivos a R2 (namespace <code>clickaton/products</code>). También podés
        pegar un asset id existente abajo en el formulario.
      </p>
      {!hasPrimary || !hasChart ? (
        <p className="text-sm text-amber-600">
          MEDIA CONTENT HUMAN UPLOAD REQUIRED — hace falta al menos una foto real y la
          guía de talles antes de abrir ventas.
        </p>
      ) : null}

      <form action={primaryAction} className="space-y-3 rounded border border-ck-border p-4">
        <p className="text-sm font-semibold">Foto principal de remera</p>
        <input type="file" name="file" accept="image/*" required className="block w-full text-sm" />
        <input
          type="text"
          name="altText"
          placeholder="Alt text"
          className="block w-full rounded border border-ck-border bg-ck-surface px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={primaryPending}
          className="rounded bg-ck-yellow px-4 py-2 text-sm font-semibold text-ck-black disabled:opacity-50"
        >
          {primaryPending ? "Subiendo…" : hasPrimary ? "Reemplazar foto principal" : "Subir foto principal"}
        </button>
        {primaryState?.error ? (
          <p className="text-sm text-red-400">{primaryState.error}</p>
        ) : null}
        {primaryState?.ok ? (
          <p className="text-sm text-emerald-400">OK · asset {primaryState.assetId}</p>
        ) : null}
        {primaryImageAssetId ? (
          <p className="text-xs text-ck-text-muted">Actual: {primaryImageAssetId}</p>
        ) : null}
      </form>

      <form action={chartAction} className="space-y-3 rounded border border-ck-border p-4">
        <p className="text-sm font-semibold">Guía / Tabla de talles</p>
        <input type="file" name="file" accept="image/*" required className="block w-full text-sm" />
        <input
          type="text"
          name="altText"
          placeholder="Alt text (ej. Guía de talles Remera Clickatón)"
          defaultValue="Guía / Tabla de talles"
          className="block w-full rounded border border-ck-border bg-ck-surface px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={chartPending}
          className="rounded bg-ck-yellow px-4 py-2 text-sm font-semibold text-ck-black disabled:opacity-50"
        >
          {chartPending ? "Subiendo…" : hasChart ? "Reemplazar guía de talles" : "Subir guía de talles"}
        </button>
        {chartState?.error ? <p className="text-sm text-red-400">{chartState.error}</p> : null}
        {chartState?.ok ? (
          <p className="text-sm text-emerald-400">OK · asset {chartState.assetId}</p>
        ) : null}
        {sizeChartAssetId ? (
          <p className="text-xs text-ck-text-muted">Actual: {sizeChartAssetId}</p>
        ) : null}
      </form>

      <form action={galleryAction} className="space-y-3 rounded border border-ck-border p-4">
        <p className="text-sm font-semibold">Fotos adicionales (galería)</p>
        <input type="file" name="file" accept="image/*" required className="block w-full text-sm" />
        <input
          type="text"
          name="altText"
          placeholder="Alt text"
          className="block w-full rounded border border-ck-border bg-ck-surface px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={galleryPending}
          className="rounded bg-ck-yellow px-4 py-2 text-sm font-semibold text-ck-black disabled:opacity-50"
        >
          {galleryPending ? "Subiendo…" : "Agregar foto"}
        </button>
        {galleryState?.error ? (
          <p className="text-sm text-red-400">{galleryState.error}</p>
        ) : null}
        {galleryState?.ok ? (
          <p className="text-sm text-emerald-400">OK · asset {galleryState.assetId}</p>
        ) : null}
      </form>

      {mediaRows.length > 0 ? (
        <div className="space-y-3 rounded border border-ck-border p-4">
          <p className="text-sm font-semibold">Media cargada</p>
          <ul className="space-y-3">
            {mediaRows.map((m) => (
              <li
                key={m.id}
                className="flex flex-wrap items-center gap-3 rounded border border-ck-border/60 p-3"
              >
                {m.publicUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={m.publicUrl}
                    alt={m.altText ?? m.mediaType}
                    className="h-16 w-16 rounded object-cover"
                  />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded border border-dashed text-xs">
                    —
                  </div>
                )}
                <div className="min-w-0 flex-1 text-sm">
                  <p className="font-medium">{m.mediaType}</p>
                  <p className="text-xs text-ck-text-muted">
                    orden {m.sortOrder}
                    {m.altText ? ` · ${m.altText}` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={pending}
                    className="rounded border border-ck-border px-2 py-1 text-xs"
                    onClick={() =>
                      startTransition(async () => {
                        await reorderProductMediaAction(productId, m.id, "up");
                      })
                    }
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    className="rounded border border-ck-border px-2 py-1 text-xs"
                    onClick={() =>
                      startTransition(async () => {
                        await reorderProductMediaAction(productId, m.id, "down");
                      })
                    }
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    className="rounded border border-red-500/40 px-2 py-1 text-xs text-red-400"
                    onClick={() =>
                      startTransition(async () => {
                        await deleteProductMediaAction(productId, m.id);
                      })
                    }
                  >
                    Borrar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
