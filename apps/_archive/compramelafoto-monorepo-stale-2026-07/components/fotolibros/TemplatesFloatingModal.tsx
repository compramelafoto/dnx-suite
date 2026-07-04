"use client";

import { memo, useEffect, useMemo, useRef } from "react";
import type { LayoutTemplate } from "./layoutTemplates";
import LAYOUT_TEMPLATES, { scoreTemplateMatch } from "./layoutTemplates";
import type { Orientation } from "./useImageOrientations";

type CustomTemplate = {
  id: number;
  name: string;
  imageUrl: string;
  widthCm: number;
  heightCm: number;
  slots: Array<{ index: number; bbox: { x: number; y: number; width: number; height: number } }>;
};

type TemplatesFloatingModalProps = {
  open: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLElement | null>;
  /** "system" = LAYOUT_TEMPLATES, "custom" = plantillas del usuario */
  mode: "system" | "custom";
  selectedLayoutIndex?: number;
  customTemplates?: CustomTemplate[];
  customTemplatesLoading?: boolean;
  slotCountFilter?: number | null;
  /** Si se pasan, se ordenan las plantillas priorizando las que mejor encajan con estas orientaciones */
  orientationsForSort?: Orientation[] | null;
  onSelectSystemTemplate: (index: number) => void;
  onSelectCustomTemplate?: (template: CustomTemplate) => void;
};

function TemplateThumbnail({
  template,
  isSelected,
  onClick,
}: {
  template: LayoutTemplate;
  isSelected: boolean;
  onClick: () => void;
}) {
  const size = 52;
  const inner = size - 4;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-lg border-2 p-1 transition-colors ${
        isSelected ? "border-[#c27b3d] bg-[#fff7ee]" : "border-[#e5e7eb] bg-white hover:border-[#d1d5db]"
      }`}
      title={template.name}
      style={{ width: 64, height: 80 }}
    >
      <div className="mx-auto flex h-[48px] w-[48px] items-center justify-center rounded bg-[#f9fafb]">
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

function CustomTemplateThumbnail({
  template,
  onClick,
}: {
  template: CustomTemplate;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="shrink-0 rounded-lg border-2 border-[#e5e7eb] bg-white p-1 transition-colors hover:border-[#d1d5db]"
      title={template.name}
      style={{ width: 80, height: 96 }}
    >
      <div className="relative h-[64px] w-[64px] overflow-hidden rounded bg-[#f1f5f9]">
        <img
          src={template.imageUrl}
          alt={template.name}
          className="h-full w-full object-cover"
        />
      </div>
      <div className="mt-1 truncate text-[10px] text-[#6b7280]">{template.name}</div>
    </button>
  );
}

function TemplatesFloatingModal({
  open,
  onClose,
  anchorRef,
  mode,
  selectedLayoutIndex = 0,
  customTemplates = [],
  customTemplatesLoading = false,
  slotCountFilter,
  orientationsForSort,
  onSelectSystemTemplate,
  onSelectCustomTemplate,
}: TemplatesFloatingModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  const filteredSystem = useMemo(() => {
    let list = slotCountFilter != null
      ? LAYOUT_TEMPLATES.filter((t) => t.slots.length === slotCountFilter)
      : [...LAYOUT_TEMPLATES];
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
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        anchorRef.current &&
        !anchorRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open, onClose, anchorRef]);

  if (!open) return null;

  return (
    <div
      ref={panelRef}
      className="fixed z-50 rounded-xl border border-[#e5e7eb] bg-white py-3 px-3 shadow-xl max-h-[70vh] overflow-y-auto"
      style={{
        left: anchorRef.current
          ? Math.min(anchorRef.current.getBoundingClientRect().left, window.innerWidth - 340)
          : "50%",
        top: anchorRef.current
          ? anchorRef.current.getBoundingClientRect().bottom + 8
          : 100,
        transform: anchorRef.current ? "none" : "translateX(-50%)",
        minWidth: 320,
        maxWidth: 400,
      }}
    >
      <h3 className="text-xs font-semibold text-[#1a1a1a] mb-3">
        {mode === "system" ? "Plantillas" : "Mis plantillas"}
      </h3>
      {mode === "system" && (
        <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
          {filteredSystem.map((template) => {
            const originalIndex = LAYOUT_TEMPLATES.indexOf(template);
            return (
              <TemplateThumbnail
                key={template.id}
                template={template}
                isSelected={originalIndex === selectedLayoutIndex}
                onClick={() => {
                  onSelectSystemTemplate(originalIndex);
                  onClose();
                }}
              />
            );
          })}
        </div>
      )}
      {mode === "custom" && (
        <div className="grid grid-cols-3 gap-2">
          {customTemplatesLoading ? (
            <p className="col-span-3 text-xs text-[#94a3b8] py-4">Cargando…</p>
          ) : customTemplates.length === 0 ? (
            <p className="col-span-3 text-xs text-[#94a3b8] py-4">
              No tenés plantillas guardadas. Guardá un diseño como plantilla para verlo acá.
            </p>
          ) : (
            customTemplates.map((t) => (
              <CustomTemplateThumbnail
                key={t.id}
                template={t}
                onClick={() => {
                  onSelectCustomTemplate?.(t);
                  onClose();
                }}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default memo(TemplatesFloatingModal);
export type { CustomTemplate };
