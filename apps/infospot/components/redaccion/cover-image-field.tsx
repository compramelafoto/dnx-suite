"use client";

import { useState } from "react";

export type CoverAssetOption = {
  id: string;
  url: string;
  caption: string | null;
  credit?: string | null;
  alt?: string | null;
};

type Props = {
  name?: string;
  initialCoverImageId?: string | null;
  initialCredit?: string | null;
  assets: CoverAssetOption[];
  onChange?: (next: { id: string; credit: string }) => void;
};

export function CoverImageField({
  name = "coverImageId",
  initialCoverImageId,
  initialCredit,
  assets,
  onChange,
}: Props) {
  const [selectedId, setSelectedId] = useState(initialCoverImageId ?? "");
  const [library, setLibrary] = useState(assets);
  const [credit, setCredit] = useState(initialCredit ?? "");
  const [alt, setAlt] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function select(id: string, nextCredit?: string) {
    setSelectedId(id);
    const asset = library.find((a) => a.id === id);
    const resolvedCredit = nextCredit ?? asset?.credit ?? credit;
    if (nextCredit != null) setCredit(nextCredit);
    else if (asset?.credit) setCredit(asset.credit);
    onChange?.({ id, credit: resolvedCredit || "" });
  }

  async function onUpload(file: File | null) {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const body = new FormData();
      body.set("file", file);
      body.set("purpose", "cover");
      if (credit.trim()) body.set("credit", credit.trim());
      if (alt.trim()) body.set("alt", alt.trim());
      const res = await fetch("/api/redaccion/upload", { method: "POST", body });
      const data = (await res.json()) as { asset?: CoverAssetOption; error?: string };
      if (!res.ok || !data.asset) {
        throw new Error(data.error || "No se pudo subir la imagen");
      }
      setLibrary((prev) => [data.asset!, ...prev]);
      select(data.asset.id, data.asset.credit || credit);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error de subida");
    } finally {
      setUploading(false);
    }
  }

  const selected = library.find((a) => a.id === selectedId);

  return (
    <div className="space-y-4">
      <input type="hidden" name={name} value={selectedId} />
      <input type="hidden" name="coverCredit" value={credit} />
      <div>
        <label className="text-sm font-semibold text-[var(--is-text)]">Portada</label>
        <p className="mt-1 text-sm text-[var(--is-muted)]">
          Separada del cuerpo · proporción recomendada 16:10 · JPG/PNG/WebP · máx. 5 MB
        </p>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={uploading}
          className="mt-3 block w-full text-sm"
          onChange={(e) => void onUpload(e.target.files?.[0] ?? null)}
        />
        {uploading ? <p className="mt-2 text-sm text-[var(--is-muted)]">Subiendo…</p> : null}
        {error ? <p className="mt-2 text-sm text-red-700">{error}</p> : null}
      </div>

      <div>
        <label className="text-sm font-semibold" htmlFor="cover-alt">
          Alt de portada
        </label>
        <input
          id="cover-alt"
          value={alt}
          onChange={(e) => setAlt(e.target.value)}
          className="mt-2 w-full rounded-[var(--is-radius-sm)] border border-[var(--is-border-strong)] px-3 py-3 text-sm"
          placeholder="Descripción de la portada"
        />
      </div>

      <div>
        <label className="text-sm font-semibold" htmlFor="cover-credit">
          Crédito de portada
        </label>
        <input
          id="cover-credit"
          value={credit}
          onChange={(e) => {
            setCredit(e.target.value);
            onChange?.({ id: selectedId, credit: e.target.value });
          }}
          className="mt-2 w-full rounded-[var(--is-radius-sm)] border border-[var(--is-border-strong)] px-3 py-3 text-sm"
          placeholder="Foto: Nombre / Medio"
        />
      </div>

      {selected ? (
        <div className="overflow-hidden rounded-[var(--is-radius-sm)] border border-[var(--is-border)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={selected.url} alt={alt || ""} className="aspect-[16/10] w-full object-cover" />
          <div className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
            <span className="text-[var(--is-muted)]">Portada seleccionada</span>
            <button
              type="button"
              className="min-h-11 text-[var(--is-accent)]"
              onClick={() => select("")}
            >
              Quitar
            </button>
          </div>
        </div>
      ) : null}

      {library.length > 0 ? (
        <div>
          <p className="mb-2 text-sm font-semibold">Biblioteca reciente</p>
          <div className="grid grid-cols-3 gap-2">
            {library.map((asset) => (
              <button
                key={asset.id}
                type="button"
                onClick={() => select(asset.id)}
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
  );
}
