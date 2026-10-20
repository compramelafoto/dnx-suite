"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { PAPER_TOKENS, TemplateCanvasRenderer, editorThemeStyle } from "@repo/template-editor-ui";
import type { DesignV2Data } from "@/lib/design-v2/design-data";
import { designPhotoOverrides, visibleDesignBlocks } from "@/lib/design-v2/render-inputs";
import type { DesignPhotoPayload, DesignTemplatePayload } from "@/lib/design-v2/client-payload";

/**
 * Todas las caras de un diseño, de sólo lectura, lo más grandes que entren en la caja. Usa el
 * mismo dibujo que el editor y la exportación (`TemplateCanvasRenderer` + las fotos encuadradas),
 * así lo que se aprueba acá es lo que se imprime. Los huecos sin foto se marcan en rojo.
 */

const GAP = 12;

/** Cuántas columnas dejan las caras más grandes dentro de la caja. */
export function mejorGrilla(
  paginas: number,
  caja: { width: number; height: number },
  lienzo: { width: number; height: number },
): { columnas: number; escala: number } {
  let mejor = { columnas: 1, escala: 0 };
  for (let columnas = 1; columnas <= Math.max(1, paginas); columnas++) {
    const filas = Math.ceil(paginas / columnas);
    const escala = Math.min(
      (caja.width - (columnas - 1) * GAP) / (columnas * lienzo.width),
      (caja.height - (filas - 1) * GAP) / (filas * lienzo.height),
    );
    if (escala > mejor.escala) mejor = { columnas, escala };
  }
  return { columnas: mejor.columnas, escala: Math.max(0, Math.min(1, mejor.escala)) };
}

export default function DesignPagesPreview({
  template,
  photos,
  data,
}: {
  template: DesignTemplatePayload;
  photos: DesignPhotoPayload[];
  data: DesignV2Data;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [caja, setCaja] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setCaja({ width: el.clientWidth, height: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const canvasW = Number(template.canvas.width) || 1;
  const canvasH = Number(template.canvas.height) || 1;
  const paginas = Math.max(1, template.pageCount);
  const photoUrlById = useMemo(() => new Map(photos.map((p) => [p.id, p.url])), [photos]);
  const visibles = useMemo(() => visibleDesignBlocks(template.blocks, data.values), [template.blocks, data.values]);
  const overrides = useMemo(() => designPhotoOverrides(data.slots, photoUrlById), [data.slots, photoUrlById]);
  const bloquePorId = useMemo(() => new Map(template.blocks.map((b) => [b.id, b])), [template.blocks]);
  const { columnas, escala } = mejorGrilla(paginas, caja, { width: canvasW, height: canvasH });
  const etiqueta = (i: number) => template.pageLabels[i]?.trim() || `Cara ${i + 1}`;

  return (
    <div ref={ref} className="h-full w-full min-h-0 overflow-hidden">
      {escala > 0 ? (
        <div
          className="mx-auto grid h-full content-center justify-center"
          style={{ gridTemplateColumns: `repeat(${columnas}, ${canvasW * escala}px)`, gap: GAP }}
        >
          {Array.from({ length: paginas }, (_, page) => (
            <div
              key={page}
              className="relative overflow-hidden bg-white shadow-sm ring-1 ring-[#e5e7eb]"
              style={{ width: canvasW * escala, height: canvasH * escala }}
              aria-label={etiqueta(page)}
            >
              <div
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
                  blocks={visibles}
                  resolvedVariables={data.values}
                  readOnly
                  pageIndex={page}
                  photoOverrides={overrides}
                />
                {template.slots
                  .filter((s) => s.pageIndex === page && data.slots[s.blockId]?.photoId == null)
                  .map((s) => {
                    const b = bloquePorId.get(s.blockId);
                    if (!b) return null;
                    const linea = Math.max(2, 3 / Math.max(escala, 0.05));
                    return (
                      <div
                        key={s.blockId}
                        style={{
                          position: "absolute",
                          left: b.layout.x,
                          top: b.layout.y,
                          width: b.layout.width,
                          height: b.layout.height,
                          transform: `rotate(${b.layout.rotation ?? 0}deg)`,
                          zIndex: 10_000,
                          outline: `${linea}px dashed #dc2626`,
                          outlineOffset: -linea,
                          background: "rgba(220,38,38,0.08)",
                        }}
                      />
                    );
                  })}
              </div>
              {paginas > 1 ? (
                <span className="absolute bottom-1 left-1 rounded bg-black/55 px-1.5 py-0.5 text-[10px] font-medium text-white">
                  {etiqueta(page)}
                </span>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
