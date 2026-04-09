"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

function parseBboxNorm(bbox: unknown): { left: string; top: string; width: string; height: string } | null {
  if (!bbox || typeof bbox !== "object") return null;
  const o = bbox as Record<string, unknown>;
  const x = Number(o.x);
  const y = Number(o.y);
  const w = Number(o.width);
  const h = Number(o.height);
  if (![x, y, w, h].every((n) => Number.isFinite(n))) return null;
  const norm = Math.max(x, y, w, h) <= 1.0001;
  if (norm) {
    return {
      left: `${x * 100}%`,
      top: `${y * 100}%`,
      width: `${w * 100}%`,
      height: `${h * 100}%`,
    };
  }
  return null;
}

type ContextResponse = {
  designProject: {
    id: number;
    status: string;
    previewUrl: string | null;
    previewVersion: number;
    previewStatus: string;
    previewDirty: boolean;
    previewError: string | null;
    exportUrlJpg: string | null;
    exportVersion: number;
    exportError: string | null;
  };
  template: { imageUrl: string; widthCm: number; heightCm: number };
  slots: Array<{ id: number; pageIndex: number; index: number; bbox: unknown }>;
  revision: { id: number; dataJson: unknown };
  selectionPhotos: Array<{ photoId: number; previewUrl: string; inUse: boolean }>;
};

export function SchoolDesignReviewClient(props: { albumId: number; designProjectId: number }) {
  const base = `/api/dashboard/albums/${props.albumId}/design-projects/${props.designProjectId}`;
  const [ctx, setCtx] = useState<ContextResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [dragPhotoId, setDragPhotoId] = useState<number | null>(null);

  const load = useCallback(async () => {
    const r = await fetch(`${base}/editor/context`, { cache: "no-store" });
    if (!r.ok) {
      setErr("No se pudo cargar el diseño");
      setLoading(false);
      return;
    }
    const data = await r.json();
    setCtx(data);
    setErr(null);
    setLoading(false);
  }, [base]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!ctx) return;
    if (ctx.designProject.previewStatus !== "RENDERING") return;
    const t = setInterval(() => {
      void fetch(`${base}/preview/status`, { cache: "no-store" })
        .then((r) => r.json())
        .then((st) => {
          if (st.previewStatus !== "RENDERING") void load();
        })
        .catch(() => {});
    }, 4000);
    return () => clearInterval(t);
  }, [base, ctx, load]);

  useEffect(() => {
    if (!ctx) return;
    if (ctx.designProject.status !== "EXPORTING") return;
    const t = setInterval(() => {
      void fetch(`${base}/export/status`, { cache: "no-store" })
        .then((r) => r.json())
        .then((st) => {
          if (st.status !== "EXPORTING") void load();
        })
        .catch(() => {});
    }, 5000);
    return () => clearInterval(t);
  }, [base, ctx, load]);

  const previewSrc = useMemo(() => {
    if (!ctx?.designProject.previewUrl) return null;
    const v = ctx.designProject.previewVersion ?? 0;
    const sep = ctx.designProject.previewUrl.includes("?") ? "&" : "?";
    return `${ctx.designProject.previewUrl}${sep}v=${v}`;
  }, [ctx]);

  const run = async (path: string, init?: RequestInit) => {
    setBusy(true);
    try {
      const r = await fetch(path, { ...init, headers: { "Content-Type": "application/json", ...init?.headers } });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        setErr((j as { error?: string }).error ?? "Error");
      } else {
        await load();
      }
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-[#6b7280]">Cargando…</p>;
  }
  if (err || !ctx) {
    return <p className="text-sm text-red-600">{err ?? "Sin datos"}</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          className="rounded-full px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          style={{ backgroundColor: "#c27b3d" }}
          onClick={() => void run(`${base}/preview/regenerate`, { method: "POST" })}
        >
          Regenerar preview
        </button>
        <button
          type="button"
          disabled={busy || ctx.designProject.previewStatus !== "READY" || ctx.designProject.previewDirty}
          className="rounded-full border border-[#d6d3d1] px-4 py-2 text-sm font-semibold text-[#1a1a1a] disabled:opacity-50"
          onClick={() => void run(`${base}/approve`, { method: "POST" })}
        >
          Aprobar para export
        </button>
        <button
          type="button"
          disabled={busy}
          className="rounded-full border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 disabled:opacity-50"
          onClick={() =>
            void run(`${base}/reject`, {
              method: "POST",
              body: JSON.stringify({ reviewReason: "NEEDS_CHANGES", reviewNote: "" }),
            })
          }
        >
          Pedir ajustes
        </button>
        <button
          type="button"
          disabled={busy || ctx.designProject.status !== "APPROVED_FOR_EXPORT"}
          className="rounded-full border border-[#1a1a1a] px-4 py-2 text-sm font-semibold disabled:opacity-50"
          onClick={() => void run(`${base}/export`, { method: "POST" })}
        >
          Exportar JPG
        </button>
      </div>

      {ctx.designProject.previewError ? (
        <p className="text-sm text-red-600">Preview: {ctx.designProject.previewError}</p>
      ) : null}
      {ctx.designProject.exportError ? (
        <p className="text-sm text-amber-800">Export: {ctx.designProject.exportError}</p>
      ) : null}

      <div className="relative w-full max-w-3xl overflow-hidden rounded-lg border border-[#e7e5e4] bg-[#fafaf9]">
        {previewSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previewSrc} alt="Preview renderizada" className="w-full h-auto block" />
        ) : (
          <div className="relative">
            {/* Fallback HTML/CSS: plantilla base cuando aún no hay previewUrl */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={ctx.template.imageUrl} alt="Plantilla" className="w-full h-auto block opacity-90" />
            {ctx.slots
              .filter((s) => s.pageIndex === 0)
              .map((s) => {
                const box = parseBboxNorm(s.bbox);
                if (!box) return null;
                return (
                  <button
                    type="button"
                    key={s.id}
                    className="absolute border-2 border-dashed border-[#c27b3d]/80 bg-[#c27b3d]/10 hover:bg-[#c27b3d]/20 transition-colors"
                    style={{ left: box.left, top: box.top, width: box.width, height: box.height }}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const raw = e.dataTransfer.getData("text/plain");
                      const pid = parseInt(raw, 10);
                      if (!Number.isInteger(pid)) return;
                      void run(`${base}/editor/replace-photo`, {
                        method: "POST",
                        body: JSON.stringify({ slotId: s.id, photoId: pid }),
                      });
                    }}
                  />
                );
              })}
            <p className="absolute bottom-2 left-2 right-2 rounded bg-black/55 px-2 py-1 text-xs text-white">
              Preview no generada aún; mostrando plantilla base. Usá «Regenerar preview».
            </p>
          </div>
        )}
      </div>

      <div>
        <h3 className="text-sm font-semibold text-[#1a1a1a] mb-2">Fotos disponibles (inUse = ya en un slot)</h3>
        <ul className="flex flex-wrap gap-2">
          {ctx.selectionPhotos.map((p) => (
            <li
              key={p.photoId}
              draggable
              onDragStart={(e) => {
                setDragPhotoId(p.photoId);
                e.dataTransfer.setData("text/plain", String(p.photoId));
                e.dataTransfer.effectAllowed = "copyMove";
              }}
              onDragEnd={() => setDragPhotoId(null)}
              className={`text-xs rounded px-2 py-1 border cursor-grab active:cursor-grabbing ${
                dragPhotoId === p.photoId ? "ring-2 ring-[#c27b3d]" : ""
              } ${p.inUse ? "border-[#c27b3d] text-[#c27b3d]" : "border-[#e7e5e4]"}`}
            >
              #{p.photoId}
              {p.inUse ? " · en uso" : ""}
            </li>
          ))}
        </ul>
        <p className="text-xs text-[#9ca3af] mt-2">
          Arrastrá una foto al recuadro del slot (vista plantilla sin preview). Entre slots: usá la API swap o el panel de diseño avanzado.
        </p>
      </div>

      {ctx.designProject.exportUrlJpg ? (
        <p className="text-sm">
          <span className="font-medium">Export listo:</span>{" "}
          <a
            href={`${ctx.designProject.exportUrlJpg}${ctx.designProject.exportUrlJpg.includes("?") ? "&" : "?"}v=${ctx.designProject.exportVersion}`}
            className="text-[#c27b3d] underline"
            target="_blank"
            rel="noreferrer"
          >
            Descargar JPG
          </a>
        </p>
      ) : null}
    </div>
  );
}
