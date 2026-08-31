"use client";

import { useSyncExternalStore } from "react";
import {
  getTemplateTextEditingBlockId,
  insertTextIntoActiveTemplateEditor,
  subscribeTemplateTextEditing,
} from "@repo/template-editor-core";
import { braceSnippetForCatalogKey } from "@repo/template-editor-core";
import { getTextVariableGroupsForProduct } from "@repo/template-editor-core";
import type { TemplateProductId } from "@repo/template-editor-core";
import { cn } from "./primitives/cn";

type Props = {
  selectedBlockId: string | null;
  selectedKind: "TEXT" | "VARIABLE_TEXT" | null;
  product?: TemplateProductId | "unknown";
};

/** Cómo se nombra cada catálogo. Sin entrada, no se dice nada: mejor callar que nombrar mal. */
const ETIQUETA_PRODUCTO: Record<string, string> = {
  fotoffice: " Datos del socio.",
  fotorank: " Datos del diploma.",
  clickaton: " Catálogo Clickatón.",
  school: " Catálogo de ComprameLaFoto.",
};

export function TemplateVariableBraceInsertPanel({
  selectedBlockId,
  selectedKind,
  /*
   * Sin producto no se asume ninguno. Antes el valor por omisión era "school": una pantalla que
   * se olvidara de pasarlo mostraba el catálogo de CLF, y en FotoOffice aparecían "Alumno" y
   * "Escuela". Un catálogo vacío avisa; uno equivocado engaña.
   */
  product = "unknown",
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
      className="mb-4 rounded-xl border border-[#bbf7d0] bg-[color:var(--te-chrome-sunken)] px-3 py-2.5 shadow-sm"
      data-testid="template-v2-variable-catalog"
    >
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--te-success)]">
        Agregar dato variable
      </p>
      <p className="mt-1 text-[10px] leading-snug text-[color:var(--te-line)]">
        {/*
          Se inserta con una llave, que es lo que entiende el lienzo del editor. La conversión a
          la escritura del módulo de impresión la hace el puente, no la persona.
        */}
        Se inserta en el cursor como <code className="font-mono text-[10px]">{`{clave}`}</code>.
        {ETIQUETA_PRODUCTO[product] ?? ""}
      </p>
      <div className="mt-2 max-h-[220px] space-y-2.5 overflow-y-auto pr-0.5">
        {groups.map((g) => (
          <div key={g.id} data-testid={`template-v2-variable-group-${g.id}`}>
            <p className="text-[10px] font-medium text-[color:var(--te-line)]">{g.label}</p>
            <div className="mt-1 flex flex-col gap-1">
              {g.variables.map((v) => (
                <button
                  key={v.key}
                  type="button"
                  data-testid={`template-v2-variable-key-${v.key.replace(/\./g, "-")}`}
                  className={cn(
                    "rounded-md border border-emerald-200/90 bg-white px-2 py-1.5 text-left transition-colors",
                    "hover:border-[color:var(--te-accent-wash)] hover:bg-[color:var(--te-accent-wash)]"
                  )}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() =>
                    insertTextIntoActiveTemplateEditor(braceSnippetForCatalogKey(v.key))
                  }
                >
                  <span className="text-[11px] font-medium leading-snug text-[color:var(--te-ink)]">
                    {v.label}
                  </span>
                  <span className="mt-0.5 block font-mono text-[9px] text-[color:var(--te-ink-muted)]">
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
