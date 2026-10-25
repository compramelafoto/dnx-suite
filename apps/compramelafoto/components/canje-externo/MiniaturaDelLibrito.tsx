"use client";

import { useMemo } from "react";
import { PAPER_TOKENS, TemplateCanvasRenderer, editorThemeStyle, type PhotoOverride } from "@repo/template-editor-ui";
import type { DesignTemplatePayload } from "@/lib/design-v2/client-payload";
import { placesForUnit } from "@/lib/preventa-canjeable/preventa-canje-slots";

/**
 * Miniatura del librito mientras la familia elige fotos: el diseño real, achicado, con cada
 * lugar de foto marcado donde va a estar impreso. Las fotos elegidas ya aparecen en su lugar,
 * el lugar que toca elegir ahora se resalta y tocar un lugar vacío lo elige primero.
 *
 * Reemplaza a los recuadros genéricos («Foto individual», «Foto grupal»), que no decían dónde
 * iba cada foto ni cómo iba a quedar.
 */
type Props = {
  template: DesignTemplatePayload;
  /** Los lugares del canje que corresponden a este librito (todas sus unidades). */
  slotIndexes: number[];
  units: number;
  photosPerUnit: number;
  labels: string[];
  filled: Array<number | null>;
  /** Lugar que toca elegir ahora (resaltado). */
  activePlace: number | null;
  thumbUrl: (photoId: number) => string;
  onPickEmpty?: (place: number) => void;
  onRemove?: (photoId: number) => void;
  /** Alto de cada página en la pantalla, en píxeles. */
  alto: number;
  values: Record<string, string>;
};

type Lugar = {
  blockId: string;
  place: number;
  pageIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
};

export default function MiniaturaDelLibrito({
  template,
  slotIndexes,
  units,
  photosPerUnit,
  labels,
  filled,
  activePlace,
  thumbUrl,
  onPickEmpty,
  onRemove,
  alto,
  values,
}: Props) {
  const canvasW = Number(template.canvas.width) || 1;
  const canvasH = Number(template.canvas.height) || 1;
  const escala = alto / canvasH;

  // Una miniatura por unidad (dos libritos = dos miniaturas), con las páginas que llevan fotos.
  const unidades = useMemo(() => {
    const porId = new Map(template.blocks.map((b) => [b.id, b]));
    return Array.from({ length: Math.max(1, units) }, (_, u) => {
      const lugares: Lugar[] = [];
      for (const [blockId, place] of placesForUnit(template.slots, slotIndexes, u, photosPerUnit)) {
        const b = porId.get(blockId);
        if (!b) continue;
        lugares.push({
          blockId,
          place,
          pageIndex: b.pageIndex ?? 0,
          x: b.layout.x,
          y: b.layout.y,
          width: b.layout.width,
          height: b.layout.height,
          rotation: b.layout.rotation ?? 0,
        });
      }
      const paginas = [...new Set(lugares.map((l) => l.pageIndex))].sort((a, b) => a - b);
      const overrides: Record<string, PhotoOverride> = {};
      for (const l of lugares) {
        const id = filled[l.place];
        if (id != null) overrides[l.blockId] = { src: thumbUrl(id) };
      }
      return { lugares, paginas, overrides };
    });
  }, [template, slotIndexes, units, photosPerUnit, filled, thumbUrl]);

  return (
    <div className="flex flex-wrap justify-center gap-3">
      {unidades.map((unidad, u) =>
        unidad.paginas.map((pageIndex) => (
          <figure key={`${u}-${pageIndex}`} className="m-0">
            <div
              className="relative overflow-hidden bg-white shadow-[0_1px_4px_rgba(60,40,20,0.22)] ring-1 ring-[#e7e1da]"
              style={{ width: canvasW * escala, height: alto }}
            >
              <div
                aria-hidden
                style={{
                  ...editorThemeStyle(),
                  ...PAPER_TOKENS,
                  position: "absolute",
                  left: 0,
                  top: 0,
                  width: canvasW,
                  height: canvasH,
                  transform: `scale(${escala})`,
                  transformOrigin: "top left",
                  pointerEvents: "none",
                }}
              >
                <TemplateCanvasRenderer
                  canvas={template.canvas}
                  blocks={template.blocks}
                  resolvedVariables={values}
                  readOnly
                  pageIndex={pageIndex}
                  photoOverrides={unidad.overrides}
                />
              </div>
              {unidad.lugares
                .filter((l) => l.pageIndex === pageIndex)
                .map((l) => {
                  const id = filled[l.place];
                  const activo = id == null && l.place === activePlace;
                  const label = labels[l.place] ?? "Foto";
                  const caja = {
                    left: l.x * escala,
                    top: l.y * escala,
                    width: l.width * escala,
                    height: l.height * escala,
                    transform: l.rotation ? `rotate(${l.rotation}deg)` : undefined,
                  };
                  if (id != null) {
                    return onRemove ? (
                      <button
                        key={l.blockId}
                        type="button"
                        onClick={() => onRemove(id)}
                        className="group absolute ring-2 ring-[#2f7d5b] ring-offset-0"
                        style={caja}
                        aria-label={`Quitar la foto de ${label}`}
                        title={`${label}: tocá para quitarla`}
                      >
                        <span className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-[#1f2328] text-[11px] font-bold leading-none text-white shadow">
                          ×
                        </span>
                      </button>
                    ) : null;
                  }
                  return (
                    <button
                      key={l.blockId}
                      type="button"
                      disabled={!onPickEmpty}
                      onClick={() => onPickEmpty?.(l.place)}
                      className={`absolute grid place-items-center border-2 border-dashed text-center font-semibold leading-tight transition-colors ${
                        // Opacos: debajo está el aviso de "imagen" del lienzo, que no tiene que verse.
                        activo
                          ? "border-[#c27b3d] bg-[#f6e2cf] text-[#8a4f1e] shadow-[0_0_0_3px_rgba(194,123,61,0.35)]"
                          : "border-[#9c8f80] bg-[#f4efe9] text-[#6b6f76] hover:border-[#c27b3d]"
                      }`}
                      style={{ ...caja, fontSize: Math.max(9, Math.min(13, Math.min(caja.width, caja.height) / 5)) }}
                      aria-label={activo ? `Ahora elegí: ${label}` : `Elegir ${label}`}
                    >
                      <span className="px-0.5" style={{ transform: l.rotation ? `rotate(${-l.rotation}deg)` : undefined }}>
                        {label}
                      </span>
                    </button>
                  );
                })}
            </div>
            {template.pageLabels[pageIndex] && unidad.paginas.length > 1 ? (
              <figcaption className="mt-1 text-center text-[11px] text-[#6b6f76]">
                {template.pageLabels[pageIndex]}
              </figcaption>
            ) : null}
          </figure>
        )),
      )}
    </div>
  );
}
