"use client";

import { useState } from "react";
import type { PreviewCandidate } from "@/lib/social/album-stories";

const MOTIVOS: Record<string, string> = {
  NOT_PUBLIC: "no es público",
  HIDDEN: "está oculto",
  SELFIE_PROTECTED: "protegido por selfie",
  TEST_ALBUM: "es de prueba",
  SCHOOL_ALBUM: "es escolar",
  NO_CONSENT: "el fotógrafo desactivó la difusión",
  TOO_FEW_PHOTOS: "tiene 50 fotos o menos",
  DELETED: "está borrado",
};

const MODELOS = 20;

/**
 * Vista previa: elegís un álbum reciente y ves cómo saldría su historia, modelo por
 * modelo. No guarda ni publica nada, y funciona sin la cuenta de Instagram conectada.
 */
export default function StoryPreviewSection({ candidates }: { candidates: PreviewCandidate[] }) {
  const [albumId, setAlbumId] = useState<number | null>(candidates.find((c) => c.eligible)?.albumId ?? null);
  const [modelo, setModelo] = useState(0);
  const [historia, setHistoria] = useState(1);
  const [cargando, setCargando] = useState(false);
  const [fallo, setFallo] = useState(false);

  const elegir = (id: number) => {
    setAlbumId(id);
    setCargando(true);
    setFallo(false);
  };
  const cambiarModelo = (delta: number) => {
    setModelo((m) => (m + delta + MODELOS) % MODELOS);
    setCargando(true);
    setFallo(false);
  };
  const verHistoria = (n: number) => {
    setHistoria(n);
    setCargando(true);
    setFallo(false);
  };
  const src = albumId
    ? `/api/admin/social/stories/preview?albumId=${albumId}&modelo=${modelo}&historia=${historia}`
    : null;

  return (
    <section className="space-y-3 rounded-lg border border-gray-200 bg-white p-4">
      <div>
        <h2 className="m-0 text-base font-semibold text-gray-900">Vista previa</h2>
        <p className="m-0 mt-1 text-sm text-gray-600">
          Elegí un álbum de los últimos 7 días y mirá cómo saldrían sus 3 historias (una por día, con fotos
          distintas). No se guarda ni se publica nada.
        </p>
      </div>
      {candidates.length === 0 ? (
        <p className="m-0 text-sm text-gray-600">No hay álbumes públicos de más de 50 fotos en los últimos 7 días.</p>
      ) : (
        <div className="flex flex-col gap-4 md:flex-row">
          <ul className="m-0 max-h-[560px] flex-1 list-none space-y-1 overflow-y-auto p-0">
            {candidates.map((c) => (
              <li key={c.albumId}>
                <button
                  type="button"
                  onClick={() => elegir(c.albumId)}
                  className={`w-full rounded-md border px-3 py-2 text-left text-sm ${
                    c.albumId === albumId ? "border-[#c27b3d] bg-[#fdf6ef]" : "border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  <span className="block font-medium text-gray-900">{c.title}</span>
                  <span className="block text-xs text-gray-500">
                    {c.photoCount} fotos · {c.photographer || "sin Instagram"} ·{" "}
                    {c.eligible ? (
                      <span className="text-emerald-700">entraría</span>
                    ) : (
                      <span className="text-amber-700">no entraría: {MOTIVOS[c.reason ?? ""] ?? c.reason}</span>
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <div className="flex w-full flex-col items-center gap-2 md:w-[300px]">
            <div className="relative aspect-[9/16] w-full max-w-[300px] overflow-hidden rounded-lg bg-gray-100">
              {src ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={src}
                  src={src}
                  alt="Vista previa de la historia"
                  className="h-full w-full object-cover"
                  onLoad={() => setCargando(false)}
                  onError={() => {
                    setCargando(false);
                    setFallo(true);
                  }}
                />
              ) : null}
              {cargando ? (
                <div className="absolute inset-0 flex items-center justify-center bg-white/70 text-sm text-gray-700">
                  Armando…
                </div>
              ) : null}
              {fallo ? (
                <div className="absolute inset-0 flex items-center justify-center p-4 text-center text-sm text-red-700">
                  No se pudo armar la vista previa de este álbum.
                </div>
              ) : null}
            </div>
            <div className="flex items-center gap-1">
              {[1, 2, 3].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => verHistoria(n)}
                  disabled={!src}
                  className={`rounded border px-2 py-1 text-xs disabled:opacity-50 ${
                    historia === n ? "border-[#c27b3d] bg-[#fdf6ef] font-medium" : "border-gray-300"
                  }`}
                >
                  Día {n}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => cambiarModelo(-1)}
                disabled={!src}
                className="rounded border border-gray-300 px-2 py-1 text-sm disabled:opacity-50"
              >
                ← Modelo anterior
              </button>
              <span className="text-xs text-gray-600">
                {modelo + 1} de {MODELOS}
              </span>
              <button
                type="button"
                onClick={() => cambiarModelo(1)}
                disabled={!src}
                className="rounded border border-gray-300 px-2 py-1 text-sm disabled:opacity-50"
              >
                Siguiente →
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
