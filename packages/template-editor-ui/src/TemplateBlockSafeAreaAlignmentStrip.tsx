"use client";

import { alignLayoutToSafeArea } from "@/lib/template-v2/align-layout-to-safe-area";
import type { CanvasQuickAlignment } from "@/lib/template-v2/align-block-to-canvas";
import {
  getPrimarySelectedBlockId,
  updateBlock,
  type TemplateV2EditorDispatch,
  type TemplateV2EditorState,
} from "@/lib/template-v2/editor-store";
import { AlignmentGlyph } from "@/components/template-v2/alignment-glyph";
import { cn } from "@/lib/utils";

const alignBtnClass =
  "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#e8eaed] bg-white text-[#3c4043] shadow-[0_1px_2px_rgba(0,0,0,0.06)] transition-colors hover:border-[#c27b3d]/50 hover:bg-[#fffaf6] hover:text-[#9a5f2e] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-[#e8eaed] disabled:hover:bg-white disabled:hover:text-[#3c4043]";

const ALIGN_ITEMS: { kind: CanvasQuickAlignment; title: string }[] = [
  { kind: "left", title: "Alinear a la izquierda (zona segura)" },
  { kind: "center-x", title: "Centrar horizontalmente (zona segura)" },
  { kind: "right", title: "Alinear a la derecha (zona segura)" },
  { kind: "top", title: "Alinear arriba (zona segura)" },
  { kind: "center-y", title: "Centrar verticalmente (zona segura)" },
  { kind: "bottom", title: "Alinear abajo (zona segura)" },
];

type Props = {
  state: TemplateV2EditorState;
  dispatch: TemplateV2EditorDispatch;
  className?: string;
};

export function TemplateBlockSafeAreaAlignmentStrip({ state, dispatch, className }: Props) {
  const primaryId = getPrimarySelectedBlockId(state);
  const block = primaryId ? state.blocks.find((b) => b.id === primaryId) ?? null : null;
  if (!block) return null;

  /** Const para que TS reconozca bloque definido dentro de `apply` (no reestrecha en closures). */
  const selectedBlock = block;
  const locked = selectedBlock.layout.locked ?? false;

  function apply(kind: CanvasQuickAlignment) {
    if (locked) return;
    const { x, y } = alignLayoutToSafeArea(kind, state.canvas, selectedBlock.layout);
    dispatch(updateBlock(selectedBlock.id, { layout: { x, y } }));
  }

  return (
    <div
      className={cn("flex flex-nowrap items-center gap-0.5", className)}
      role="group"
      aria-label="Alinear bloque a la zona segura"
    >
      {ALIGN_ITEMS.map(({ kind, title }) => (
        <button
          key={kind}
          type="button"
          className={alignBtnClass}
          disabled={locked}
          title={title}
          aria-label={title}
          onClick={() => apply(kind)}
        >
          <AlignmentGlyph kind={kind} />
        </button>
      ))}
    </div>
  );
}
