"use client";

import { useSyncExternalStore } from "react";
import {
  getTemplateTextEditingBlockId,
  insertTextIntoActiveTemplateEditor,
  subscribeTemplateTextEditing,
} from "@/lib/template-v2/text-edit-bridge";
import { braceSnippetForCatalogKey } from "@/lib/template-v2/resolve-text-brace-variables";
import { getTextVariableGroupsForProduct } from "@/lib/template-v2/variable-catalog-product";
import type { TemplateProductId } from "@/lib/template-v2/resolve-template-product";
import { cn } from "@/lib/utils";

type Props = {
  selectedBlockId: string | null;
  selectedKind: "TEXT" | "VARIABLE_TEXT" | null;
  product?: TemplateProductId | "unknown";
};

export function TemplateVariableBraceInsertPanel({
  selectedBlockId,
  selectedKind,
  product = "school",
}: Props) {
  const editingId = useSyncExternalStore(
    subscribeTemplateTextEditing,
    getTemplateTextEditingBlockId,
    getTemplateTextEditingBlockId
  );
  const show =
    editingId != null &&
    selectedBlockId != null &&
    selectedBlockId === editingId &&
    (selectedKind === "TEXT" || selectedKind === "VARIABLE_TEXT");

  if (!show) return null;

  const groups = getTextVariableGroupsForProduct(product);

  return (
    <div
      className="mb-4 rounded-xl border border-[#bbf7d0] bg-[#f0fdf4] px-3 py-2.5 shadow-sm"
      data-testid="template-v2-variable-catalog"
    >
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[#166534]">
        Agregar dato variable
      </p>
      <p className="mt-1 text-[10px] leading-snug text-[#15803d]/90">
        Se inserta en el cursor como <code className="font-mono text-[10px]">{`{clave}`}</code>.
        {product === "clickaton" ? " Catálogo Clickatón." : " Catálogo escolar."}
      </p>
      <div className="mt-2 max-h-[220px] space-y-2.5 overflow-y-auto pr-0.5">
        {groups.map((g) => (
          <div key={g.id} data-testid={`template-v2-variable-group-${g.id}`}>
            <p className="text-[10px] font-medium text-[#14532d]/90">{g.label}</p>
            <div className="mt-1 flex flex-col gap-1">
              {g.variables.map((v) => (
                <button
                  key={v.key}
                  type="button"
                  data-testid={`template-v2-variable-key-${v.key.replace(/\./g, "-")}`}
                  className={cn(
                    "rounded-md border border-emerald-200/90 bg-white px-2 py-1.5 text-left transition-colors",
                    "hover:border-[#c27b3d]/45 hover:bg-[#fffbf7]"
                  )}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() =>
                    insertTextIntoActiveTemplateEditor(braceSnippetForCatalogKey(v.key))
                  }
                >
                  <span className="text-[11px] font-medium leading-snug text-[#0f172a]">
                    {v.label}
                  </span>
                  <span className="mt-0.5 block font-mono text-[9px] text-[#64748b]">
                    {braceSnippetForCatalogKey(v.key)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
