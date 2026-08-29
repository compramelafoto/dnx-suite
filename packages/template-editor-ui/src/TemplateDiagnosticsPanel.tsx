"use client";

import { useMemo } from "react";
import { getBlockDisplayName, getBlockTypeLabelEs } from "@repo/template-editor-core";
import {
  applyDiagnosticQuickFix,
  getDiagnosticQuickFixLabel,
} from "@repo/template-editor-core";
import { collectTemplateDiagnostics } from "@repo/template-editor-core";
import { selectBlock, type TemplateV2EditorDispatch } from "@repo/template-editor-core";
import type { TemplateV2Block, TemplateV2Canvas } from "@repo/template-editor-core";

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
        <p className="mb-1.5 text-[10px] text-[color:var(--te-ink-muted)]">
          {issues.length === 0 ? "Sin problemas detectados" : `${issues.length} aviso${issues.length === 1 ? "" : "s"}`}
        </p>
      ) : (
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-sm font-semibold text-[color:var(--te-ink)]">Revisión rápida</h3>
          <span className="text-[11px] text-[color:var(--te-ink-muted)]">
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
                <div className="flex gap-1.5 rounded-lg border border-transparent bg-[color:var(--te-chrome)] p-1.5 transition-colors hover:border-[color:var(--te-line)] hover:bg-[color:var(--te-chrome-sunken)]">
                  <button
                    type="button"
                    className="min-w-0 flex-1 rounded-md px-1.5 py-0.5 text-left text-[11px] leading-snug text-[color:var(--te-ink)]"
                    onClick={() => dispatch(selectBlock(issue.blockId))}
                    title="Seleccionar este bloque"
                  >
                    <span className="font-medium text-[color:var(--te-ink)]">{label}</span>
                    <span className="text-[color:var(--te-ink-faint)]"> · {typeLabel}</span>
                    <span className="mt-0.5 block text-[color:var(--te-ink-muted)]">{issue.problem}</span>
                  </button>
                  {fixLabel ? (
                    <button
                      type="button"
                      className="shrink-0 self-center rounded-md border border-[color:var(--te-accent-wash)] bg-white px-2 py-1 text-[10px] font-medium text-[color:var(--te-accent)] shadow-sm hover:bg-[color:var(--te-accent-wash)]"
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
        <p className="mt-1.5 text-[11px] text-[color:var(--te-ink-muted)]">Podés publicar o seguir editando con tranquilidad.</p>
      )}
    </div>
  );
}
