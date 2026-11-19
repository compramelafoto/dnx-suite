"use client";

import { useState } from "react";
import type { DesignV2Data } from "@/lib/design-v2/design-data";
import type { DesignPhotoPayload, DesignTemplatePayload } from "@/lib/design-v2/client-payload";
import { useDibujarCara } from "./DesignPagesPreview";
import VisorAmpliado from "./VisorAmpliado";

/** «Ver en grande»: abre el diseño a pantalla completa, con zoom y lupa, para revisar cada letra. */
export default function VerEnGrandeBoton({
  template,
  photos,
  data,
  className,
}: {
  template: DesignTemplatePayload;
  photos: DesignPhotoPayload[];
  data: DesignV2Data;
  className?: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const dibujar = useDibujarCara(template, photos, data);
  const ancho = Number(template.canvas.width) || 1;
  const alto = Number(template.canvas.height) || 1;
  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className={
          className ??
          "inline-flex items-center gap-1.5 rounded-lg border border-[#d1d5db] bg-white px-3 py-1.5 text-sm font-medium text-[#111827] hover:bg-[#f9fafb]"
        }
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-4-4M11 8v6M8 11h6" />
        </svg>
        Ver en grande
      </button>
      {abierto ? (
        <VisorAmpliado
          ancho={ancho}
          alto={alto}
          paginas={Math.max(1, template.pageCount)}
          etiqueta={(i) => template.pageLabels[i]?.trim() || `Cara ${i + 1}`}
          dibujar={(page, s) => (
            <div className="relative" style={{ width: ancho * s, height: alto * s }}>
              {dibujar(page, s)}
            </div>
          )}
          onCerrar={() => setAbierto(false)}
        />
      ) : null}
    </>
  );
}
