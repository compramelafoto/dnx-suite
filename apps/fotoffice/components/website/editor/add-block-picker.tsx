"use client";

import { useEffect, useRef } from "react";
import { WEBSITE_BLOCK_DEFINITIONS, WEBSITE_BLOCK_TYPES, type WebsiteBlockType } from "@/lib/website/blocks";

const GROUP_LABELS: Record<string, string> = {
  CONTENIDO: "Contenido",
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

  const grouped = WEBSITE_BLOCK_TYPES.reduce<Record<string, WebsiteBlockType[]>>((acc, type) => {
    const group = WEBSITE_BLOCK_DEFINITIONS[type].group;
    (acc[group] ??= []).push(type);
    return acc;
  }, {});

  return (
    <dialog
      ref={dialogRef}
      className="fo-card max-w-md w-[90vw] p-0 backdrop:bg-black/50"
      onClose={onClose}
      onCancel={onClose}
    >
      <div className="p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[var(--fo-text)]">Agregar sección</h2>
          <button type="button" className="text-sm text-[var(--fo-muted)] hover:text-[var(--fo-text)]" onClick={onClose}>
            Cerrar
          </button>
        </div>

        {Object.entries(grouped).map(([group, types]) => (
          <div key={group} className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--fo-muted)]">
              {GROUP_LABELS[group] ?? group}
            </p>
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
