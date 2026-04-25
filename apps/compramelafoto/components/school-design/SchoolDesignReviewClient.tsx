"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { SlotTransform } from "@/lib/school-design/types";
import { SchoolDesignVisualEditor } from "./SchoolDesignVisualEditor";

type EditorBundle = {
  assignments: Record<string, { slotId: number; pageIndex: number; photoId: number }>;
  slotTransforms: Record<string, SlotTransform>;
  textOverrides: Record<string, string>;
  textFieldIds: string[];
};

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
  template: {
    imageUrl: string;
    widthCm: number;
    heightCm: number;
    textElementsJson?: unknown;
  };
  slots: Array<{ id: number; pageIndex: number; index: number; bbox: unknown; role: string | null }>;
  revision: { id: number; dataJson: unknown };
  selectionPhotos: Array<{ photoId: number; previewUrl: string; inUse: boolean; position: number | null }>;
  editor: EditorBundle;
};

export function SchoolDesignReviewClient(props: { albumId: number; designProjectId: number }) {
  const base = `/api/dashboard/albums/${props.albumId}/design-projects/${props.designProjectId}`;
  const [ctx, setCtx] = useState<ContextResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch(`${base}/editor/context`, { cache: "no-store" });
    if (!r.ok) {
      setErr("No se pudo cargar el diseño");
      setLoading(false);
      return;
    }
    const data = (await r.json()) as ContextResponse;
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
    <div className="space-y-8">
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

      <SchoolDesignVisualEditor
        albumId={props.albumId}
        designProjectId={props.designProjectId}
        ctx={ctx}
        previewSrc={previewSrc}
        load={load}
        run={run}
        busy={busy}
      />

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
