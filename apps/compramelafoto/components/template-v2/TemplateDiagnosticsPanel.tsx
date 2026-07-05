"use client";

import { useMemo } from "react";
import { getBlockDisplayName, getBlockTypeLabelEs } from "@/lib/template-v2/block-display-name";
import {
  applyDiagnosticQuickFix,
  getDiagnosticQuickFixLabel,
} from "@/lib/template-v2/diagnostic-quick-fixes";
import { collectTemplateDiagnostics } from "@/lib/template-v2/template-diagnostics";
import { selectBlock, type TemplateV2EditorDispatch } from "@/lib/template-v2/editor-store";
import type { TemplateV2Block, TemplateV2Canvas } from "@/lib/template-v2/render-core";

type Props = {
  blocks: TemplateV2Block[];
  canvas: TemplateV2Canvas;
  dispatch: TemplateV2EditorDispatch;
  /** Sin título propio: para usar dentro de un panel colapsable que ya tiene su etiqueta. */
  embedded?: boolean;
};

export function TemplateDiagnosticsPanel({ blocks, canvas, dispatch, embedded }: Props) {
  const issues = useMemo(() => collectTemplateDiagnostics(blocks, canvas), [blocks, canvas]);
  const blockById = useMemo(() => new Map(blocks.map((b) => [b.id, b])), [blocks]);

  return (
    <div>
      {embedded ? (
        <p className="mb-1.5 text-[10px] text-[#6b7280]">
          {issues.length === 0 ? "Sin problemas detectados" : `${issues.length} aviso${issues.length === 1 ? "" : "s"}`}
        </p>
      ) : (
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-sm font-semibold text-[#111827]">Revisión rápida</h3>
          <span className="text-[11px] text-[#6b7280]">
            {issues.length === 0 ? "Sin problemas detectados" : `${issues.length} aviso${issues.length === 1 ? "" : "s"}`}
          </span>
        </div>
      )}
      {issues.length > 0 ? (
        <ul className="mt-2 max-h-[min(40vh,260px)] space-y-1 overflow-y-auto pr-0.5">
          {issues.map((issue, i) => {
            const block = blockById.get(issue.blockId);
            const label = block ? getBlockDisplayName(block) : issue.blockId;
            const typeLabel = block ? getBlockTypeLabelEs(block.type) : "—";
            const fixLabel = getDiagnosticQuickFixLabel(issue.code);
            return (
              <li key={`${issue.blockId}-${issue.code}-${i}`}>
                <div className="flex gap-1.5 rounded-lg border border-transparent bg-[#f9fafb] p-1.5 transition-colors hover:border-[#e5e7eb] hover:bg-[#f3f4f6]">
                  <button
                    type="button"
                    className="min-w-0 flex-1 rounded-md px-1.5 py-0.5 text-left text-[11px] leading-snug text-[#374151]"
                    onClick={() => dispatch(selectBlock(issue.blockId))}
                    title="Seleccionar este bloque"
                  >
                    <span className="font-medium text-[#111827]">{label}</span>
                    <span className="text-[#9ca3af]"> · {typeLabel}</span>
                    <span className="mt-0.5 block text-[#6b7280]">{issue.problem}</span>
                  </button>
                  {fixLabel ? (
                    <button
                      type="button"
                      className="shrink-0 self-center rounded-md border border-[#e8d4c4] bg-white px-2 py-1 text-[10px] font-medium text-[#9a5f2e] shadow-sm hover:bg-[#fffbf7]"
                      title="Acción rápida"
                      onClick={(e) => {
                        e.stopPropagation();
                        applyDiagnosticQuickFix(dispatch, {
                          code: issue.code,
                          blockId: issue.blockId,
                          blocks,
                          canvas,
                        });
                      }}
                    >
                      {fixLabel}
                    </button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-1.5 text-[11px] text-[#6b7280]">Podés publicar o seguir editando con tranquilidad.</p>
      )}
    </div>
  );
}
