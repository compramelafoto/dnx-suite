"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { clampBlockPosition } from "@/lib/template-v2/clamp-block-position";
import {
  buildPasteStyleUpdate,
  canPasteStyle,
  clearCopiedBlockStyle,
  extractBlockStyle,
  getCopiedBlockStyle,
  setCopiedBlockStyle,
} from "@/lib/template-v2/block-style-clipboard";
import { swapLayerTowardBackForPage, swapLayerTowardFrontForPage } from "@/lib/template-v2/layer-order";
import {
  TEMPLATE_V2_RESET_WORK_SCROLL_EVENT,
  type TemplateEditorCanvasTool,
} from "@/lib/template-v2/editor-canvas-tool";
import {
  duplicateBlock,
  getPrimarySelectedBlockId,
  pasteBlockFromClipboard,
  redo,
  removeBlocks,
  selectBlock,
  selectCanRedo,
  selectCanUndo,
  setBlocks,
  setPan,
  setZoom,
  undo,
  updateBlock,
  type TemplateV2ClipboardSnapshot,
  type TemplateV2EditorDispatch,
  type TemplateV2EditorState,
} from "@/lib/template-v2/editor-store";

function isEditableTarget(target: EventTarget | null): boolean {
  if (!target || !(target instanceof Element)) return false;
  const el = target.closest(
    "input, textarea, select, [contenteditable='true'], [contenteditable='']"
  );
  return Boolean(el);
}

const ZOOM_STEP = 1.1;

export type UseTemplateEditorHotkeysOptions = {
  enabled: boolean;
  state: TemplateV2EditorState;
  dispatch: TemplateV2EditorDispatch;
  previewOpen: boolean;
  onClosePreview: () => void;
  onSave: () => void | Promise<void>;
  onOpenPreview: () => void | Promise<void>;
  /** Atajos T (texto), V (selección), H (mano). */
  onCanvasToolChange?: (tool: TemplateEditorCanvasTool) => void;
};

/**
 * Atajos del editor Template V2 (solo con `enabled`; evita inputs/select/textarea/contenteditable).
 * Cmd/Ctrl+S guarda desde cualquier foco (evita el “Guardar página” del navegador).
 */
export function useTemplateEditorHotkeys(options: UseTemplateEditorHotkeysOptions): void {
  const {
    enabled,
    state,
    dispatch,
    previewOpen,
    onClosePreview,
    onSave,
    onOpenPreview,
    onCanvasToolChange,
  } = options;

  const stateRef = useRef(state);
  const previewOpenRef = useRef(previewOpen);
  const onClosePreviewRef = useRef(onClosePreview);
  const onSaveRef = useRef(onSave);
  const onOpenPreviewRef = useRef(onOpenPreview);
  const onCanvasToolChangeRef = useRef(onCanvasToolChange);
  const clipboardRef = useRef<TemplateV2ClipboardSnapshot | null>(null);
  const templateIdRef = useRef<string | null>(null);
  const versionIdRef = useRef<string | null>(null);

  useLayoutEffect(() => {
    stateRef.current = state;
    previewOpenRef.current = previewOpen;
    onClosePreviewRef.current = onClosePreview;
    onSaveRef.current = onSave;
    onOpenPreviewRef.current = onOpenPreview;
    onCanvasToolChangeRef.current = onCanvasToolChange;
  }, [state, previewOpen, onClosePreview, onSave, onOpenPreview, onCanvasToolChange]);

  useLayoutEffect(() => {
    if (state.templateId && templateIdRef.current && state.templateId !== templateIdRef.current) {
      clipboardRef.current = null;
      clearCopiedBlockStyle();
    }
    templateIdRef.current = state.templateId;
    if (state.versionId && versionIdRef.current && state.versionId !== versionIdRef.current) {
      clipboardRef.current = null;
      clearCopiedBlockStyle();
    }
    versionIdRef.current = state.versionId;
  }, [state.templateId, state.versionId]);

  useEffect(() => {
    if (!enabled) return;

    const onKeyDown = (e: KeyboardEvent) => {
      const s = stateRef.current;
      const mod = e.metaKey || e.ctrlKey;
      const editable = isEditableTarget(e.target);

      // Guardar: siempre que el editor esté listo (incluye foco en inputs del inspector).
      if (mod && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void Promise.resolve(onSaveRef.current());
        return;
      }

      if (previewOpenRef.current && e.key === "Escape") {
        e.preventDefault();
        onClosePreviewRef.current();
        return;
      }

      if (e.key === "Escape" && getCopiedBlockStyle() && !isEditableTarget(e.target)) {
        e.preventDefault();
        clearCopiedBlockStyle();
        return;
      }

      if (editable) return;

      if (mod && (e.key === "z" || e.key === "Z")) {
        e.preventDefault();
        if (e.shiftKey) {
          if (selectCanRedo(s)) dispatch(redo());
        } else if (selectCanUndo(s)) {
          dispatch(undo());
        }
        return;
      }

      if (mod && !e.shiftKey && (e.key === "y" || e.key === "Y")) {
        if (selectCanRedo(s)) {
          e.preventDefault();
          dispatch(redo());
        }
        return;
      }

      if (e.key === "Escape") {
        if (s.selectedBlockIds.length > 0) {
          e.preventDefault();
          dispatch(selectBlock(null));
        }
        return;
      }

      if (mod && e.shiftKey && (e.key === "p" || e.key === "P")) {
        e.preventDefault();
        void Promise.resolve(onOpenPreviewRef.current());
        return;
      }

      if ((e.key === "Backspace" || e.key === "Delete") && !mod && !e.altKey) {
        if (s.selectedBlockIds.length > 0) {
          e.preventDefault();
          dispatch(removeBlocks(s.selectedBlockIds));
        }
        return;
      }

      if (mod && !e.shiftKey && !e.altKey && (e.key === "d" || e.key === "D")) {
        const primary = getPrimarySelectedBlockId(s);
        if (primary) {
          e.preventDefault();
          dispatch(duplicateBlock(primary));
        }
        return;
      }

      if (mod && !e.shiftKey && !e.altKey && (e.key === "c" || e.key === "C")) {
        const primary = getPrimarySelectedBlockId(s);
        if (!primary) return;
        const block = s.blocks.find((b) => b.id === primary);
        if (!block) return;
        e.preventDefault();
        try {
          clipboardRef.current = {
            block: structuredClone(block),
            bindings: s.variableBindings.filter((vb) => vb.blockId === block.id).map((vb) => ({ ...vb })),
          };
        } catch {
          clipboardRef.current = {
            block: JSON.parse(JSON.stringify(block)) as TemplateV2ClipboardSnapshot["block"],
            bindings: s.variableBindings.filter((vb) => vb.blockId === block.id).map((vb) => ({ ...vb })),
          };
        }
        return;
      }

      if (mod && e.altKey && !e.shiftKey && (e.key === "c" || e.key === "C")) {
        const primary = getPrimarySelectedBlockId(s);
        if (!primary) return;
        const block = s.blocks.find((b) => b.id === primary);
        if (!block) return;
        const style = extractBlockStyle(block);
        if (!style) return;
        e.preventDefault();
        setCopiedBlockStyle(style, primary);
        return;
      }

      if (mod && e.altKey && !e.shiftKey && (e.key === "v" || e.key === "V")) {
        const primary = getPrimarySelectedBlockId(s);
        if (!primary) return;
        const block = s.blocks.find((b) => b.id === primary);
        if (!block || block.layout.locked) return;
        const clip = getCopiedBlockStyle();
        if (!clip || !canPasteStyle(clip, block.type)) return;
        const patch = buildPasteStyleUpdate(clip, block);
        if (!patch) return;
        e.preventDefault();
        dispatch(
          updateBlock(primary, {
            configJson: patch.configJson,
            ...(patch.layout ? { layout: patch.layout } : {}),
          })
        );
        return;
      }

      if (mod && !e.shiftKey && !e.altKey && (e.key === "v" || e.key === "V")) {
        const snap = clipboardRef.current;
        if (!snap) return;
        e.preventDefault();
        dispatch(pasteBlockFromClipboard(snap));
        return;
      }

      if (mod && !e.shiftKey) {
        if (e.key === "+" || e.key === "=") {
          e.preventDefault();
          dispatch(setZoom(s.zoom * ZOOM_STEP));
          return;
        }
        if (e.key === "-" || e.key === "_") {
          e.preventDefault();
          dispatch(setZoom(s.zoom / ZOOM_STEP));
          return;
        }
        if (e.key === "0") {
          e.preventDefault();
          dispatch(setZoom(1));
          dispatch(setPan({ x: 0, y: 0 }));
          window.dispatchEvent(new CustomEvent(TEMPLATE_V2_RESET_WORK_SCROLL_EVENT));
          return;
        }
      }

      if (mod && !e.shiftKey) {
        const primary = getPrimarySelectedBlockId(s);
        if (primary) {
          const page = s.activePageIndex ?? 0;
          if (e.key === "]" || e.code === "BracketRight") {
            e.preventDefault();
            dispatch(setBlocks(swapLayerTowardFrontForPage(s.blocks, page, primary)));
            return;
          }
          if (e.key === "[" || e.code === "BracketLeft") {
            e.preventDefault();
            dispatch(setBlocks(swapLayerTowardBackForPage(s.blocks, page, primary)));
            return;
          }
        }
      }

      if (
        (e.key === "ArrowUp" ||
          e.key === "ArrowDown" ||
          e.key === "ArrowLeft" ||
          e.key === "ArrowRight") &&
        !mod
      ) {
        const id = getPrimarySelectedBlockId(s);
        if (!id) return;
        const block = s.blocks.find((b) => b.id === id);
        if (!block || block.layout.locked) return;

        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        let dx = 0;
        let dy = 0;
        if (e.key === "ArrowLeft") dx = -step;
        if (e.key === "ArrowRight") dx = step;
        if (e.key === "ArrowUp") dy = -step;
        if (e.key === "ArrowDown") dy = step;

        const next = clampBlockPosition(
          s.canvas.width,
          s.canvas.height,
          block.layout.x + dx,
          block.layout.y + dy,
          block.layout.width,
          block.layout.height
        );
        dispatch(
          updateBlock(id, {
            layout: { x: next.x, y: next.y },
          })
        );
      }
    };

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [enabled, dispatch]);
}
