"use client";

import { useEffect, useState } from "react";
import Card from "@/components/ui/Card";
import type { AlbumPhotoUploadPhase } from "@/lib/albums/run-album-photo-upload-queue";

const PHASE_LABEL: Record<AlbumPhotoUploadPhase, string> = {
  init: "Preparando envío…",
  storage: "Subiendo archivo…",
  process: "Procesando en el servidor…",
};

function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  if (m < 60) return rem > 0 ? `${m} min ${rem}s` : `${m} min`;
  const h = Math.floor(m / 60);
  const min = m % 60;
  return min > 0 ? `${h} h ${min} min` : `${h} h`;
}

export type AlbumPhotoBulkUploadPanelProps = {
  uploadTotal: number;
  uploadProcessed: number;
  uploadSucceeded: number;
  uploadFailed: number;
  progressRatio: number;
  uploadCurrentFile: string | null;
  uploadPhase: AlbumPhotoUploadPhase | null;
  activeUploads: number;
  startedAt: number | null;
};

export default function AlbumPhotoBulkUploadPanel({
  uploadTotal,
  uploadProcessed,
  uploadSucceeded,
  uploadFailed,
  progressRatio,
  uploadCurrentFile,
  uploadPhase,
  activeUploads,
  startedAt,
}: AlbumPhotoBulkUploadPanelProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  if (uploadTotal <= 0) return null;

  const percent = Math.min(100, Math.round(progressRatio * 100));
  const elapsedSec = startedAt != null ? (now - startedAt) / 1000 : 0;
  const rate = uploadProcessed > 0 && elapsedSec > 0 ? uploadProcessed / elapsedSec : 0;
  const remaining = uploadTotal - uploadProcessed;
  const etaSec = rate > 0 ? remaining / rate : null;

  return (
    <Card className="border-2 border-[#c27b3d]/40 bg-[#fef7f3] shadow-md sticky top-20 z-20">
      <div className="p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <p className="text-base font-semibold text-[#1a1a1a] m-0">
              Subiendo fotos al álbum
            </p>
            <p className="text-sm text-[#374151] m-0">
              {uploadProcessed.toLocaleString("es-AR")} de {uploadTotal.toLocaleString("es-AR")}{" "}
              procesadas
              {uploadSucceeded > 0
                ? ` · ${uploadSucceeded.toLocaleString("es-AR")} subidas OK`
                : ""}
              {uploadFailed > 0
                ? ` · ${uploadFailed.toLocaleString("es-AR")} con error`
                : ""}
            </p>
          </div>
          <div className="text-right shrink-0 space-y-0.5">
            <p className="text-2xl font-bold text-[#c27b3d] m-0 tabular-nums">{percent}%</p>
            <p className="text-xs text-[#6b7280] m-0 tabular-nums">
              {activeUploads > 1 ? `${activeUploads} en paralelo · ` : ""}
              {formatDuration(elapsedSec)} transcurridos
            </p>
          </div>
        </div>

        <div className="h-7 w-full rounded-full bg-[#e5e7eb] overflow-hidden shadow-inner relative">
          <div
            className="h-full rounded-full transition-[width] duration-700 ease-out relative"
            style={{
              width: `${percent}%`,
              backgroundColor: "#c27b3d",
            }}
          >
            <div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/35 to-transparent"
              style={{
                animation: "shimmer 1.4s infinite",
                backgroundSize: "200% 100%",
              }}
            />
          </div>
          {percent < 100 && uploadProcessed < uploadTotal ? (
            <div
              className="absolute inset-y-0 w-1/4 rounded-full bg-white/25"
              style={{ animation: "shimmer 2s infinite", left: `${Math.min(75, percent)}%` }}
            />
          ) : null}
        </div>

        <div className="rounded-lg border border-[#fcd9c4] bg-white/80 px-3 py-3 space-y-2">
          <p className="text-sm font-medium text-[#9a3412] m-0">
            No cierres ni recargues esta pestaña hasta que termine la subida.
          </p>
          <p className="text-xs text-[#6b7280] m-0">
            La subida sigue en segundo plano aunque la barra tarde unos segundos en cada foto.
            {etaSec != null && uploadProcessed > 2
              ? ` Tiempo estimado restante: ~${formatDuration(etaSec)}.`
              : uploadProcessed === 0
                ? " La primera foto suele tardar más (procesamiento en el servidor)."
                : ""}
          </p>
          {uploadCurrentFile ? (
            <p className="text-xs text-[#374151] m-0 truncate" title={uploadCurrentFile}>
              <span className="font-medium">
                {uploadPhase ? PHASE_LABEL[uploadPhase] : "Enviando:"}
              </span>{" "}
              {uploadCurrentFile}
            </p>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
