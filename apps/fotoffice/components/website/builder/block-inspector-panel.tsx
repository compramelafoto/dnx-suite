"use client";

import { X } from "lucide-react";
import { WEBSITE_BLOCK_DEFINITIONS, type WebsiteBlock } from "@/lib/website/blocks";
import { WEBSITE_BLOCK_REGISTRY } from "@/lib/website/block-registry";
import { ToggleField } from "@/components/website/inspector/inspector-fields";

/**
 * Panel derecho del builder: campos del bloque seleccionado, en vivo — cada cambio actualiza
 * el bloque en el estado local del builder (que alimenta la preview central de inmediato) y
 * dispara el autosave con debounce. Reemplaza el modal de edición de la etapa anterior: la
 * edición normal ya no tapa la pantalla.
 */
export function BlockInspectorPanel({
  block,
  canEdit,
  onChange,
  onClose,
}: {
  block: WebsiteBlock | null;
  canEdit: boolean;
  onChange: (updated: WebsiteBlock) => void;
  onClose: () => void;
}) {
  if (!block) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center">
        <p className="text-sm text-[var(--fo-muted)]">Seleccioná una sección para editarla acá.</p>
      </div>
    );
  }

  const def = WEBSITE_BLOCK_DEFINITIONS[block.type];
  const Registry = WEBSITE_BLOCK_REGISTRY[block.type];

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--fo-border)]">
        <p className="text-sm font-semibold text-[var(--fo-text)]">{def.label}</p>
        <button type="button" aria-label="Cerrar" className="text-[var(--fo-muted)] hover:text-[var(--fo-text)]" onClick={onClose}>
          <X className="h-4 w-4" />
        </button>
      </div>
      <fieldset disabled={!canEdit} className="flex-1 overflow-y-auto p-4 space-y-5 border-0">
        <Registry.Inspector config={block.config as never} onChange={(config) => onChange({ ...block, config } as WebsiteBlock)} blockId={block.id} />
        <ToggleField label="Mostrar esta sección en el sitio" checked={block.visible} onChange={(v) => onChange({ ...block, visible: v })} />
      </fieldset>
    </div>
  );
}
