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
import { ImageCropOverlay } from "./ImageCropOverlay";
import { getCanvasCenterPoint } from "@repo/template-editor-core";
import { getSafeAreaRectPx } from "@repo/template-editor-core";
import { getLayoutSafeAreaStatus, type LayoutSafeAreaStatus } from "@repo/template-editor-core";
import { buildDiagnosticHighlightMap, collectTemplateDiagnostics } from "@repo/template-editor-core";
import {
  getTextVisualConfig,
  normalizeBlockConfig,
  readTextVerticalAlign,
} from "@repo/template-editor-core";
import type { TemplateV2Block } from "@repo/template-editor-core";
import { measureTextBlockBoundsPx } from "@repo/template-editor-core";
import {
  buildSnapGuideLines,
  SNAP_SCREEN_PX,
  snapDragPosition,
  snapResizeRect,
} from "@repo/template-editor-core";
import { normalizeRotationDeg, unwrapAngleDeltaRad } from "@repo/template-editor-core";
import {
  addBlock,
  commitHistoryCheckpoint,
  createEditorBlockId,
  duplicateBlock,
  getPrimarySelectedBlockId,
  selectBlock,
  blocksAtPoint,
  nextBlockInStack,
  selectionBounds,
  offsetsWithinSelection,
  setSelectedBlockIds,
  setZoom,
  clampZoom,
  addGuide,
  isGuideInsideCanvas,
  moveGuide,
  readGuides,
  removeGuide,
  setGuides,
  type EditorGuides,
  type GuideAxis,
  takePersistSnapshot,
  toggleBlockInSelection,
  updateBlock,
  type TemplateV2EditorDispatch,
  type TemplateV2EditorState,
} from "@repo/template-editor-core";
import { TEMPLATE_V2_EDITOR_RESOLVED_VARIABLES, isClassListConfig } from "@repo/template-editor-core";
import {
  notifyTemplateTextEditingBlockId,
  registerTemplateTextInsert,
} from "@repo/template-editor-core";
import { createAreaTextBlockInRect, createPointTextBlockAt } from "@repo/template-editor-core";
import {
  canvasDpi,
  computeResizeRectRotated,
  isResizeEdge,
  snapRotationDeg,
  describeAspect,
  findAspectPreset,
  formatBlockSize,
  getBlockAspectLock,
} from "@repo/template-editor-core";
import { useBlockSizeUnit } from "./useBlockSizeUnit";
import {
  TEMPLATE_V2_RESET_WORK_SCROLL_EVENT,
  type TemplateEditorCanvasTool,
} from "@repo/template-editor-core";
import { cn } from "./primitives/cn";
import { PAPER_TOKENS } from "./theme";
import { EditorRuler, RULER_SIZE_PX } from "./EditorRuler";

function isEditableKeyboardTarget(target: EventTarget | null): boolean {
  if (!target || !(target instanceof Element)) return false;
  return Boolean(target.closest("input, textarea, select, [contenteditable='true'], [contenteditable='']"));
}

type Props = {
  state: TemplateV2EditorState;
  dispatch: TemplateV2EditorDispatch;
  className?: string;
  /**
   * Valores de muestra con que el lienzo resuelve las variables, según la plataforma de la
   * plantilla. Sin esto el lienzo usaba siempre los de escuela, y en FotoOffice o FotoRank los
   * datos aparecían como `{clave}` y las imágenes atadas a un dato como "Imagen libre".
   */
  resolvedVariables?: Record<string, unknown>;
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

type ResizeHandleDef = {
  key: "nw" | "ne" | "sw" | "se" | "n" | "s" | "e" | "w";
  cursor: "nwse-resize" | "nesw-resize" | "ns-resize" | "ew-resize";
  left?: number | string;
  right?: number;
  top?: number | string;
  bottom?: number;
};

/** Diámetro del control de esquina (área de agarre). Tamaño tipo diseñadores estándar (Canva/Figma). */
const RESIZE_HANDLE_SIZE_PX = 32;
const RESIZE_HANDLE_INSET = -RESIZE_HANDLE_SIZE_PX / 2;

const MEDIO = `calc(50% - ${RESIZE_HANDLE_SIZE_PX / 2}px)`;

const RESIZE_HANDLES: ResizeHandleDef[] = [
  { key: "nw", left: RESIZE_HANDLE_INSET, top: RESIZE_HANDLE_INSET, cursor: "nwse-resize" },
  { key: "ne", right: RESIZE_HANDLE_INSET, top: RESIZE_HANDLE_INSET, cursor: "nesw-resize" },
  { key: "sw", left: RESIZE_HANDLE_INSET, bottom: RESIZE_HANDLE_INSET, cursor: "nesw-resize" },
  { key: "se", right: RESIZE_HANDLE_INSET, bottom: RESIZE_HANDLE_INSET, cursor: "nwse-resize" },
  /*
   * Medio de cada lado: estiran en una sola dirección, como en Photoshop. Desde una esquina con la
   * proporción fijada no había forma de alargar una foto hacia un solo lado para llenar un hueco.
   */
  { key: "n", left: MEDIO, top: RESIZE_HANDLE_INSET, cursor: "ns-resize" },
  { key: "s", left: MEDIO, bottom: RESIZE_HANDLE_INSET, cursor: "ns-resize" },
  { key: "w", left: RESIZE_HANDLE_INSET, top: MEDIO, cursor: "ew-resize" },
  { key: "e", right: RESIZE_HANDLE_INSET, top: MEDIO, cursor: "ew-resize" },
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

/**
 * Medida del recuadro mientras se estira: "85 × 55 mm · 3:2". Vive dentro del lienzo escalado,
 * así que se contra-escala con el zoom para leerse siempre del mismo tamaño.
 */
function BlockSizeBadge({
  width,
  height,
  unit,
  dpi,
  zoom,
}: {
  width: number;
  height: number;
  unit: Parameters<typeof formatBlockSize>[2];
  dpi: number;
  zoom: number;
}) {
  const z = zoom > 0 ? zoom : 1;
  const preset = findAspectPreset(width, height);
  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: "100%",
        transform: `translate(-50%, ${10 / z}px) scale(${1 / z})`,
        transformOrigin: "top center",
        whiteSpace: "nowrap",
        pointerEvents: "none",
        fontSize: 11,
        fontWeight: 600,
        lineHeight: 1,
        padding: "4px 7px",
        borderRadius: 6,
        background: "var(--te-accent)",
        color: "#fff",
        boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
        fontVariantNumeric: "tabular-nums",
      }}
    >
      {formatBlockSize(width, height, unit, dpi)}
      <span style={{ opacity: preset ? 1 : 0.75, fontWeight: preset ? 600 : 400 }}>
        {" · "}
        {describeAspect(width, height)}
      </span>
    </div>
  );
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

  /** Centro y abajo: mientras se escribe, el texto queda donde va a quedar al terminar. */
  const alineadoVertical = t.verticalAlign !== "top";

  const editable = (
    <div
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      spellCheck={false}
      data-template-inline-text="1"
      style={{
        width: "100%",
        height: alineadoVertical ? "auto" : "100%",
        ...(alineadoVertical ? { maxHeight: "100%", flexShrink: 0 } : {}),
        color: t.color,
        fontFamily: t.fontFamilyCss,
        fontSize: t.fontSize,
        fontWeight: t.fontWeight,
        fontStyle: t.fontStyle,
        textDecoration: t.textDecoration,
        textTransform: t.textTransform,
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
                /*
                 * Con el texto centrado o abajo, la caja es el espacio donde se alinea: escribir no
                 * la achica al alto del texto (si no, la alineación dejaría de tener efecto).
                 * Sólo crece si el texto ya no entra.
                 */
                height:
                  readTextVerticalAlign(patch) === "TOP"
                    ? bounds.height
                    : Math.max(cur.layout.height, bounds.height),
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

  if (!alineadoVertical) return editable;
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: t.verticalAlign === "middle" ? "center" : "flex-end",
      }}
    >
      {editable}
    </div>
  );
}

export function TemplateEditorCanvas({
  state,
  dispatch,
  className,
  resolvedVariables: valoresDeMuestra = TEMPLATE_V2_EDITOR_RESOLVED_VARIABLES,
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
  /** Foto que se está encuadrando (doble clic): el arrastre mueve la foto, no el marco. */
  const [croppingBlockId, setCroppingBlockId] = useState<string | null>(null);
  const cropStartSnapshotRef = useRef<ReturnType<typeof takePersistSnapshot> | null>(null);
  const textEditStartSnapshotRef = useRef<ReturnType<typeof takePersistSnapshot> | null>(null);
  const [rotatingBlockId, setRotatingBlockId] = useState<string | null>(null);
  /** Bloque que se está estirando: mientras dura el gesto, el recuadro muestra su medida. */
  const [resizingBlockId, setResizingBlockId] = useState<string | null>(null);
  const sizeUnit = useBlockSizeUnit();
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
    /**
     * Cuando se arrastra una selección de varios, esto guarda dónde estaba cada bloque respecto
     * de la caja del conjunto. Se calcula una vez al empezar: recalcularlo en cada movimiento
     * acumularía el redondeo del ajuste a guías y los bloques se irían separando entre ellos.
     */
    grupo: { id: string; dx: number; dy: number }[] | null;
  } | null>(null);
  const resizeRef = useRef<{
    pointerId: number;
    blockId: string;
    handle: ResizeHandleDef["key"];
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

  /** Termina el encuadre: todo el gesto queda como un solo paso para deshacer. */
  const endImageCrop = useCallback(() => {
    const snap = cropStartSnapshotRef.current;
    cropStartSnapshotRef.current = null;
    setCroppingBlockId(null);
    if (snap) dispatch(commitHistoryCheckpoint(snap));
  }, [dispatch]);

  const croppingBlock =
    croppingBlockId != null ? state.blocks.find((b) => b.id === croppingBlockId) ?? null : null;

  // Si la foto desaparece, cambia de hoja o se selecciona otra cosa, el encuadre termina solo.
  useEffect(() => {
    if (!croppingBlockId) return;
    const b = state.blocks.find((x) => x.id === croppingBlockId);
    if (!b || (b.pageIndex ?? 0) !== activePage || !state.selectedBlockIds.includes(croppingBlockId)) {
      queueMicrotask(endImageCrop);
    }
  }, [activePage, croppingBlockId, state.blocks, state.selectedBlockIds, endImageCrop]);

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

  /*
   * El ajuste automático del zoom vive en TemplateEditorShell (`ajustarALaVentana`), que hace
   * entrar la hoja entera. Acá había otro que sólo miraba el ancho: corría después y le ganaba,
   * y una hoja apaisada quedaba cortada abajo.
   */

  /*
   * Zoom con el gesto de pellizcar del trackpad o con Ctrl/⌘ + rueda, sólo sobre el área de
   * trabajo. Sin esto el navegador ampliaba la página entera, paneles incluidos. El punto de la
   * hoja que está bajo el puntero queda bajo el puntero, como en los editores de imagen.
   *
   * El listener va a mano y no como `onWheel` de React: React lo registra pasivo y entonces
   * `preventDefault` no frena el zoom del navegador.
   */
  const zoomRef = useRef(state.zoom);
  zoomRef.current = state.zoom;
  useEffect(() => {
    const area = workAreaRef.current;
    if (!area) return;

    function zoomAround(nextZoom: number, clientX: number, clientY: number) {
      const inner = canvasInnerRef.current;
      const wa = workAreaRef.current;
      const prev = zoomRef.current > 0 ? zoomRef.current : 1;
      const next = clampZoom(nextZoom);
      if (!inner || !wa || next === prev) return;
      const r = inner.getBoundingClientRect();
      // Punto de la hoja (en px del lienzo) que está bajo el puntero.
      const px = (clientX - r.left) / prev;
      const py = (clientY - r.top) / prev;
      // Se adelanta el valor: los pasos de un pellizco llegan antes de que React vuelva a dibujar.
      zoomRef.current = next;
      dispatch(setZoom(next, "user"));
      requestAnimationFrame(() => {
        const r2 = inner.getBoundingClientRect();
        wa.scrollLeft += r2.left + px * next - clientX;
        wa.scrollTop += r2.top + py * next - clientY;
      });
    }

    function onWheel(e: WheelEvent) {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      // El pellizco manda pasos chicos y la rueda pasos de ~100: se acota para que un clic de
      // rueda no salte demasiado.
      const delta = Math.max(-60, Math.min(60, e.deltaY));
      zoomAround(zoomRef.current * Math.exp(-delta * 0.005), e.clientX, e.clientY);
    }

    // Safari no manda el pellizco como rueda sino como `gesture*`.
    let gestureStartZoom = zoomRef.current;
    type GestureLike = Event & { scale: number; clientX: number; clientY: number };
    function onGestureStart(e: Event) {
      e.preventDefault();
      gestureStartZoom = zoomRef.current;
    }
    function onGestureChange(e: Event) {
      e.preventDefault();
      const g = e as GestureLike;
      zoomAround(gestureStartZoom * g.scale, g.clientX, g.clientY);
    }

    area.addEventListener("wheel", onWheel, { passive: false });
    area.addEventListener("gesturestart", onGestureStart);
    area.addEventListener("gesturechange", onGestureChange);
    return () => {
      area.removeEventListener("wheel", onWheel);
      area.removeEventListener("gesturestart", onGestureStart);
      area.removeEventListener("gesturechange", onGestureChange);
    };
  }, [dispatch]);

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

  /*
   * Guías de diseño (estilo Photoshop). Se sacan arrastrando desde las reglas, se mueven
   * arrastrándolas, se borran soltándolas fuera de la hoja o con clic derecho. Mientras se
   * arrastra, el cambio vive sólo acá; al soltar se guarda una vez, así deshacer revierte el
   * gesto entero y no cada píxel.
   */
  const guides = useMemo(() => readGuides(state.versionMeta), [state.versionMeta]);
  const [guideDrag, setGuideDrag] = useState<{ axis: GuideAxis; index: number | null; pos: number } | null>(null);
  const [guideMenu, setGuideMenu] = useState<{ axis: GuideAxis; index: number; x: number; y: number } | null>(null);
  const guidesRef = useRef(guides);
  guidesRef.current = guides;

  const startGuideDrag = useCallback(
    (axis: GuideAxis, index: number | null, e: ReactPointerEvent<HTMLElement>) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      setGuideMenu(null);
      const toPos = (cx: number, cy: number) => {
        const inner = canvasInnerRef.current;
        if (!inner) return 0;
        const r = inner.getBoundingClientRect();
        const z = zoomRef.current > 0 ? zoomRef.current : 1;
        return axis === "v" ? (cx - r.left) / z : (cy - r.top) / z;
      };
      setGuideDrag({ axis, index, pos: toPos(e.clientX, e.clientY) });
      const onMove = (ev: PointerEvent) => setGuideDrag({ axis, index, pos: toPos(ev.clientX, ev.clientY) });
      const onUp = (ev: PointerEvent) => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
        setGuideDrag(null);
        const pos = toPos(ev.clientX, ev.clientY);
        const g = guidesRef.current;
        const inside = isGuideInsideCanvas(axis, pos, state.canvas.width, state.canvas.height);
        let next: EditorGuides;
        if (index === null) {
          if (!inside) return;
          next = addGuide(g, axis, pos);
        } else {
          next = inside ? moveGuide(g, axis, index, pos) : removeGuide(g, axis, index);
        }
        dispatch(setGuides(next));
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
    },
    [dispatch, state.canvas.width, state.canvas.height]
  );

  useEffect(() => {
    if (!guideMenu) return;
    const close = () => setGuideMenu(null);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("pointerdown", close);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("keydown", onKey);
    };
  }, [guideMenu]);

  /** Dónde cae el 0 de la hoja en cada regla, y cuánto miden. Se mide del DOM real. */
  const [rulerFrame, setRulerFrame] = useState({ ox: 0, oy: 0, w: 0, h: 0 });
  const measureRulers = useCallback(() => {
    const wa = workAreaRef.current;
    const inner = canvasInnerRef.current;
    if (!wa || !inner) return;
    const a = wa.getBoundingClientRect();
    const r = inner.getBoundingClientRect();
    setRulerFrame((prev) => {
      const next = { ox: r.left - a.left, oy: r.top - a.top, w: a.width, h: a.height };
      return prev.ox === next.ox && prev.oy === next.oy && prev.w === next.w && prev.h === next.h ? prev : next;
    });
  }, []);
  useLayoutEffect(() => {
    measureRulers();
  });
  useEffect(() => {
    const wa = workAreaRef.current;
    if (!wa) return;
    const ro = new ResizeObserver(measureRulers);
    ro.observe(wa);
    wa.addEventListener("scroll", measureRulers, { passive: true });
    return () => {
      ro.disconnect();
      wa.removeEventListener("scroll", measureRulers);
    };
  }, [measureRulers]);

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
      <div className="flex shrink-0" style={{ height: RULER_SIZE_PX }}>
        <div
          className="shrink-0 border-b border-r border-[color:var(--te-line)] bg-[color:var(--te-chrome)]"
          style={{ width: RULER_SIZE_PX }}
          aria-hidden
        />
        <EditorRuler
          orientation="horizontal"
          lengthPx={rulerFrame.w}
          originPx={rulerFrame.ox}
          zoom={state.zoom}
          dpi={state.canvas.dpi}
          onPointerDown={(e) => startGuideDrag("h", null, e)}
        />
      </div>
      <div className="flex min-h-0 min-w-0 flex-1">
        <div className="shrink-0" style={{ width: RULER_SIZE_PX }}>
          <EditorRuler
            orientation="vertical"
            lengthPx={rulerFrame.h}
            originPx={rulerFrame.oy}
            zoom={state.zoom}
            dpi={state.canvas.dpi}
            onPointerDown={(e) => startGuideDrag("v", null, e)}
          />
        </div>
      {/* Área de trabajo: gris suave. El lienzo se centra; el marco tiene el tamaño *ya escalado* para no duplicar altura en el scroll (bug: hijo con width/height en px + scale ocupaba layout completo). */}
      <div
        ref={workAreaRef}
        className="flex min-h-0 w-full min-w-0 flex-1 overflow-auto overscroll-contain bg-[color:var(--te-void)] px-3 py-4 sm:px-5 sm:py-6 md:px-8 md:py-8"
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
          // `m-auto` y no `items-center`/`justify-center` en el padre: centrar con flex deja fuera del
          // scroll la parte izquierda y de arriba de una hoja más grande que el área.
          className="relative m-auto shrink-0 rounded-none bg-white shadow-[0_2px_12px_rgba(0,0,0,0.5)]"
          // El pliego es papel: no hereda el tema oscuro del editor (ver PAPER_TOKENS).
          style={{ ...PAPER_TOKENS, width: zw, height: zh }}
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
            {/*
              Sólo el diseño se recorta al borde de la hoja. Antes se recortaba la hoja entera, con
              los tiradores incluidos: un bloque agrandado o girado que asomaba por fuera quedaba
              con una esquina imposible de agarrar. Como en Photoshop, el recuadro de selección y
              sus tiradores se ven y se usan aunque salgan del lienzo.
            */}
            <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
              <TemplateCanvasRenderer
                canvas={state.canvas}
                blocks={blocksOnPage}
                readOnly
                resolvedVariables={valoresDeMuestra}
                selectedBlockIds={state.selectedBlockIds}
                primarySelectedBlockId={primaryId}
                diagnosticHighlightByBlockId={diagnosticHighlightByBlockId}
                hideTextBodyForBlockId={editingTextBlockId}
              />
            </div>

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
              const isTextKind =
                (b.type === "TEXT" || b.type === "VARIABLE_TEXT") && !isClassListConfig(b.configJson);
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
                  if (
                    b.type === "IMAGE" &&
                    String(b.configJson.src ?? "").trim() !== "" &&
                    b.configJson.fit !== "contain"
                  ) {
                    dragRef.current = null;
                    gesturePersistSnapshotRef.current = null;
                    setDraggingBlockId(null);
                    cropStartSnapshotRef.current = takePersistSnapshot(state);
                    dispatch(selectBlock(b.id));
                    setCroppingBlockId(b.id);
                    return;
                  }
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
                  /*
                   * Con la herramienta de texto activa, los bloques dejan pasar el clic.
                   * Antes lo interceptaban y lo frenaban: sobre una imagen de fondo —que ocupa
                   * toda la hoja— no había ningún lugar donde el clic llegara al lienzo, así que
                   * la herramienta de texto quedaba inutilizable.
                   */
                  pointerEvents:
                    textMode || editingTextBlockId === b.id ? "none" : "auto",
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
                  /*
                   * Con la tecla de capas se baja de a uno por lo que hay debajo del cursor. Sin
                   * esto, un bloque tapado por el fondo no se puede seleccionar en el lienzo: el
                   * clic siempre agarra lo de arriba.
                   *
                   * Cmd en Mac y Ctrl en el resto. Es la convención de las herramientas de
                   * diseño y por eso no se inventa otra.
                   */
                  if (e.metaKey || e.ctrlKey) {
                    const { x, y } = clientToCanvas(e.clientX, e.clientY);
                    const pila = blocksAtPoint(
                      state.blocks,
                      x,
                      y,
                      state.activePageIndex ?? 0,
                    );
                    const siguiente = nextBlockInStack(pila, primaryId);
                    if (siguiente) dispatch(selectBlock(siguiente.id));
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
                      // El duplicado con Alt nace suelto: se arrastra solo, no en conjunto.
                      grupo: null,
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
                  /*
                   * Arrastrar cualquiera de los seleccionados mueve a todos. Antes movía solo el
                   * que se agarraba: con dos elementos elegidos, uno se iba y el otro se quedaba.
                   */
                  const enSeleccion =
                    state.selectedBlockIds.length > 1 && state.selectedBlockIds.includes(b.id);
                  const cajaGrupo = enSeleccion
                    ? selectionBounds(state.blocks, state.selectedBlockIds)
                    : null;

                  dragRef.current = {
                    pointerId: e.pointerId,
                    blockId: b.id,
                    grupo:
                      cajaGrupo != null
                        ? offsetsWithinSelection(state.blocks, state.selectedBlockIds, cajaGrupo)
                        : null,
                    startClientX: e.clientX,
                    startClientY: e.clientY,
                    /*
                     * Con varios elegidos, lo que se arrastra y lo que se ajusta a las guías es
                     * la caja del conjunto. Así "centrar" centra el grupo entero; si midiera el
                     * bloque agarrado, ese quedaría centrado y los demás corridos.
                     */
                    startX: cajaGrupo?.x ?? b.layout.x,
                    startY: cajaGrupo?.y ?? b.layout.y,
                    blockWidth: cajaGrupo?.width ?? b.layout.width,
                    blockHeight: cajaGrupo?.height ?? b.layout.height,
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
                  /*
                   * Shift bloquea un eje, como en Photoshop: si el arrastre va más en horizontal,
                   * la posición vertical queda fija, y al revés. Se decide en cada movimiento,
                   * así se puede cambiar de eje sin soltar.
                   */
                  const ejeFijo: "x" | "y" | null = e.shiftKey
                    ? Math.abs(deltaX) >= Math.abs(deltaY)
                      ? "y"
                      : "x"
                    : null;
                  const rawX = ejeFijo === "x" ? drag.startX : drag.startX + deltaX;
                  const rawY = ejeFijo === "y" ? drag.startY : drag.startY + deltaY;
                  // ⌘ / Ctrl apretado suelta el imán, como en los editores de imagen.
                  const sinIman = e.metaKey || e.ctrlKey;
                  const snapped = snapDragPosition(
                    state.canvas.width,
                    state.canvas.height,
                    drag.blockWidth,
                    drag.blockHeight,
                    rawX,
                    rawY,
                    blockId,
                    /*
                     * Al mover un conjunto, sus propios integrantes no sirven de guía: se moverían
                     * junto con la caja y el ajuste se pegaría a sí mismo. Solo cuentan los que
                     * se quedan quietos.
                     */
                    drag.grupo
                      ? blocksOnPage.filter((x) => !drag.grupo!.some((m) => m.id === x.id))
                      : blocksOnPage,
                    sinIman ? 0 : SNAP_SCREEN_PX / zoom,
                    { safeArea: safeAreaRect, guidesX: guides.v, guidesY: guides.h }
                  );
                  // El eje bloqueado no se imanta: el bloque no puede salirse de la línea.
                  if (ejeFijo === "x") {
                    snapped.x = drag.startX;
                    snapped.guideVerticalX = null;
                  } else if (ejeFijo === "y") {
                    snapped.y = drag.startY;
                    snapped.guideHorizontalY = null;
                  }
                  setSnapGuides({ vx: snapped.guideVerticalX, hy: snapped.guideHorizontalY });

                  if (drag.grupo) {
                    // `snapped` es la esquina de la caja del conjunto: cada bloque vuelve a su
                    // lugar relativo, así llegan al destino con la misma separación de origen.
                    for (const m of drag.grupo) {
                      dispatch(
                        updateBlock(
                          m.id,
                          { layout: { x: snapped.x + m.dx, y: snapped.y + m.dy } },
                          { skipHistory: true },
                        ),
                      );
                    }
                    return;
                  }

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

            {croppingBlock ? (
              <ImageCropOverlay
                block={croppingBlock}
                canvasZoom={state.zoom}
                onCrop={(crop, natural) =>
                  dispatch(
                    updateBlock(
                      croppingBlock.id,
                      {
                        configJson: {
                          ...croppingBlock.configJson,
                          crop,
                          srcWidth: natural.w,
                          srcHeight: natural.h,
                        },
                      },
                      { skipHistory: true }
                    )
                  )
                }
                onExit={endImageCrop}
              />
            ) : null}

            {/* Marco y handles solo en el bloque primario; el resto de seleccionados llevan outline en el renderer. */}
            {primaryBlock && editingTextBlockId !== primaryBlock.id && croppingBlockId !== primaryBlock.id ? (
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
                          // Con Shift, imán a los ángulos rectos (y de a 15° entre medio).
                          const nextDeg = e.shiftKey ? snapRotationDeg(rz.rotationAccumDeg) : rz.rotationAccumDeg;
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
                          // Girado un cuarto de vuelta, la flecha del cursor sigue al lado girado.
                          cursor:
                            Math.round(Math.abs(primaryBlock.layout.rotation ?? 0) / 90) % 2 === 1
                              ? ({
                                  "ns-resize": "ew-resize",
                                  "ew-resize": "ns-resize",
                                  "nwse-resize": "nesw-resize",
                                  "nesw-resize": "nwse-resize",
                                } as const)[h.cursor]
                              : h.cursor,
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
                          // El listado del curso se agranda como caja: la lista se reparte sola.
                          // Un lado estira la caja sin cambiar la tipografía.
                          const isTextKind =
                            (primaryBlock.type === "TEXT" || primaryBlock.type === "VARIABLE_TEXT") &&
                            !isClassListConfig(primaryBlock.configJson) &&
                            !isResizeEdge(h.key);
                          const nb = normalizeBlockConfig(primaryBlock.type, primaryBlock.configJson) as {
                            fontSize?: number;
                          };
                          const startFs =
                            typeof nb.fontSize === "number" && Number.isFinite(nb.fontSize) ? nb.fontSize : 20;
                          setResizingBlockId(primaryBlock.id);
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
                          // Con proporción fijada en el inspector, la esquina estira siempre en
                          // proporción, como si Mayús estuviera apretada.
                          /*
                           * Esquinas: Shift invierte la proporción, como en Photoshop. Sin candado,
                           * Shift la mantiene; con el candado cerrado, Shift la libera y al soltar
                           * queda abierto.
                           * Lados: estiran en una sola dirección; si el candado estaba cerrado,
                           * sigue cerrado pero con la proporción nueva, así las esquinas después
                           * respetan la forma que se le dio.
                           */
                          const aspectLock = getBlockAspectLock(rz.startConfigJson);
                          const esLado = isResizeEdge(rz.handle);
                          const liberaProporcion = !esLado && aspectLock !== null && e.shiftKey;
                          const proporcional =
                            !esLado && (aspectLock !== null ? !e.shiftKey : e.shiftKey);
                          const next = computeResizeRectRotated(
                            rz.handle,
                            {
                              x: rz.startX,
                              y: rz.startY,
                              width: rz.startWidth,
                              height: aspectLock && proporcional ? rz.startWidth / aspectLock : rz.startHeight,
                            },
                            dx,
                            dy,
                            { shift: proporcional, alt: e.altKey },
                            primaryBlock.layout.rotation ?? 0
                          );
                          // Imán al estirar: los bordes que se mueven se pegan a las guías. Alt (desde
                          // el centro) y ⌘/Ctrl lo sueltan. En un bloque girado no: las guías son
                          // horizontales y verticales, y pegarle un borde inclinado lo deformaría.
                          let finalRect = next;
                          const girado = Math.abs(primaryBlock.layout.rotation ?? 0) % 360 !== 0;
                          if (!girado && !e.altKey && !e.metaKey && !e.ctrlKey) {
                            const lineas = buildSnapGuideLines(
                              state.canvas.width,
                              state.canvas.height,
                              blocksOnPage,
                              new Set([rz.blockId]),
                              { safeArea: safeAreaRect, guidesX: guides.v, guidesY: guides.h }
                            );
                            const sr = snapResizeRect(
                              rz.handle,
                              next,
                              lineas,
                              SNAP_SCREEN_PX / zoom,
                              proporcional
                            );
                            finalRect = sr.rect;
                            setSnapGuides({ vx: sr.guideVerticalX, hy: sr.guideHorizontalY });
                          } else {
                            setSnapGuides({ vx: null, hy: null });
                          }
                          const layoutPatch = {
                            x: finalRect.x,
                            y: finalRect.y,
                            width: finalRect.width,
                            height: finalRect.height,
                          };
                          const configTrasLado = (() => {
                            if (liberaProporcion) {
                              const c = { ...rz.startConfigJson };
                              delete c.aspectLock;
                              return c;
                            }
                            if (esLado && aspectLock !== null && finalRect.height > 0) {
                              return { ...rz.startConfigJson, aspectLock: finalRect.width / finalRect.height };
                            }
                            return rz.startConfigJson;
                          })();
                          if (
                            rz.scaleTypography &&
                            rz.startWidth > 0 &&
                            rz.startHeight > 0
                          ) {
                            const rw = finalRect.width / rz.startWidth;
                            const rh = finalRect.height / rz.startHeight;
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
                                    ...configTrasLado,
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
                                aspectLock !== null
                                  ? { layout: layoutPatch, configJson: configTrasLado }
                                  : { layout: layoutPatch },
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
                          setResizingBlockId(null);
                          setSnapGuides({ vx: null, hy: null });
                        }}
                        onPointerCancel={() => {
                          gesturePersistSnapshotRef.current = null;
                          resizeRef.current = null;
                          setResizingBlockId(null);
                          setSnapGuides({ vx: null, hy: null });
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
                {resizingBlockId === primaryBlock.id ? (
                  <BlockSizeBadge
                    width={primaryBlock.layout.width}
                    height={primaryBlock.layout.height}
                    unit={sizeUnit}
                    dpi={canvasDpi(state.canvas)}
                    zoom={state.zoom}
                  />
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
                  resolvedVariables={valoresDeMuestra}
                />
              </div>
            ) : null}

            {(draggingBlockId !== null || resizingBlockId !== null) && (snapGuides.vx != null || snapGuides.hy != null) ? (
              <div className="pointer-events-none" style={{ position: "absolute", inset: 0, zIndex: 99990 }} aria-hidden>
                {snapGuides.vx != null ? (
                  <div
                    style={{
                      position: "absolute",
                      // Grosor fijo en pantalla: la capa está escalada con el zoom y 2 px del
                      // lienzo eran medio píxel con una carpeta al 25 %. Magenta, como las guías
                      // inteligentes de los editores de imagen: se distingue de la selección.
                      left: snapGuides.vx - 0.75 / (state.zoom || 1),
                      top: 0,
                      width: 1.5 / (state.zoom || 1),
                      height: "100%",
                      background: "#ff2bd6",
                    }}
                  />
                ) : null}
                {snapGuides.hy != null ? (
                  <div
                    style={{
                      position: "absolute",
                      top: snapGuides.hy - 0.75 / (state.zoom || 1),
                      left: 0,
                      height: 1.5 / (state.zoom || 1),
                      width: "100%",
                      background: "#ff2bd6",
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

            {/* Guías de diseño. La franja que se agarra es más ancha que la línea que se ve. */}
            {(["v", "h"] as const).map((axis) =>
              guides[axis].map((pos, i) => {
                const z = state.zoom > 0 ? state.zoom : 1;
                const moving = guideDrag && guideDrag.axis === axis && guideDrag.index === i;
                const p = moving ? guideDrag!.pos : pos;
                const hit = 7 / z;
                return (
                  <div
                    key={`${axis}-${i}`}
                    title="Guía: arrastrala para moverla; soltala fuera de la hoja o clic derecho para borrarla"
                    onPointerDown={(e) => startGuideDrag(axis, i, e)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setGuideMenu({ axis, index: i, x: e.clientX, y: e.clientY });
                    }}
                    style={{
                      position: "absolute",
                      zIndex: 99970,
                      cursor: axis === "v" ? "col-resize" : "row-resize",
                      ...(axis === "v"
                        ? { left: p - hit / 2, top: 0, width: hit, height: "100%" }
                        : { top: p - hit / 2, left: 0, height: hit, width: "100%" }),
                    }}
                  >
                    <div
                      style={{
                        position: "absolute",
                        background: "#00b7ff",
                        ...(axis === "v"
                          ? { left: hit / 2 - 0.5 / z, top: 0, width: 1 / z, height: "100%" }
                          : { top: hit / 2 - 0.5 / z, left: 0, height: 1 / z, width: "100%" }),
                      }}
                    />
                  </div>
                );
              })
            )}
            {guideDrag && guideDrag.index === null ? (
              <div
                aria-hidden
                style={{
                  position: "absolute",
                  zIndex: 99970,
                  pointerEvents: "none",
                  background: "#00b7ff",
                  ...(guideDrag.axis === "v"
                    ? { left: guideDrag.pos, top: 0, width: 1 / (state.zoom || 1), height: "100%" }
                    : { top: guideDrag.pos, left: 0, height: 1 / (state.zoom || 1), width: "100%" }),
                }}
              />
            ) : null}
          </div>
        </div>
      </div>
      </div>

      {guideMenu ? (
        <div
          role="menu"
          className="fixed z-[100000] min-w-[11rem] overflow-hidden rounded-[var(--te-radius)] border border-[color:var(--te-line-strong)] bg-[color:var(--te-surface)] py-1 text-[12px] text-[color:var(--te-ink)] shadow-lg"
          style={{ left: guideMenu.x, top: guideMenu.y }}
          onPointerDown={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.preventDefault()}
        >
          <button
            type="button"
            role="menuitem"
            className="block w-full px-3 py-1.5 text-left hover:bg-[color:var(--te-accent-wash)]"
            onClick={() => {
              dispatch(setGuides(removeGuide(guides, guideMenu.axis, guideMenu.index)));
              setGuideMenu(null);
            }}
          >
            Eliminar guía
          </button>
          <button
            type="button"
            role="menuitem"
            className="block w-full px-3 py-1.5 text-left hover:bg-[color:var(--te-accent-wash)]"
            onClick={() => {
              dispatch(setGuides({ v: [], h: [] }));
              setGuideMenu(null);
            }}
          >
            Eliminar todas las guías
          </button>
        </div>
      ) : null}
    </div>
  );
}
