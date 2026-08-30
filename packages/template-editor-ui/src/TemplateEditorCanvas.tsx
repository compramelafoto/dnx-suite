"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { flushSync } from "react-dom";
import { TemplateCanvasRenderer } from "./TemplateCanvasRenderer";
import { fitZoom } from "@repo/template-editor-core";
import { getCanvasCenterPoint } from "@repo/template-editor-core";
import { getSafeAreaRectPx } from "@repo/template-editor-core";
import { getLayoutSafeAreaStatus, type LayoutSafeAreaStatus } from "@repo/template-editor-core";
import { buildDiagnosticHighlightMap, collectTemplateDiagnostics } from "@repo/template-editor-core";
import {
  getTextVisualConfig,
  normalizeBlockConfig,
} from "@repo/template-editor-core";
import type { TemplateV2Block } from "@repo/template-editor-core";
import { measureTextBlockBoundsPx } from "@repo/template-editor-core";
import { snapDragPosition } from "@repo/template-editor-core";
import { normalizeRotationDeg, unwrapAngleDeltaRad } from "@repo/template-editor-core";
import {
  addBlock,
  commitHistoryCheckpoint,
  createEditorBlockId,
  duplicateBlock,
  getPrimarySelectedBlockId,
  selectBlock,
  setSelectedBlockIds,
  setZoom,
  takePersistSnapshot,
  toggleBlockInSelection,
  updateBlock,
  type TemplateV2EditorDispatch,
  type TemplateV2EditorState,
} from "@repo/template-editor-core";
import { TEMPLATE_V2_EDITOR_RESOLVED_VARIABLES } from "@repo/template-editor-core";
import {
  notifyTemplateTextEditingBlockId,
  registerTemplateTextInsert,
} from "@repo/template-editor-core";
import { createAreaTextBlockInRect, createPointTextBlockAt } from "@repo/template-editor-core";
import { computeResizeRect } from "@repo/template-editor-core";
import {
  TEMPLATE_V2_RESET_WORK_SCROLL_EVENT,
  type TemplateEditorCanvasTool,
} from "@repo/template-editor-core";
import { cn } from "./primitives/cn";

function isEditableKeyboardTarget(target: EventTarget | null): boolean {
  if (!target || !(target instanceof Element)) return false;
  return Boolean(target.closest("input, textarea, select, [contenteditable='true'], [contenteditable='']"));
}

type Props = {
  state: TemplateV2EditorState;
  dispatch: TemplateV2EditorDispatch;
  className?: string;
  /** Guía visual de márgenes seguros (no es un bloque; no se exporta en preview). Por defecto activa. */
  showSafeArea?: boolean;
  /** Ejes vertical y horizontal en el centro del lienzo (referencia fija; no es snap dinámico). Por defecto activos. */
  showCenterAxes?: boolean;
  /** Clic en el fondo del lienzo (sin bloque): p. ej. abrir panel de propiedades para el color de fondo. */
  onCanvasBackgroundClick?: () => void;
  /** Herramienta activa: selección, texto (T), mano (H). */
  canvasTool?: TemplateEditorCanvasTool;
  /** Escape en modo texto o al desactivar herramienta desde el shell. */
  onExitTextPlacementMode?: () => void;
};

type ResizeHandle = {
  key: "nw" | "ne" | "sw" | "se";
  cursor: "nwse-resize" | "nesw-resize";
  left?: number;
  right?: number;
  top?: number;
  bottom?: number;
};

/** Diámetro del control de esquina (área de agarre). Tamaño tipo diseñadores estándar (Canva/Figma). */
const RESIZE_HANDLE_SIZE_PX = 32;
const RESIZE_HANDLE_INSET = -RESIZE_HANDLE_SIZE_PX / 2;

const RESIZE_HANDLES: ResizeHandle[] = [
  { key: "nw", left: RESIZE_HANDLE_INSET, top: RESIZE_HANDLE_INSET, cursor: "nwse-resize" },
  { key: "ne", right: RESIZE_HANDLE_INSET, top: RESIZE_HANDLE_INSET, cursor: "nesw-resize" },
  { key: "sw", left: RESIZE_HANDLE_INSET, bottom: RESIZE_HANDLE_INSET, cursor: "nesw-resize" },
  { key: "se", right: RESIZE_HANDLE_INSET, bottom: RESIZE_HANDLE_INSET, cursor: "nwse-resize" },
];

/** Intersección parcial entre rectángulos alineados a ejes (layout sin rotación). */
function axisRectsIntersect(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number }
): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/** Mínimo arrastre en coords de lienzo para considerar marquee (evita pisar el clic en vacío). */
const MARQUEE_MIN_DRAG_CANVAS_PX = 4;

/** Ancho útil del área scroll (sin padding horizontal del contenedor). */
function getScrollAreaInnerWidth(el: HTMLElement): number {
  const cs = getComputedStyle(el);
  return el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
}

/** Alto útil del área scroll (sin padding vertical del contenedor). */
function getScrollAreaInnerHeight(el: HTMLElement): number {
  const cs = getComputedStyle(el);
  return el.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
}

function mergeSelectionIds(existing: readonly string[], found: readonly string[]): string[] {
  const out = [...existing];
  const seen = new Set(existing);
  for (const id of found) {
    if (!seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}

/** Bloques visibles con layout axis-aligned; intersección parcial con la caja (sin rotación en el test). */
function collectMarqueeHits(
  blocks: TemplateV2EditorState["blocks"],
  left: number,
  top: number,
  width: number,
  height: number
): string[] {
  const w = Math.max(width, 1);
  const h = Math.max(height, 1);
  const rect = { x: left, y: top, w, h };
  const ids: string[] = [];
  for (const b of blocks) {
    if (!b.layout.visible) continue;
    const br = { x: b.layout.x, y: b.layout.y, w: b.layout.width, h: b.layout.height };
    if (axisRectsIntersect(rect, br)) ids.push(b.id);
  }
  return ids;
}

function getOverlayStyle(block: TemplateV2EditorState["blocks"][number]) {
  const l = block.layout;
  return {
    position: "absolute" as const,
    left: l.x,
    top: l.y,
    width: l.width,
    height: l.height,
    transform: `rotate(${l.rotation}deg)`,
    transformOrigin: "center center",
    zIndex: l.zIndex + 1000,
    boxSizing: "border-box" as const,
  };
}

function asBlockConfigJson(block: TemplateV2Block): Record<string, unknown> {
  const c = block.configJson;
  if (!c || typeof c !== "object" || Array.isArray(c)) return {};
  return c as Record<string, unknown>;
}

function InlineTextEditOverlay({
  block,
  dispatch,
  onEnd,
  canvasWidth,
  resolvedVariables,
}: {
  block: TemplateV2Block;
  dispatch: TemplateV2EditorDispatch;
  onEnd: () => void;
  canvasWidth: number;
  resolvedVariables: Record<string, unknown>;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const blockRef = useRef(block);

  useLayoutEffect(() => {
    blockRef.current = block;
  }, [block]);

  const cfgForVisual = asBlockConfigJson(block);
  const visualCfg =
    block.type === "VARIABLE_TEXT"
      ? { ...cfgForVisual, content: String(cfgForVisual.fallback ?? "") }
      : cfgForVisual;
  const t = getTextVisualConfig(visualCfg);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const cfg = asBlockConfigJson(block);
    const initial =
      block.type === "TEXT"
        ? String(cfg.content ?? "")
        : String(cfg.fallback ?? "");
    el.textContent = initial;
    el.focus();
    try {
      const range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
    } catch {
      /* noop */
    }

    const fullCfg =
      block.type === "TEXT"
        ? { ...cfg, content: initial }
        : { ...cfg, fallback: initial };
    const bounds = measureTextBlockBoundsPx({
      type: block.type as "TEXT" | "VARIABLE_TEXT",
      configJson: fullCfg,
      resolvedVariables,
      canvasWidth,
      layoutX: block.layout.x,
    });
    dispatch(
      updateBlock(
        block.id,
        {
          layout: {
            ...block.layout,
            width: bounds.width,
            height: bounds.height,
          },
        },
        { skipHistory: true }
      )
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al cambiar bloque; no deps de texto (evita reset al tipear)
  }, [block.id, block.type]);

  useEffect(() => {
    notifyTemplateTextEditingBlockId(block.id);
    registerTemplateTextInsert((text) => {
      const el = ref.current;
      if (!el) return;
      el.focus();
      const sel = window.getSelection();
      let range: Range;
      if (sel && sel.rangeCount > 0) {
        range = sel.getRangeAt(0);
        if (!el.contains(range.commonAncestorContainer)) {
          range = document.createRange();
          range.selectNodeContents(el);
          range.collapse(false);
        }
      } else {
        range = document.createRange();
        range.selectNodeContents(el);
        range.collapse(false);
      }
      range.deleteContents();
      range.insertNode(document.createTextNode(text));
      range.collapse(false);
      sel?.removeAllRanges();
      sel?.addRange(range);
      el.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: text }));
    });
    return () => {
      registerTemplateTextInsert(null);
      notifyTemplateTextEditingBlockId(null);
    };
  }, [block.id]);

  return (
    <div
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      spellCheck={false}
      data-template-inline-text="1"
      style={{
        width: "100%",
        height: "100%",
        color: t.color,
        fontFamily: t.fontFamilyCss,
        fontSize: t.fontSize,
        fontWeight: t.fontWeight,
        fontStyle: t.fontStyle,
        textDecoration: t.textDecoration,
        lineHeight: String(t.lineHeight),
        letterSpacing: `${t.letterSpacing}px`,
        textAlign: t.textAlign,
        whiteSpace: "pre-wrap",
        overflow: "auto",
        outline: "none",
        cursor: "text",
        caretColor: t.color,
        boxSizing: "border-box",
      }}
      onInput={(e) => {
        const text = e.currentTarget.textContent ?? "";
        const cur = blockRef.current;
        const base = asBlockConfigJson(cur);
        const patch =
          cur.type === "TEXT" ? { ...base, content: text } : { ...base, fallback: text };
        const bounds = measureTextBlockBoundsPx({
          type: cur.type as "TEXT" | "VARIABLE_TEXT",
          configJson: patch,
          resolvedVariables,
          canvasWidth,
          layoutX: cur.layout.x,
        });
        dispatch({
          type: "updateBlock",
          payload: {
            blockId: cur.id,
            patch: {
              configJson: patch,
              layout: {
                ...cur.layout,
                width: bounds.width,
                height: bounds.height,
              },
            },
            skipHistory: true,
          },
        });
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          (e.currentTarget as HTMLDivElement).blur();
        }
      }}
      onBlur={onEnd}
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    />
  );
}

export function TemplateEditorCanvas({
  state,
  dispatch,
  className,
  showSafeArea = true,
  showCenterAxes = true,
  onCanvasBackgroundClick,
  canvasTool = "select",
  onExitTextPlacementMode,
}: Props) {
  const textMode = canvasTool === "text";
  const [spaceHeld, setSpaceHeld] = useState(false);
  const spaceHeldRef = useRef(false);
  const canvasToolRef = useRef(canvasTool);
  useLayoutEffect(() => {
    canvasToolRef.current = canvasTool;
  }, [canvasTool]);
  const [isPanningScroll, setIsPanningScroll] = useState(false);
  const panScrollRef = useRef<{
    pointerId: number;
    startClientX: number;
    startClientY: number;
    startScrollLeft: number;
    startScrollTop: number;
  } | null>(null);

  const [draggingBlockId, setDraggingBlockId] = useState<string | null>(null);
  const [editingTextBlockId, setEditingTextBlockId] = useState<string | null>(null);
  const textEditStartSnapshotRef = useRef<ReturnType<typeof takePersistSnapshot> | null>(null);
  const [rotatingBlockId, setRotatingBlockId] = useState<string | null>(null);
  /** Rect en coords de lienzo: esquinas opuestas durante el arrastre. */
  const [marqueeRect, setMarqueeRect] = useState<{ ax: number; ay: number; bx: number; by: number } | null>(null);
  /** Vista previa al colocar texto en área (herramienta T). */
  const [textPlaceRect, setTextPlaceRect] = useState<{ ax: number; ay: number; bx: number; by: number } | null>(null);
  const textPlaceSessionRef = useRef<{ pointerId: number; startX: number; startY: number } | null>(null);
  /** Líneas guía (coords de lienzo) mientras se arrastra con snap activo. */
  const [snapGuides, setSnapGuides] = useState<{ vx: number | null; hy: number | null }>({
    vx: null,
    hy: null,
  });
  const suppressNextBackgroundClickRef = useRef(false);
  const workAreaRef = useRef<HTMLDivElement | null>(null);
  const zoomUserAdjustedRef = useRef(state.zoomUserAdjusted);
  useLayoutEffect(() => {
    zoomUserAdjustedRef.current = state.zoomUserAdjusted;
  }, [state.zoomUserAdjusted]);
  /** True durante pointerdown Alt+duplicar hasta soltar: hace falta commit de historial aunque no se mueva el puntero. */
  const altDuplicateGestureRef = useRef(false);
  const canvasInnerRef = useRef<HTMLDivElement | null>(null);
  const marqueeSessionRef = useRef<{
    pointerId: number;
    shiftKey: boolean;
    startX: number;
    startY: number;
  } | null>(null);
  /** Estado persistible al inicio de drag/resize/rotate (un solo gesto a la vez). */
  const gesturePersistSnapshotRef = useRef<ReturnType<typeof takePersistSnapshot> | null>(null);
  const dragRef = useRef<{
    pointerId: number;
    blockId: string;
    startClientX: number;
    startClientY: number;
    startX: number;
    startY: number;
    blockWidth: number;
    blockHeight: number;
    moved: boolean;
  } | null>(null);
  const resizeRef = useRef<{
    pointerId: number;
    blockId: string;
    handle: "se" | "sw" | "ne" | "nw";
    startClientX: number;
    startClientY: number;
    startX: number;
    startY: number;
    startWidth: number;
    startHeight: number;
    moved: boolean;
    /** Escalar tipografía con el gesto (solo TEXT / VARIABLE_TEXT). */
    scaleTypography: boolean;
    startFontSize: number;
    startConfigJson: Record<string, unknown>;
  } | null>(null);
  const rotateRef = useRef<{
    pointerId: number;
    blockId: string;
    centerX: number;
    centerY: number;
    lastAngleRad: number;
    rotationAccumDeg: number;
    moved: boolean;
  } | null>(null);

  const activePage = state.activePageIndex ?? 0;
  const blocksOnPage = useMemo(
    () => state.blocks.filter((b) => (b.pageIndex ?? 0) === activePage),
    [state.blocks, activePage]
  );

  const orderedVisibleBlocks = useMemo(
    () =>
      [...blocksOnPage]
        .filter((b) => b.layout.visible)
        .sort((a, b) => a.layout.zIndex - b.layout.zIndex),
    [blocksOnPage]
  );

  const primaryId = getPrimarySelectedBlockId(state);
  const primaryBlock = primaryId ? state.blocks.find((b) => b.id === primaryId) ?? null : null;

  const safeAreaRect = useMemo(() => getSafeAreaRectPx(state.canvas), [state.canvas]);
  const centerAxes = useMemo(() => getCanvasCenterPoint(state.canvas), [state.canvas]);
  const primarySafeAreaStatus = useMemo(
    () =>
      primaryBlock ? getLayoutSafeAreaStatus(primaryBlock.layout, safeAreaRect) : ("inside" as LayoutSafeAreaStatus),
    [primaryBlock, safeAreaRect]
  );

  const diagnosticHighlightByBlockId = useMemo(
    () => buildDiagnosticHighlightMap(collectTemplateDiagnostics(blocksOnPage, state.canvas)),
    [blocksOnPage, state.canvas]
  );

  const editingTextBlock =
    editingTextBlockId != null ? state.blocks.find((b) => b.id === editingTextBlockId) ?? null : null;

  const endInlineTextEdit = useCallback(() => {
    const snap = textEditStartSnapshotRef.current;
    textEditStartSnapshotRef.current = null;
    setEditingTextBlockId(null);
    if (snap) {
      dispatch(commitHistoryCheckpoint(snap));
    }
  }, [dispatch]);

  useEffect(() => {
    if (!editingTextBlockId) return;
    if (state.blocks.some((b) => b.id === editingTextBlockId)) return;
    textEditStartSnapshotRef.current = null;
    queueMicrotask(() => setEditingTextBlockId(null));
  }, [state.blocks, editingTextBlockId]);

  useEffect(() => {
    if (!editingTextBlockId) return;
    const b = state.blocks.find((x) => x.id === editingTextBlockId);
    if (!b || (b.pageIndex ?? 0) !== activePage) {
      textEditStartSnapshotRef.current = null;
      queueMicrotask(() => setEditingTextBlockId(null));
    }
  }, [activePage, editingTextBlockId, state.blocks]);

  useEffect(() => {
    if (!textMode) return;
    function onKey(ev: KeyboardEvent) {
      if (ev.key === "Escape") {
        ev.preventDefault();
        textPlaceSessionRef.current = null;
        setTextPlaceRect(null);
        onExitTextPlacementMode?.();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [textMode, onExitTextPlacementMode]);

  useEffect(() => {
    function onSpaceDown(e: KeyboardEvent) {
      if (e.code !== "Space" && e.key !== " ") return;
      if (isEditableKeyboardTarget(e.target)) return;
      e.preventDefault();
      spaceHeldRef.current = true;
      setSpaceHeld(true);
    }
    function onSpaceUp(e: KeyboardEvent) {
      if (e.code !== "Space" && e.key !== " ") return;
      spaceHeldRef.current = false;
      setSpaceHeld(false);
    }
    function onWinBlur() {
      spaceHeldRef.current = false;
      setSpaceHeld(false);
    }
    window.addEventListener("keydown", onSpaceDown, true);
    window.addEventListener("keyup", onSpaceUp, true);
    window.addEventListener("blur", onWinBlur);
    return () => {
      window.removeEventListener("keydown", onSpaceDown, true);
      window.removeEventListener("keyup", onSpaceUp, true);
      window.removeEventListener("blur", onWinBlur);
    };
  }, []);

  useEffect(() => {
    function onResetWorkScroll() {
      workAreaRef.current?.scrollTo({ left: 0, top: 0, behavior: "auto" });
    }
    window.addEventListener(TEMPLATE_V2_RESET_WORK_SCROLL_EVENT, onResetWorkScroll);
    return () => window.removeEventListener(TEMPLATE_V2_RESET_WORK_SCROLL_EVENT, onResetWorkScroll);
  }, []);

  useLayoutEffect(() => {
    const el = workAreaRef.current;
    if (!el || state.canvas.width <= 0) return;

    const cw = state.canvas.width;
    const ch = state.canvas.height;

    const applyFit = () => {
      if (zoomUserAdjustedRef.current) return;
      const z = fitZoom(getScrollAreaInnerWidth(el), getScrollAreaInnerHeight(el), cw, ch);
      if (z === null) return;
      dispatch(setZoom(z, "auto"));
    };

    applyFit();
    const ro = new ResizeObserver(applyFit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [dispatch, state.canvas.width, state.canvas.height]);

  function clientToCanvas(clientX: number, clientY: number): { x: number; y: number } {
    const el = canvasInnerRef.current;
    if (!el) return { x: 0, y: 0 };
    const rect = el.getBoundingClientRect();
    const z = state.zoom > 0 ? state.zoom : 1;
    return {
      x: (clientX - rect.left) / z,
      y: (clientY - rect.top) / z,
    };
  }

  const zw = state.canvas.width * state.zoom;
  const zh = state.canvas.height * state.zoom;

  const onWorkAreaPointerDownCapture = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    if (!(canvasToolRef.current === "hand" || spaceHeldRef.current)) return;
    const wa = workAreaRef.current;
    if (!wa) return;
    e.preventDefault();
    e.stopPropagation();
    panScrollRef.current = {
      pointerId: e.pointerId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startScrollLeft: wa.scrollLeft,
      startScrollTop: wa.scrollTop,
    };
    setIsPanningScroll(true);
    try {
      wa.setPointerCapture(e.pointerId);
    } catch {
      /* noop */
    }
  }, []);

  const onWorkAreaPointerMove = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    const s = panScrollRef.current;
    if (!s || e.pointerId !== s.pointerId) return;
    const wa = workAreaRef.current;
    if (!wa) return;
    const dx = e.clientX - s.startClientX;
    const dy = e.clientY - s.startClientY;
    wa.scrollLeft = s.startScrollLeft - dx;
    wa.scrollTop = s.startScrollTop - dy;
  }, []);

  const endWorkAreaPan = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    const s = panScrollRef.current;
    if (!s || e.pointerId !== s.pointerId) return;
    panScrollRef.current = null;
    setIsPanningScroll(false);
    try {
      workAreaRef.current?.releasePointerCapture(e.pointerId);
    } catch {
      /* noop */
    }
  }, []);

  const handOrSpacePan = canvasTool === "hand" || spaceHeld;
  const marqueeLayerCursor = textMode
    ? "text"
    : handOrSpacePan
      ? isPanningScroll
        ? "grabbing"
        : "grab"
      : "crosshair";
  const workAreaCursor = isPanningScroll
    ? "grabbing"
    : canvasTool === "hand" || spaceHeld
      ? "grab"
      : "default";

  return (
    <div
      className={cn("flex min-h-0 min-w-0 flex-1 flex-col", className)}
      data-testid="template-v2-canvas"
    >
      {/* Área de trabajo: gris suave. El lienzo se centra; el marco tiene el tamaño *ya escalado* para no duplicar altura en el scroll (bug: hijo con width/height en px + scale ocupaba layout completo). */}
      <div
        ref={workAreaRef}
        className="flex min-h-0 w-full min-w-0 flex-1 items-center justify-center overflow-auto bg-[color:var(--te-line)] px-3 py-4 sm:px-5 sm:py-6 md:px-8 md:py-8"
        style={{ cursor: workAreaCursor }}
        onPointerDownCapture={onWorkAreaPointerDownCapture}
        onPointerMove={onWorkAreaPointerMove}
        onPointerUp={endWorkAreaPan}
        onPointerCancel={endWorkAreaPan}
        onLostPointerCapture={() => {
          panScrollRef.current = null;
          setIsPanningScroll(false);
        }}
      >
        <div
          className="relative shrink-0 overflow-hidden rounded-md bg-white shadow-[0_2px_14px_rgba(15,23,42,0.07)] ring-1 ring-slate-900/[0.07]"
          style={{ width: zw, height: zh }}
          title={`Lienzo ${Math.round(state.canvas.width)}×${Math.round(state.canvas.height)} px · zoom ${Math.round(state.zoom * 100)}%`}
          aria-label="Lienzo de la plantilla"
          onClick={(e) => {
            if (suppressNextBackgroundClickRef.current) {
              suppressNextBackgroundClickRef.current = false;
              return;
            }
            if (dragRef.current?.moved) return;
            if (e.shiftKey) return;
            dispatch(selectBlock(null));
            onCanvasBackgroundClick?.();
          }}
        >
          <div
            ref={canvasInnerRef}
            style={{
              transform: `scale(${state.zoom})`,
              transformOrigin: "top left",
              width: state.canvas.width,
              height: state.canvas.height,
              position: "relative",
            }}
          >
            <TemplateCanvasRenderer
              canvas={state.canvas}
              blocks={blocksOnPage}
              readOnly
              resolvedVariables={TEMPLATE_V2_EDITOR_RESOLVED_VARIABLES}
              selectedBlockIds={state.selectedBlockIds}
              primarySelectedBlockId={primaryId}
              diagnosticHighlightByBlockId={diagnosticHighlightByBlockId}
              hideTextBodyForBlockId={editingTextBlockId}
            />

            {showSafeArea ? (
              <div
                className="pointer-events-none absolute inset-0 z-[2]"
                aria-hidden
                title="Zona segura (solo guía, no se imprime en preview)"
              >
                <div
                  style={{
                    position: "absolute",
                    left: safeAreaRect.x,
                    top: safeAreaRect.y,
                    width: safeAreaRect.width,
                    height: safeAreaRect.height,
                    boxSizing: "border-box",
                    border: "1px dashed rgba(194, 123, 61, 0.45)",
                    borderRadius: 2,
                    boxShadow: "inset 0 0 0 1px rgba(194, 123, 61, 0.08)",
                  }}
                />
              </div>
            ) : null}

            {showCenterAxes ? (
              <div
                className="pointer-events-none absolute inset-0 z-[2]"
                aria-hidden
                title="Ejes del centro del lienzo (solo referencia; el snap activo usa azul más intenso al arrastrar)"
              >
                <div
                  style={{
                    position: "absolute",
                    left: centerAxes.cx,
                    top: 0,
                    width: 1,
                    height: "100%",
                    transform: "translateX(-0.5px)",
                    background: "rgba(100, 116, 139, 0.28)",
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    top: centerAxes.cy,
                    left: 0,
                    height: 1,
                    width: "100%",
                    transform: "translateY(-0.5px)",
                    background: "rgba(100, 116, 139, 0.28)",
                  }}
                />
              </div>
            ) : null}

            {/* Fondo: marquee de selección o colocación de texto (herramienta T). */}
            <div
              className="absolute inset-0 z-[1] select-none"
              style={{ cursor: marqueeLayerCursor, touchAction: "none" }}
              aria-hidden
              onPointerDown={(e) => {
                if (e.button !== 0) return;
                if (resizeRef.current || rotateRef.current || dragRef.current) return;
                e.preventDefault();
                const { x, y } = clientToCanvas(e.clientX, e.clientY);
                if (textMode) {
                  textPlaceSessionRef.current = { pointerId: e.pointerId, startX: x, startY: y };
                  setTextPlaceRect({ ax: x, ay: y, bx: x, by: y });
                  (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
                  return;
                }
                marqueeSessionRef.current = {
                  pointerId: e.pointerId,
                  shiftKey: e.shiftKey,
                  startX: x,
                  startY: y,
                };
                setMarqueeRect({ ax: x, ay: y, bx: x, by: y });
                (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
              }}
              onPointerMove={(e) => {
                if (textMode) {
                  const s = textPlaceSessionRef.current;
                  if (!s || s.pointerId !== e.pointerId) return;
                  const { x, y } = clientToCanvas(e.clientX, e.clientY);
                  setTextPlaceRect({ ax: s.startX, ay: s.startY, bx: x, by: y });
                  return;
                }
                const s = marqueeSessionRef.current;
                if (!s || s.pointerId !== e.pointerId) return;
                const { x, y } = clientToCanvas(e.clientX, e.clientY);
                setMarqueeRect({ ax: s.startX, ay: s.startY, bx: x, by: y });
              }}
              onPointerUp={(e) => {
                if (textMode) {
                  const s = textPlaceSessionRef.current;
                  if (!s || s.pointerId !== e.pointerId) return;
                  try {
                    (e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId);
                  } catch {
                    /* noop */
                  }
                  textPlaceSessionRef.current = null;
                  const { x: bx, y: by } = clientToCanvas(e.clientX, e.clientY);
                  const dragDist = Math.hypot(bx - s.startX, by - s.startY);
                  setTextPlaceRect(null);
                  const ap = state.activePageIndex ?? 0;
                  const onPage = state.blocks.filter((b) => (b.pageIndex ?? 0) === ap);
                  if (dragDist < MARQUEE_MIN_DRAG_CANVAS_PX) {
                    const block = createPointTextBlockAt(state.canvas, onPage, ap, s.startX, s.startY);
                    dispatch(addBlock(block));
                    suppressNextBackgroundClickRef.current = true;
                    queueMicrotask(() => setEditingTextBlockId(block.id));
                  } else {
                    const left = Math.min(s.startX, bx);
                    const top = Math.min(s.startY, by);
                    const width = Math.abs(bx - s.startX);
                    const height = Math.abs(by - s.startY);
                    const block = createAreaTextBlockInRect(state.canvas, onPage, ap, left, top, width, height);
                    dispatch(addBlock(block));
                    suppressNextBackgroundClickRef.current = true;
                    queueMicrotask(() => setEditingTextBlockId(block.id));
                  }
                  return;
                }
                const s = marqueeSessionRef.current;
                if (!s || s.pointerId !== e.pointerId) return;
                try {
                  (e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId);
                } catch {
                  /* noop */
                }
                marqueeSessionRef.current = null;
                const { x: bx, y: by } = clientToCanvas(e.clientX, e.clientY);
                const dragDist = Math.hypot(bx - s.startX, by - s.startY);
                setMarqueeRect(null);
                if (dragDist < MARQUEE_MIN_DRAG_CANVAS_PX) {
                  return;
                }
                const left = Math.min(s.startX, bx);
                const top = Math.min(s.startY, by);
                const width = Math.abs(bx - s.startX);
                const height = Math.abs(by - s.startY);
                const found = collectMarqueeHits(blocksOnPage, left, top, width, height);
                if (s.shiftKey) {
                  dispatch(setSelectedBlockIds(mergeSelectionIds(state.selectedBlockIds, found)));
                } else {
                  dispatch(setSelectedBlockIds(found));
                }
                suppressNextBackgroundClickRef.current = true;
              }}
              onPointerCancel={(e) => {
                if (textMode) {
                  const s = textPlaceSessionRef.current;
                  if (!s || s.pointerId !== e.pointerId) return;
                  try {
                    (e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId);
                  } catch {
                    /* noop */
                  }
                  textPlaceSessionRef.current = null;
                  setTextPlaceRect(null);
                  return;
                }
                const s = marqueeSessionRef.current;
                if (!s || s.pointerId !== e.pointerId) return;
                try {
                  (e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId);
                } catch {
                  /* noop */
                }
                marqueeSessionRef.current = null;
                setMarqueeRect(null);
              }}
            />

            {/* Capa de hit-target para selección simple por click */}
            {orderedVisibleBlocks.map((b) => {
              const hitSelected = state.selectedBlockIds.includes(b.id);
              const isTextKind = b.type === "TEXT" || b.type === "VARIABLE_TEXT";
              return (
              <button
                key={`hit-${b.id}`}
                type="button"
                aria-label={
                  isTextKind && !b.layout.locked
                    ? `Seleccionar o editar texto (doble clic para escribir) · ${b.id}`
                    : `Seleccionar bloque ${b.id}`
                }
                className={cn(
                  "select-none transition-[box-shadow] duration-150 ease-out",
                  !hitSelected && !b.layout.locked && "hover:shadow-[inset_0_0_0_1px_rgba(148,163,184,0.5)]"
                )}
                onClick={(e) => {
                  e.stopPropagation();
                }}
                onDoubleClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (b.layout.locked) return;
                  if (!isTextKind) return;
                  dragRef.current = null;
                  altDuplicateGestureRef.current = false;
                  gesturePersistSnapshotRef.current = null;
                  setDraggingBlockId(null);
                  textEditStartSnapshotRef.current = takePersistSnapshot(state);
                  dispatch(selectBlock(b.id));
                  setEditingTextBlockId(b.id);
                }}
                style={{
                  ...getOverlayStyle(b),
                  border: "none",
                  background: "transparent",
                  pointerEvents: editingTextBlockId === b.id ? "none" : "auto",
                  cursor: b.layout.locked
                    ? "not-allowed"
                    : draggingBlockId === b.id
                      ? "grabbing"
                      : isTextKind
                        ? "grab"
                        : "grab",
                  padding: 0,
                  touchAction: "none",
                }}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  if (editingTextBlockId === b.id) return;
                  if (resizeRef.current || rotateRef.current) return;
                  if (e.shiftKey) {
                    dispatch(toggleBlockInSelection(b.id));
                    return;
                  }
                  if (b.layout.locked) {
                    dispatch(selectBlock(b.id));
                    return;
                  }

                  const altDragDup =
                    e.altKey || (typeof e.getModifierState === "function" && e.getModifierState("Alt"));

                  if (altDragDup) {
                    gesturePersistSnapshotRef.current = takePersistSnapshot(state);
                    const newId = createEditorBlockId();
                    altDuplicateGestureRef.current = true;
                    flushSync(() => {
                      dispatch(
                        duplicateBlock(b.id, {
                          samePosition: true,
                          newBlockId: newId,
                          skipHistory: true,
                        })
                      );
                    });
                    (e.currentTarget as HTMLButtonElement).setPointerCapture(e.pointerId);
                    dragRef.current = {
                      pointerId: e.pointerId,
                      blockId: newId,
                      startClientX: e.clientX,
                      startClientY: e.clientY,
                      startX: b.layout.x,
                      startY: b.layout.y,
                      blockWidth: b.layout.width,
                      blockHeight: b.layout.height,
                      moved: false,
                    };
                    setDraggingBlockId(newId);
                    return;
                  }

                  dispatch(selectBlock(b.id));
                  gesturePersistSnapshotRef.current = takePersistSnapshot(state);
                  (e.currentTarget as HTMLButtonElement).setPointerCapture(e.pointerId);
                  dragRef.current = {
                    pointerId: e.pointerId,
                    blockId: b.id,
                    startClientX: e.clientX,
                    startClientY: e.clientY,
                    startX: b.layout.x,
                    startY: b.layout.y,
                    blockWidth: b.layout.width,
                    blockHeight: b.layout.height,
                    moved: false,
                  };
                  setDraggingBlockId(b.id);
                }}
                onPointerMove={(e) => {
                  if (resizeRef.current || rotateRef.current) return;
                  const drag = dragRef.current;
                  if (!drag || drag.pointerId !== e.pointerId) return;
                  const blockId = drag.blockId;
                  const zoom = state.zoom > 0 ? state.zoom : 1;
                  const deltaX = (e.clientX - drag.startClientX) / zoom;
                  const deltaY = (e.clientY - drag.startClientY) / zoom;
                  if (!drag.moved && (Math.abs(deltaX) > 1 || Math.abs(deltaY) > 1)) {
                    drag.moved = true;
                  }
                  const rawX = drag.startX + deltaX;
                  const rawY = drag.startY + deltaY;
                  const snapped = snapDragPosition(
                    state.canvas.width,
                    state.canvas.height,
                    drag.blockWidth,
                    drag.blockHeight,
                    rawX,
                    rawY,
                    blockId,
                    blocksOnPage
                  );
                  setSnapGuides({ vx: snapped.guideVerticalX, hy: snapped.guideHorizontalY });
                  dispatch(
                    updateBlock(
                      blockId,
                      {
                        layout: {
                          x: snapped.x,
                          y: snapped.y,
                        },
                      },
                      { skipHistory: true }
                    )
                  );
                }}
                onPointerUp={(e) => {
                  const drag = dragRef.current;
                  if (!drag || drag.pointerId !== e.pointerId) return;
                  e.stopPropagation();
                  const wasAltDup = altDuplicateGestureRef.current;
                  altDuplicateGestureRef.current = false;
                  if (drag.moved || wasAltDup) {
                    suppressNextBackgroundClickRef.current = true;
                    const snap = gesturePersistSnapshotRef.current;
                    if (snap) {
                      dispatch(commitHistoryCheckpoint(snap));
                    }
                  }
                  gesturePersistSnapshotRef.current = null;
                  dragRef.current = null;
                  setDraggingBlockId(null);
                  setSnapGuides({ vx: null, hy: null });
                }}
                onPointerCancel={() => {
                  altDuplicateGestureRef.current = false;
                  gesturePersistSnapshotRef.current = null;
                  dragRef.current = null;
                  setDraggingBlockId(null);
                  setSnapGuides({ vx: null, hy: null });
                }}
              />
            );
            })}

            {/* Marco y handles solo en el bloque primario; el resto de seleccionados llevan outline en el renderer. */}
            {primaryBlock && editingTextBlockId !== primaryBlock.id ? (
              <div
                style={{
                  ...getOverlayStyle(primaryBlock),
                  boxSizing: "border-box",
                  border: primaryBlock.layout.locked
                    ? "2px dashed var(--te-danger)"
                    : primarySafeAreaStatus !== "inside"
                      ? "2px solid var(--te-danger)"
                      : "2px solid var(--te-accent)",
                  boxShadow: primaryBlock.layout.locked
                    ? "0 0 0 1px rgba(255,255,255,0.45) inset, 0 2px 14px rgba(180, 83, 9, 0.28)"
                    : primarySafeAreaStatus !== "inside"
                      ? "0 0 0 1px rgba(255,255,255,0.35) inset, 0 3px 16px rgba(245, 158, 11, 0.38)"
                      : "0 0 0 1px rgba(255,255,255,0.85) inset, 0 0 0 1px var(--te-accent), 0 4px 18px rgba(0,0,0,0.28)",
                  transition: "box-shadow 160ms ease, border-color 160ms ease",
                  pointerEvents: "none",
                }}
              >
                {!primaryBlock.layout.locked ? (
                  <>
                    <div
                      style={{
                        position: "absolute",
                        left: "50%",
                        top: 0,
                        transform: "translateX(-50%)",
                        width: 0,
                        height: 0,
                        pointerEvents: "none",
                      }}
                    >
                      <div
                        style={{
                          position: "absolute",
                          left: "50%",
                          top: -26,
                          marginLeft: -1,
                          width: 2,
                          height: 26,
                          borderRadius: 1,
                          background: "linear-gradient(to top, var(--te-accent), var(--te-accent))",
                          opacity: 0.9,
                          pointerEvents: "none",
                        }}
                      />
                      <button
                        type="button"
                        aria-label="Rotar bloque"
                        title="Rotar"
                        style={{
                          position: "absolute",
                          left: "50%",
                          top: -36,
                          width: 20,
                          height: 20,
                          marginLeft: -10,
                          marginTop: -10,
                          borderRadius: 9999,
                          border: "2.5px solid var(--te-accent)",
                          background: "var(--te-surface)",
                          cursor: rotatingBlockId === primaryBlock.id ? "grabbing" : "grab",
                          pointerEvents: "auto",
                          boxShadow:
                            "0 1px 2px rgba(255,255,255,0.95) inset, 0 2px 10px rgba(0,0,0,0.32)",
                          transition: "box-shadow 150ms ease, transform 150ms ease",
                          touchAction: "none",
                        }}
                        onPointerDown={(e) => {
                          e.stopPropagation();
                          if (resizeRef.current) return;
                          gesturePersistSnapshotRef.current = takePersistSnapshot(state);
                          const l = primaryBlock.layout;
                          const cx = l.x + l.width / 2;
                          const cy = l.y + l.height / 2;
                          const { x: px, y: py } = clientToCanvas(e.clientX, e.clientY);
                          (e.currentTarget as HTMLButtonElement).setPointerCapture(e.pointerId);
                          const startRad = Math.atan2(py - cy, px - cx);
                          rotateRef.current = {
                            pointerId: e.pointerId,
                            blockId: primaryBlock.id,
                            centerX: cx,
                            centerY: cy,
                            lastAngleRad: startRad,
                            rotationAccumDeg: normalizeRotationDeg(l.rotation),
                            moved: false,
                          };
                          setRotatingBlockId(primaryBlock.id);
                        }}
                        onPointerMove={(e) => {
                          const rz = rotateRef.current;
                          if (!rz || rz.pointerId !== e.pointerId || rz.blockId !== primaryBlock.id) return;
                          e.stopPropagation();
                          const { x: px, y: py } = clientToCanvas(e.clientX, e.clientY);
                          const angle = Math.atan2(py - rz.centerY, px - rz.centerX);
                          const deltaRad = unwrapAngleDeltaRad(rz.lastAngleRad, angle);
                          rz.lastAngleRad = angle;
                          if (!rz.moved && Math.abs(deltaRad) > 0.005) {
                            rz.moved = true;
                          }
                          rz.rotationAccumDeg = normalizeRotationDeg(
                            rz.rotationAccumDeg + (deltaRad * 180) / Math.PI
                          );
                          const nextDeg = rz.rotationAccumDeg;
                          dispatch(
                            updateBlock(
                              primaryBlock.id,
                              {
                                layout: { rotation: nextDeg },
                              },
                              { skipHistory: true }
                            )
                          );
                        }}
                        onPointerUp={(e) => {
                          const rz = rotateRef.current;
                          if (!rz || rz.pointerId !== e.pointerId || rz.blockId !== primaryBlock.id) return;
                          e.stopPropagation();
                          if (rz.moved) {
                            suppressNextBackgroundClickRef.current = true;
                            const snap = gesturePersistSnapshotRef.current;
                            if (snap) dispatch(commitHistoryCheckpoint(snap));
                          }
                          gesturePersistSnapshotRef.current = null;
                          rotateRef.current = null;
                          setRotatingBlockId(null);
                        }}
                        onPointerCancel={() => {
                          gesturePersistSnapshotRef.current = null;
                          rotateRef.current = null;
                          setRotatingBlockId(null);
                        }}
                      />
                    </div>
                    {RESIZE_HANDLES.map((h) => {
                      const primaryIsTextKind =
                        primaryBlock.type === "TEXT" || primaryBlock.type === "VARIABLE_TEXT";
                      return (
                      <button
                        key={`resize-${h.key}`}
                        type="button"
                        aria-label={
                          primaryIsTextKind
                            ? `Redimensionar texto (${h.key})`
                            : `Redimensionar bloque (${h.key})`
                        }
                        title={
                          primaryIsTextKind
                            ? "Arrastrá para escalar caja y tipografía. Mayús = proporción · Alt/⌥ = desde el centro. Barra superior = px exactos."
                            : "Mayús = proporción · Alt/⌥ = desde el centro"
                        }
                        style={{
                          position: "absolute",
                          width: RESIZE_HANDLE_SIZE_PX,
                          height: RESIZE_HANDLE_SIZE_PX,
                          borderRadius: 9999,
                          border: "2.5px solid var(--te-accent)",
                          background: "var(--te-surface)",
                          cursor: h.cursor,
                          pointerEvents: "auto",
                          boxShadow:
                            "0 1px 2px rgba(255,255,255,0.9) inset, 0 2px 8px rgba(0,0,0,0.30)",
                          transition: "box-shadow 150ms ease",
                          touchAction: "none",
                          ...(h.left !== undefined ? { left: h.left } : {}),
                          ...(h.right !== undefined ? { right: h.right } : {}),
                          ...(h.top !== undefined ? { top: h.top } : {}),
                          ...(h.bottom !== undefined ? { bottom: h.bottom } : {}),
                        }}
                        onPointerDown={(e) => {
                          e.stopPropagation();
                          if (rotateRef.current) return;
                          gesturePersistSnapshotRef.current = takePersistSnapshot(state);
                          (e.currentTarget as HTMLButtonElement).setPointerCapture(e.pointerId);
                          const isTextKind =
                            primaryBlock.type === "TEXT" || primaryBlock.type === "VARIABLE_TEXT";
                          const nb = normalizeBlockConfig(primaryBlock.type, primaryBlock.configJson) as {
                            fontSize?: number;
                          };
                          const startFs =
                            typeof nb.fontSize === "number" && Number.isFinite(nb.fontSize) ? nb.fontSize : 20;
                          resizeRef.current = {
                            pointerId: e.pointerId,
                            blockId: primaryBlock.id,
                            handle: h.key,
                            startClientX: e.clientX,
                            startClientY: e.clientY,
                            startX: primaryBlock.layout.x,
                            startY: primaryBlock.layout.y,
                            startWidth: primaryBlock.layout.width,
                            startHeight: primaryBlock.layout.height,
                            moved: false,
                            scaleTypography: isTextKind,
                            startFontSize: startFs,
                            startConfigJson: { ...asBlockConfigJson(primaryBlock) },
                          };
                        }}
                        onPointerMove={(e) => {
                          const rz = resizeRef.current;
                          if (!rz || rz.pointerId !== e.pointerId || rz.blockId !== primaryBlock.id) return;
                          e.stopPropagation();
                          const zoom = state.zoom > 0 ? state.zoom : 1;
                          const dx = (e.clientX - rz.startClientX) / zoom;
                          const dy = (e.clientY - rz.startClientY) / zoom;
                          if (!rz.moved && (Math.abs(dx) > 1.5 || Math.abs(dy) > 1.5)) {
                            rz.moved = true;
                          }
                          const next = computeResizeRect(
                            rz.handle,
                            {
                              x: rz.startX,
                              y: rz.startY,
                              width: rz.startWidth,
                              height: rz.startHeight,
                            },
                            dx,
                            dy,
                            { shift: e.shiftKey, alt: e.altKey }
                          );
                          const layoutPatch = {
                            x: next.x,
                            y: next.y,
                            width: next.width,
                            height: next.height,
                          };
                          if (
                            rz.scaleTypography &&
                            rz.startWidth > 0 &&
                            rz.startHeight > 0
                          ) {
                            const rw = next.width / rz.startWidth;
                            const rh = next.height / rz.startHeight;
                            const scale = Math.sqrt(Math.max(1e-9, rw * rh));
                            const newFs = Math.round(
                              Math.max(8, Math.min(400, rz.startFontSize * scale))
                            );
                            dispatch(
                              updateBlock(
                                rz.blockId,
                                {
                                  layout: layoutPatch,
                                  configJson: {
                                    ...rz.startConfigJson,
                                    fontSize: newFs,
                                  },
                                },
                                { skipHistory: true }
                              )
                            );
                          } else {
                            dispatch(
                              updateBlock(
                                rz.blockId,
                                { layout: layoutPatch },
                                { skipHistory: true }
                              )
                            );
                          }
                        }}
                        onPointerUp={(e) => {
                          const rz = resizeRef.current;
                          if (!rz || rz.pointerId !== e.pointerId || rz.blockId !== primaryBlock.id) return;
                          e.stopPropagation();
                          if (rz.moved) {
                            suppressNextBackgroundClickRef.current = true;
                            const snap = gesturePersistSnapshotRef.current;
                            if (snap) dispatch(commitHistoryCheckpoint(snap));
                          }
                          gesturePersistSnapshotRef.current = null;
                          resizeRef.current = null;
                        }}
                        onPointerCancel={() => {
                          gesturePersistSnapshotRef.current = null;
                          resizeRef.current = null;
                        }}
                      />
                      );
                    })}
                  </>
                ) : null}
                {primaryBlock.layout.locked ? (
                  <div
                    style={{
                      position: "absolute",
                      top: -18,
                      right: 0,
                      fontSize: 10,
                      background: "var(--te-accent-wash)",
                      color: "var(--te-accent)",
                      border: "1px solid var(--te-danger)",
                      borderRadius: 9999,
                      padding: "2px 6px",
                    }}
                  >
                    LOCKED
                  </div>
                ) : null}
                {rotatingBlockId === primaryBlock.id ? (
                  <div
                    style={{
                      position: "absolute",
                      left: 0,
                      right: 0,
                      bottom: -20,
                      textAlign: "center",
                      fontSize: 10,
                      color: "var(--te-accent)",
                      pointerEvents: "none",
                    }}
                  >
                    rotando…
                  </div>
                ) : null}
              </div>
            ) : null}

            {editingTextBlock &&
            (editingTextBlock.type === "TEXT" || editingTextBlock.type === "VARIABLE_TEXT") &&
            !editingTextBlock.layout.locked ? (
              <div
                style={{
                  ...getOverlayStyle(editingTextBlock),
                  zIndex: editingTextBlock.layout.zIndex + 100000,
                  pointerEvents: "auto",
                }}
              >
                <InlineTextEditOverlay
                  block={editingTextBlock}
                  dispatch={dispatch}
                  onEnd={endInlineTextEdit}
                  canvasWidth={state.canvas.width}
                  resolvedVariables={TEMPLATE_V2_EDITOR_RESOLVED_VARIABLES}
                />
              </div>
            ) : null}

            {draggingBlockId !== null && (snapGuides.vx != null || snapGuides.hy != null) ? (
              <div className="pointer-events-none" style={{ position: "absolute", inset: 0, zIndex: 99990 }} aria-hidden>
                {snapGuides.vx != null ? (
                  <div
                    style={{
                      position: "absolute",
                      left: snapGuides.vx,
                      top: 0,
                      width: 2,
                      height: "100%",
                      transform: "translateX(-0.5px)",
                      background: "rgba(59, 130, 246, 0.92)",
                      boxShadow: "0 0 0 1px rgba(255,255,255,0.75)",
                    }}
                  />
                ) : null}
                {snapGuides.hy != null ? (
                  <div
                    style={{
                      position: "absolute",
                      top: snapGuides.hy,
                      left: 0,
                      height: 2,
                      width: "100%",
                      transform: "translateY(-0.5px)",
                      background: "rgba(59, 130, 246, 0.92)",
                      boxShadow: "0 0 0 1px rgba(255,255,255,0.75)",
                    }}
                  />
                ) : null}
              </div>
            ) : null}

            {marqueeRect ? (
              <div
                style={{
                  position: "absolute",
                  left: Math.min(marqueeRect.ax, marqueeRect.bx),
                  top: Math.min(marqueeRect.ay, marqueeRect.by),
                  width: Math.abs(marqueeRect.bx - marqueeRect.ax),
                  height: Math.abs(marqueeRect.by - marqueeRect.ay),
                  border: "1.5px solid var(--te-accent)",
                  background: "rgba(59, 130, 246, 0.14)",
                  pointerEvents: "none",
                  zIndex: 99999,
                  boxSizing: "border-box",
                }}
                aria-hidden
              />
            ) : null}

            {textPlaceRect ? (
              <div
                style={{
                  position: "absolute",
                  left: Math.min(textPlaceRect.ax, textPlaceRect.bx),
                  top: Math.min(textPlaceRect.ay, textPlaceRect.by),
                  width: Math.abs(textPlaceRect.bx - textPlaceRect.ax),
                  height: Math.abs(textPlaceRect.by - textPlaceRect.ay),
                  border: "1.5px solid rgba(5, 150, 105, 0.95)",
                  background: "rgba(16, 185, 129, 0.12)",
                  pointerEvents: "none",
                  zIndex: 99998,
                  boxSizing: "border-box",
                }}
                aria-hidden
              />
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
