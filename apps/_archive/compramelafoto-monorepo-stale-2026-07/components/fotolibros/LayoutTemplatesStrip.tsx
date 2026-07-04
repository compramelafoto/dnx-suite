"use client";

import { memo, useMemo, useRef, useEffect } from "react";
import type { LayoutTemplate } from "./layoutTemplates";
import LAYOUT_TEMPLATES, { scoreTemplateMatch } from "./layoutTemplates";
import type { Orientation } from "./useImageOrientations";

type LayoutTemplatesStripProps = {
  selectedIndex: number;
  onSelectTemplate: (index: number) => void;
  /** "strip" = una fila horizontal; "grid" = varias filas (ej. 3 filas tipo Smart Albums). */
  variant?: "strip" | "grid";
  /** Si se define, solo se muestran plantillas con esta cantidad de slots (ej. 4 fotos → solo plantillas de 4). */
  slotCountFilter?: number | null;
  /** Si se pasan, se ordenan las plantillas priorizando las que mejor encajan con estas orientaciones. */
  orientationsForSort?: Orientation[] | null;
};

/** Mini preview de un layout (rectángulos gris claro en fondo blanco). */
function TemplateThumbnail({
  template,
  isSelected,
  onClick,
}: {
  template: LayoutTemplate;
  isSelected: boolean;
  onClick: () => void;
}) {
  const size = 56;
  const padding = 4;
  const inner = size - padding * 2;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-lg border-2 p-1 transition-colors ${
        isSelected ? "border-[#c27b3d] bg-[#fff7ee]" : "border-[#e5e7eb] bg-white hover:border-[#d1d5db]"
      }`}
      title={template.name}
      style={{ width: size + 8, height: size + 24 }}
    >
      <div className="mx-auto flex h-[52px] w-[52px] items-center justify-center rounded bg-[#f9fafb]">
        <svg width={inner} height={inner} viewBox="0 0 100 100" className="overflow-visible">
          {template.slots.map((slot, i) => (
            <rect
              key={i}
              x={slot.nx * 100 + 1}
              y={slot.ny * 100 + 1}
              width={Math.max(2, slot.nw * 100 - 2)}
              height={Math.max(2, slot.nh * 100 - 2)}
              fill="#e5e7eb"
              rx={2}
            />
          ))}
        </svg>
      </div>
      <div className="mt-0.5 truncate text-[10px] text-[#6b7280]">{template.name}</div>
    </button>
  );
}

function LayoutTemplatesStrip({ selectedIndex, onSelectTemplate, variant = "strip", slotCountFilter = null, orientationsForSort = null }: LayoutTemplatesStripProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const filteredTemplates = useMemo(() => {
    let list = slotCountFilter != null
      ? LAYOUT_TEMPLATES.filter((t) => t.slots.length === slotCountFilter)
      : LAYOUT_TEMPLATES;
    if (
      orientationsForSort &&
      orientationsForSort.length > 0 &&
      slotCountFilter != null &&
      orientationsForSort.length === slotCountFilter
    ) {
      list = [...list].sort(
        (a, b) => scoreTemplateMatch(b, orientationsForSort) - scoreTemplateMatch(a, orientationsForSort)
      );
    }
    return list;
  }, [slotCountFilter, orientationsForSort?.join(",") ?? ""]);

  useEffect(() => {
    if (variant !== "strip") return;
    const el = scrollRef.current;
    if (!el) return;
    const child = el.children[selectedIndex] as HTMLElement | undefined;
    if (child) child.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  }, [selectedIndex, variant]);

  if (variant === "grid") {
    return (
      <div className="flex flex-col gap-1">
        <p className="text-xs font-medium text-[#1a1a1a]">Diseño de página (3 filas)</p>
        <p className="text-[10px] text-[#6b7280]">
          {slotCountFilter != null ? `Plantillas de ${slotCountFilter} foto${slotCountFilter !== 1 ? "s" : ""}. ` : ""}
          Elegí una plantilla. Flechas ↑ ↓ para cambiar.
        </p>
        <div className="grid grid-cols-4 sm:grid-cols-5 gap-2 pb-1" style={{ gridAutoRows: "minmax(72px, auto)" }}>
          {filteredTemplates.map((template) => {
            const originalIndex = LAYOUT_TEMPLATES.indexOf(template);
            return (
              <div key={template.id} className="flex justify-center">
                <TemplateThumbnail
                  template={template}
                  isSelected={originalIndex === selectedIndex}
                  onClick={() => onSelectTemplate(originalIndex)}
                />
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs font-medium text-[#1a1a1a]">Diseño de página</p>
      <p className="text-[10px] text-[#6b7280]">
        {slotCountFilter != null ? `Plantillas de ${slotCountFilter} foto${slotCountFilter !== 1 ? "s" : ""}. ` : ""}
        Elegí una plantilla. Flechas ↑ ↓ para cambiar.
      </p>
      <div
        ref={scrollRef}
        className="flex gap-2 overflow-x-auto pb-1"
        style={{ scrollSnapType: "x proximity" }}
      >
        {filteredTemplates.map((template) => {
          const originalIndex = LAYOUT_TEMPLATES.indexOf(template);
          return (
            <div key={template.id} style={{ scrollSnapAlign: "start" }}>
              <TemplateThumbnail
                template={template}
                isSelected={originalIndex === selectedIndex}
                onClick={() => onSelectTemplate(originalIndex)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default memo(LayoutTemplatesStrip);
export { LAYOUT_TEMPLATES };
