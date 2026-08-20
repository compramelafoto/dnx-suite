"use client";

import { useEffect, useRef } from "react";
import { WEBSITE_BLOCK_CATEGORIES, WEBSITE_BLOCK_DEFINITIONS, WEBSITE_BLOCK_TYPES, type WebsiteBlockCategory, type WebsiteBlockType } from "@/lib/website/blocks";

const CATEGORY_LABELS: Record<WebsiteBlockCategory, string> = {
  BASICAS: "Básicas",
  INSTITUCION: "Institución",
  SOCIOS: "Socios",
  ACTIVIDAD: "Actividad",
  COMUNICACION: "Comunicación",
  COMERCIAL: "Comercial / Sponsors",
};

export function AddBlockPicker({
  onSelect,
  onClose,
}: {
  onSelect: (type: WebsiteBlockType) => void;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  const byCategory = WEBSITE_BLOCK_CATEGORIES.map((category) => ({
    category,
    types: WEBSITE_BLOCK_TYPES.filter((type) => WEBSITE_BLOCK_DEFINITIONS[type].category === category),
  })).filter((g) => g.types.length > 0);

  return (
    <dialog
      ref={dialogRef}
      className="fo-card max-w-md w-[90vw] p-0 backdrop:bg-black/50"
      onClose={onClose}
      onCancel={onClose}
    >
      <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[var(--fo-text)]">Agregar sección</h2>
          <button type="button" className="text-sm text-[var(--fo-muted)] hover:text-[var(--fo-text)]" onClick={onClose}>
            Cerrar
          </button>
        </div>

        {byCategory.map(({ category, types }) => (
          <div key={category} className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--fo-muted)]">{CATEGORY_LABELS[category]}</p>
            <div className="space-y-2">
              {types.map((type) => {
                const def = WEBSITE_BLOCK_DEFINITIONS[type];
                return (
                  <button
                    key={type}
                    type="button"
                    className="w-full text-left rounded-xl border border-[var(--fo-border)] bg-[var(--fo-bg)] px-4 py-3 hover:border-[var(--fo-accent)] transition-colors"
                    onClick={() => onSelect(type)}
                  >
                    <p className="text-sm font-semibold text-[var(--fo-text)]">{def.label}</p>
                    <p className="text-xs text-[var(--fo-muted)] mt-0.5">{def.description}</p>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </dialog>
  );
}
