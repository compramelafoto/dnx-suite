"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";

type PieceSummary = {
  id: string;
  label: string;
  platformLabel: string;
  location: string;
};

type Props = { pieces: PieceSummary[] };

type Viewport = "desktop" | "mobile";

/**
 * Estudio de propuesta: a la izquierda se carga, a la derecha se ve.
 *
 * Cada pieza se pide al servidor cuando hace falta y se guarda en memoria, así
 * cambiar de pieza o de vista no vuelve a componer lo mismo.
 */
export function ProposalStudio({ pieces }: Props) {
  const [logo, setLogo] = useState<File | null>(null);
  const [brandName, setBrandName] = useState("");
  const [industry, setIndustry] = useState("");
  const [viewport, setViewport] = useState<Viewport>("desktop");
  const [activePiece, setActivePiece] = useState(pieces[0]?.id ?? "");
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const urlsRef = useRef<string[]>([]);
  const fieldId = useId();

  // Liberar las URLs temporales al desmontar, para no perder memoria.
  useEffect(() => {
    const urls = urlsRef.current;
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, []);

  // Cambiar de logo invalida todo lo compuesto antes: si no, se ven mockups
  // del logo viejo mezclados con el nuevo.
  useEffect(() => {
    urlsRef.current.forEach((u) => URL.revokeObjectURL(u));
    urlsRef.current = [];
    setPreviews({});
    setError(null);
  }, [logo]);

  const cacheKey = `${activePiece}:${viewport}`;

  const fetchPiece = useCallback(async () => {
    if (!logo || !activePiece) return;
    if (previews[cacheKey]) return;

    setLoading(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("logo", logo);
      form.set("pieceId", activePiece);
      form.set("brandName", brandName);
      form.set("viewport", viewport);

      const res = await fetch("/api/propuesta/pieza", { method: "POST", body: form });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "No se pudo generar la vista previa.");
      }
      const url = URL.createObjectURL(await res.blob());
      urlsRef.current.push(url);
      setPreviews((prev) => ({ ...prev, [cacheKey]: url }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Algo salió mal.");
    } finally {
      setLoading(false);
    }
  }, [logo, activePiece, viewport, brandName, cacheKey, previews]);

  useEffect(() => {
    void fetchPiece();
  }, [fetchPiece]);

  const preview = previews[cacheKey];
  const piece = pieces.find((p) => p.id === activePiece);

  return (
    <div className="mt-10 grid gap-8 lg:grid-cols-[340px_1fr]">
      {/* ---- columna de carga ---- */}
      <div className="flex flex-col gap-5">
        <Field
          id={`${fieldId}-logo`}
          label="Logo del cliente"
          hint="PNG, JPG, WEBP o SVG. Hasta 5 MB."
        >
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            onChange={(e) => setLogo(e.target.files?.[0] ?? null)}
            className="ck-body-sm w-full"
          />
        </Field>

        <Field id={`${fieldId}-marca`} label="Nombre de la marca" required>
          <Input
            type="text"
            value={brandName}
            onChange={(e) => setBrandName(e.target.value)}
          />
        </Field>

        <Field id={`${fieldId}-rubro`} label="Rubro">
          <Input
            type="text"
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
            placeholder="Gastronomía, indumentaria…"
          />
        </Field>

        <div className="flex flex-col gap-2">
          <span className="ck-label">Pieza</span>
          <ul className="flex flex-col gap-1">
            {pieces.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => setActivePiece(p.id)}
                  aria-pressed={p.id === activePiece}
                  className={
                    p.id === activePiece
                      ? "w-full rounded bg-ck-surface-strong px-3 py-2 text-left ck-body-sm"
                      : "w-full rounded px-3 py-2 text-left ck-body-sm text-ck-text-muted"
                  }
                >
                  {p.label} · {p.platformLabel}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* ---- columna de vista previa ---- */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="ck-label">Vista previa</span>
          <div className="ml-auto flex gap-1">
            {(["desktop", "mobile"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setViewport(v)}
                aria-pressed={v === viewport}
                className={
                  v === viewport
                    ? "rounded bg-ck-surface-strong px-3 py-1 ck-body-sm"
                    : "rounded px-3 py-1 ck-body-sm text-ck-text-muted"
                }
              >
                {v === "desktop" ? "Escritorio" : "Celular"}
              </button>
            ))}
          </div>
        </div>

        <div className="flex min-h-[320px] items-center justify-center rounded border border-ck-border bg-ck-surface-base/40 p-4">
          {!logo ? (
            <p className="ck-body-sm text-ck-text-muted">
              Subí un logo para ver la vista previa.
            </p>
          ) : error ? (
            <p className="ck-body-sm text-ck-text-muted">{error}</p>
          ) : loading && !preview ? (
            <p className="ck-body-sm text-ck-text-muted">Generando…</p>
          ) : preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={preview}
              alt={`Vista previa: ${piece?.label} en ${piece?.platformLabel}`}
              className="max-h-[560px] w-auto max-w-full object-contain"
            />
          ) : null}
        </div>

        {piece ? (
          <p className="ck-body-sm text-ck-text-secondary">
            <strong>{piece.label} · {piece.platformLabel}.</strong> {piece.location}
          </p>
        ) : null}
      </div>
    </div>
  );
}
