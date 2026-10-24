"use client";

import { useMemo, useState } from "react";
import { huecosSinFondo } from "@repo/template-editor-core";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import type { DesignPhotoPayload, DesignTemplatePayload } from "@/lib/design-v2/client-payload";
import type { DesignV2Data } from "@/lib/design-v2/design-data";

type Recorte = { photoId: number; status: string; url: string | null; error: string | null };

/**
 * «Fotos sin fondo»: los huecos de la plantilla marcados «Quitar el fondo». El fotógrafo ve cada
 * recorte antes de aprobar y puede descartarlo (sale la foto entera) o volver a usarlo.
 */
export default function RecortesPanel({
  designId,
  template,
  data,
  photos,
  activo,
  onRecortes,
}: {
  designId: string;
  template: DesignTemplatePayload;
  data: DesignV2Data;
  photos: DesignPhotoPayload[];
  /** ¿Está configurado el servicio que quita los fondos? */
  activo: boolean;
  onRecortes: (recortes: Recorte[]) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fotos = useMemo(() => {
    const huecos = huecosSinFondo(template.blocks);
    const ids = [...huecos].flatMap((b) => (data.slots[b]?.photoId != null ? [data.slots[b]!.photoId!] : []));
    return [...new Set(ids)].map((id) => photos.find((p) => p.id === id) ?? { id, url: null });
  }, [template.blocks, data.slots, photos]);

  if (fotos.length === 0) return null;

  async function pedir(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/fotografo/disenos/${designId}/recortes`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.ok) throw new Error(j.error || "No se pudo.");
      onRecortes(j.recortes as Recorte[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo.");
    } finally {
      setBusy(false);
    }
  }

  const faltan = fotos.some((f) => !f.cutout || f.cutout.status === "PENDING");
  const fallaron = fotos.some((f) => f.cutout?.status === "FAILED");

  return (
    <Card className="mt-4 p-4">
      <p className="text-sm font-semibold text-[#111827]">Fotos sin fondo</p>
      <p className="mt-1 text-xs text-[#6b7280]">
        La plantilla pide la foto del alumno recortada, sin fondo. Mirá que el recorte haya quedado bien (sobre todo el
        pelo); si no te gusta, descartalo y se imprime la foto entera. Descartar vale para esa foto en todos los diseños
        que la usen.
      </p>
      {!activo ? (
        <p className="mt-2 text-xs text-amber-800">
          El servicio para quitar fondos todavía no está configurado: por ahora se imprime la foto entera.
        </p>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-4">
        {fotos.map((f) => {
          const c = f.cutout;
          return (
            <div key={f.id} className="w-40 text-xs">
              <div
                className="flex h-48 items-center justify-center overflow-hidden rounded-lg border border-[#e5e7eb]"
                // Damero, para que se note la transparencia.
                style={{ background: "repeating-conic-gradient(#f3f4f6 0% 25%, #ffffff 0% 50%) 50% / 16px 16px" }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {c?.url ? <img src={c.url} alt="" className="max-h-full max-w-full object-contain" /> : f.url ? <img src={f.url} alt="" className="max-h-full max-w-full object-contain opacity-60" /> : null}
              </div>
              <p className="mt-1 text-[#374151]">
                {!c || c.status === "PENDING"
                  ? "Sin recortar todavía"
                  : c.status === "READY"
                    ? "Recorte listo"
                    : c.status === "DISCARDED"
                      ? "Descartado: va la foto entera"
                      : `No se pudo recortar${c.error ? `: ${c.error}` : ""}`}
              </p>
              {c?.status === "READY" ? (
                <button type="button" className="mt-1 text-[#c27b3d] underline" disabled={busy} onClick={() => void pedir({ accion: "descartar", photoId: f.id })}>
                  Usar la foto entera
                </button>
              ) : c?.status === "DISCARDED" ? (
                <button type="button" className="mt-1 text-[#c27b3d] underline" disabled={busy} onClick={() => void pedir({ accion: "usar", photoId: f.id })}>
                  Volver al recorte
                </button>
              ) : null}
            </div>
          );
        })}
      </div>
      {activo && fallaron ? (
        <div className="mt-3">
          <Button size="sm" variant="secondary" onClick={() => void pedir({ accion: "reintentar" })} disabled={busy}>
            {busy ? "Recortando…" : "Volver a intentar los que fallaron"}
          </Button>
          <p className="mt-1 text-[11px] text-[#9ca3af]">Cada intento se cobra como una foto nueva.</p>
        </div>
      ) : null}
      {activo && faltan ? (
        <div className="mt-3">
          <Button size="sm" variant="secondary" onClick={() => void pedir({ accion: "generar" })} disabled={busy}>
            {busy ? "Recortando…" : "Quitar el fondo ahora"}
          </Button>
          <p className="mt-1 text-[11px] text-[#9ca3af]">Si no lo hacés, se recorta solo al aprobar.</p>
        </div>
      ) : null}
      {error ? <p className="mt-2 text-xs text-red-700">{error}</p> : null}
    </Card>
  );
}
