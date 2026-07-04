"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Stage, Layer, Rect, Line, Circle, Ellipse, Group, Transformer, Image as KonvaImage, Text, Shape } from "react-konva";
import Konva from "konva";
import type { AlbumSpec, FrameItem, FrameShape, ImageAsset, Spread, TextItem } from "./types";
import { getCoverCrop as getCoverCropUtil, getRotationFillScale as getRotationFillScaleUtil, getRotationFillZoom as getRotationFillZoomUtil, getContainSize as getContainSizeUtil } from "./imageCrop";
import { clampFrameToPrintable } from "./printableArea";
import { getPolaroidFontFamily, normalizePolaroidFontValue, POLAROID_FONT_FALLBACK } from "@/components/polaroid/fonts";

const SNAP_THRESHOLD = 12;

/** Área de contenido: para todas las formas usa el frame completo (la máscara puede cambiar de proporción; la foto mantiene la suya con cover/contain). */
function getShapeContentSize(shape: FrameShape, w: number, h: number): { contentW: number; contentH: number } {
  return { contentW: w, contentH: h };
}

/** Genera clipFunc para el Group según la forma (coords locales: 0,0 = esquina superior izquierda del frame). Compatible con contexto nativo o Konva.Context. */
function getClipFunc(shape: FrameShape, w: number, h: number) {
  const { contentW, contentH } = getShapeContentSize(shape, w, h);
  const ox = (w - contentW) / 2;
  const oy = (h - contentH) / 2;
  const cx = contentW / 2;
  const cy = contentH / 2;
  const r = Math.min(contentW, contentH) / 2;
  return (ctx: CanvasRenderingContext2D | { _context?: CanvasRenderingContext2D }) => {
    const c = (ctx as { _context?: CanvasRenderingContext2D })._context ?? ctx;
    const g = c as CanvasRenderingContext2D;
    g.beginPath();
    if (shape === "rect") {
      g.rect(0, 0, w, h);
    } else if (shape === "circle") {
      const rx = contentW / 2;
      const ry = contentH / 2;
      if (rx === ry) {
        g.arc(ox + cx, oy + cy, r, 0, Math.PI * 2);
      } else {
        (g as CanvasRenderingContext2D).ellipse(ox + cx, oy + cy, rx, ry, 0, 0, Math.PI * 2);
      }
    } else if (shape === "triangle") {
      g.moveTo(ox + cx, oy);
      g.lineTo(ox + contentW, oy + contentH);
      g.lineTo(ox, oy + contentH);
      g.closePath();
    } else if (shape === "pentagon") {
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
        const x = ox + cx + r * Math.cos(a);
        const y = oy + cy + r * Math.sin(a);
        if (i === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.closePath();
    } else if (shape === "heart") {
      const u = contentW / 8;
      const v = contentH / 7;
      const hcx = ox + cx;
      const hcy = oy + 2 * v;
      g.moveTo(hcx, hcy + v);
      g.bezierCurveTo(hcx, hcy - 2 * v, hcx - 4 * u, hcy - 2 * v, hcx - 4 * u, hcy + v);
      g.bezierCurveTo(hcx - 4 * u, hcy + 3 * v, hcx, hcy + 5 * v, hcx, hcy + 5 * v);
      g.bezierCurveTo(hcx, hcy + 5 * v, hcx + 4 * u, hcy + 3 * v, hcx + 4 * u, hcy + v);
      g.bezierCurveTo(hcx + 4 * u, hcy - 2 * v, hcx, hcy - 2 * v, hcx, hcy + v);
      g.closePath();
    }
  };
}

/** Puntos para dibujar el borde de la forma (mismo sistema de coords que clip). */
function getShapePoints(shape: FrameShape, w: number, h: number): number[] | null {
  const { contentW, contentH } = getShapeContentSize(shape, w, h);
  const ox = (w - contentW) / 2;
  const oy = (h - contentH) / 2;
  const cx = contentW / 2;
  const cy = contentH / 2;
  const r = Math.min(contentW, contentH) / 2;
  if (shape === "triangle") {
    return [ox + cx, oy, ox + contentW, oy + contentH, ox, oy + contentH, ox + cx, oy];
  }
  if (shape === "pentagon") {
    const points: number[] = [];
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
      points.push(ox + cx + r * Math.cos(a), oy + cy + r * Math.sin(a));
    }
    return points;
  }
  if (shape === "heart") {
    const u = contentW / 8;
    const v = contentH / 7;
    const hcx = ox + cx;
    const hcy = oy + 2 * v;
    return [
      hcx, hcy + v,
      hcx, hcy - 2 * v, hcx - 4 * u, hcy - 2 * v, hcx - 4 * u, hcy + v,
      hcx - 4 * u, hcy + 3 * v, hcx, hcy + 5 * v, hcx, hcy + 5 * v,
      hcx, hcy + 5 * v, hcx + 4 * u, hcy + 3 * v, hcx + 4 * u, hcy + v,
      hcx + 4 * u, hcy - 2 * v, hcx, hcy - 2 * v, hcx, hcy + v,
    ];
  }
  return null;
}

type CanvasEditorProps = {
  spec: AlbumSpec;
  spread: Spread;
  images: ImageAsset[];
  /** IDs de ítems seleccionados (frames y textos). Soporta selección múltiple con Shift/Cmd o recuadro. */
  selectedItemIds: readonly string[];
  onSelectItems: (ids: string[]) => void;
  onChangeItem: (id: string, next: Partial<FrameItem>) => void;
  onChangeText: (id: string, next: Partial<TextItem>) => void;
  onCreateFrame: (payload: Partial<FrameItem>) => void;
  onCreateText: (payload: Partial<TextItem>) => void;
  onAssignImage: (id: string, imageId: string) => void;
  /** Al arrastrar un frame y soltarlo sobre otro, se intercambian las imágenes. */
  onSwapFrames?: (idA: string, idB: string) => void;
  /** Si true, al arrastrar los objetos se imantan a bordes y centro (guías de alineación). */
  snapEnabled?: boolean;
  /** 'spread' = hoja completa abierta (2 páginas), 'page' = solo una página (media hoja). */
  viewMode?: "spread" | "page";
  /** Si true, muestra el dropdown de formas al agregar recuadro (solo en diseñador de doble clic). Si false, siempre agrega rectángulo. */
  showShapePicker?: boolean;
  /** Si true, el Transformer muestra manejador de rotación (esquineros para girar). */
  rotateEnabled?: boolean;
  /** Cuando viewMode es 'page', qué mitad mostrar. */
  pageSide?: "left" | "right";
  /** Si se pasan, en vista spread la hoja encaja en este recuadro para verse completa. */
  containerWidth?: number;
  containerHeight?: number;
  /** Al hacer doble clic en un frame o texto, se llama con (id, tipo). Si se pasa, el doble clic en texto no abre el editor inline. */
  onDoubleClickItem?: (id: string, type: "frame" | "text") => void;
  /** Al hacer doble clic en el canvas vacío (sin frame ni texto bajo el cursor). Recibe la posición del clic en coords del stage para crear el frame ahí. */
  onDoubleClickEmpty?: (point?: { x: number; y: number }) => void;
  /** Si true, no se puede arrastrar ni redimensionar los elementos (solo lectura de layout según plantilla). */
  transformDisabled?: boolean;
  /** Si true, el recuadro nunca rota; solo la imagen dentro puede rotar (imageRotation). Para enderezar horizonte. */
  forceFrameRotationZero?: boolean;
  /** Si true, oculta toolbar (zoom, guías, botones). Para previsualización lateral (spread anterior/siguiente). */
  previewMode?: boolean;
  /** Si false, oculta zoom y botones agregar recuadro/texto. Para vista principal; en Editor de Página se muestran. */
  showAddActions?: boolean;
  /** Si false, oculta el botón de agregar recuadro (solo en Editor de Página). Por defecto true. */
  showAddFrameButton?: boolean;
  /** Si true, modo Editor de Página: arrastrar y redimensionar (sin swap), guía del doblez más visible. */
  editorPageMode?: boolean;
  /** Para vista libro: muestra solo la mitad izquierda o derecha (página), escalada al contenedor. */
  bookHalf?: "left" | "right";
  /** Si true, permite overflow para efecto 3D (hoja que se ve por fuera del canvas al girar). */
  allowOverflow?: boolean;
  /** Durante giro: fusiona left+right en un solo canvas (elimina línea del pliegue). */
  splitSpreads?: { left: Spread; right: Spread };
};

/** Guías verticales y horizontales (posiciones en px del stage). */
function getGuidePositions(spec: AlbumSpec) {
  const { bleed, pageWidth, pageHeight } = spec;
  const contentLeft = bleed;
  const contentRight = bleed + pageWidth * 2;
  const contentTop = bleed;
  const contentBottom = bleed + pageHeight;
  const spine = bleed + pageWidth;
  const midLeft = bleed + pageWidth / 2;
  const midRight = bleed + pageWidth * 1.5;
  const midV = bleed + pageHeight / 2;
  return {
    vertical: [contentLeft, midLeft, spine, midRight, contentRight],
    horizontal: [contentTop, midV, contentBottom],
  };
}

function snapToGuides(
  left: number,
  top: number,
  width: number,
  height: number,
  spec: AlbumSpec,
  otherItems?: Array<{ x: number; y: number; width: number; height: number }>
): { left: number; top: number; guides: { v: number[]; h: number[] } } {
  const { vertical: baseV, horizontal: baseH } = getGuidePositions(spec);
  const vertical = otherItems
    ? [...new Set([...baseV, ...otherItems.flatMap((o) => [o.x, o.x + o.width, o.x + o.width / 2])])]
    : baseV;
  const horizontal = otherItems
    ? [...new Set([...baseH, ...otherItems.flatMap((o) => [o.y, o.y + o.height, o.y + o.height / 2])])]
    : baseH;
  const right = left + width;
  const bottom = top + height;
  const centerX = left + width / 2;
  const centerY = top + height / 2;
  const guides: { v: number[]; h: number[] } = { v: [], h: [] };
  let outLeft = left;
  let outTop = top;

  let bestV = { dist: SNAP_THRESHOLD + 1, guide: 0, newLeft: left };
  for (const g of vertical) {
    for (const [val, fn] of [
      [left, () => g] as const,
      [right, () => g - width] as const,
      [centerX, () => g - width / 2] as const,
    ]) {
      const d = Math.abs(val - g);
      if (d <= SNAP_THRESHOLD && d < bestV.dist) {
        bestV = { dist: d, guide: g, newLeft: fn() };
      }
    }
  }
  if (bestV.dist <= SNAP_THRESHOLD) {
    outLeft = bestV.newLeft;
    guides.v.push(bestV.guide);
  }

  let bestH = { dist: SNAP_THRESHOLD + 1, guide: 0, newTop: top };
  for (const g of horizontal) {
    for (const [val, fn] of [
      [top, () => g] as const,
      [bottom, () => g - height] as const,
      [centerY, () => g - height / 2] as const,
    ]) {
      const d = Math.abs(val - g);
      if (d <= SNAP_THRESHOLD && d < bestH.dist) {
        bestH = { dist: d, guide: g, newTop: fn() };
      }
    }
  }
  if (bestH.dist <= SNAP_THRESHOLD) {
    outTop = bestH.newTop;
    guides.h.push(bestH.guide);
  }

  return { left: outLeft, top: outTop, guides };
}

type ImageCache = {
  [key: string]: HTMLImageElement;
};

function useImageCache(images: ImageAsset[]) {
  const [cache, setCache] = useState<ImageCache>({});

  useEffect(() => {
    let mounted = true;
    images.forEach((asset) => {
      if (cache[asset.id]) return;
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        if (!mounted) return;
        setCache((prev) => ({ ...prev, [asset.id]: img }));
      };
      img.src = asset.url;
    });
    return () => {
      mounted = false;
    };
  }, [images, cache]);

  return cache;
}

const getCoverCrop = getCoverCropUtil;
const getRotationFillScale = getRotationFillScaleUtil;
const getRotationFillZoom = getRotationFillZoomUtil;
const getContainSize = getContainSizeUtil;

export default function CanvasEditor({
  spec,
  spread,
  images,
  selectedItemIds,
  onSelectItems,
  onChangeItem,
  onChangeText,
  onCreateFrame,
  onCreateText,
  onAssignImage,
  onSwapFrames,
  snapEnabled = true,
  viewMode = "spread",
  pageSide = "left",
  containerWidth = 0,
  containerHeight = 0,
  onDoubleClickItem,
  onDoubleClickEmpty,
  transformDisabled = false,
  showShapePicker = false,
  rotateEnabled = false,
  forceFrameRotationZero = false,
  previewMode = false,
  showAddActions = true,
  showAddFrameButton = true,
  editorPageMode = false,
  bookHalf,
  allowOverflow = false,
  splitSpreads,
}: CanvasEditorProps) {
  const stageRef = useRef<Konva.Stage>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const groupRefs = useRef<Record<string, Konva.Group>>({});
  const clipGroupRefs = useRef<Record<string, Konva.Group>>({});
  const textRefs = useRef<Record<string, Konva.Text>>({});
  const [userZoom, setUserZoom] = useState(1);
  /** Guías de alineación visibles mientras se arrastra (imantado). */
  const [snapGuides, setSnapGuides] = useState<{ v: number[]; h: number[] }>({ v: [], h: [] });
  /** Id del texto que se está editando in situ (doble clic). */
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  /** Rect del texto en edición (coords del stage) para posicionar el overlay. */
  const [editTextRect, setEditTextRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const editInputRef = useRef<HTMLInputElement | null>(null);
  const measureSpanRef = useRef<HTMLSpanElement | null>(null);
  /** Tamaño en tiempo real mientras se arrastran los manejadores del Transformer */
  const [liveFrameSize, setLiveFrameSize] = useState<Record<string, { width: number; height: number }>>({});
  /** Si true (Alt/Option pulsada), el redimensionado es desde el centro (proporcional en todas las direcciones). */
  const [centeredScaling, setCenteredScaling] = useState(false);
  /** En editorPageMode: si true (Shift/Cmd pulsada), mantener proporción al redimensionar. */
  const [ratioLockModifier, setRatioLockModifier] = useState(false);
  /** Ref para rotación por arrastre desde las esquinas: listeners y estado */
  const rotationDragRef = useRef<{
    itemId: string;
    startRotation: number;
    startAngle: number;
    group: Konva.Group;
    itemWidth: number;
    itemHeight: number;
    onMove: (e: MouseEvent) => void;
    onUp: (e: MouseEvent) => void;
  } | null>(null);
  /** True cuando el puntero está cerca de una esquina del frame seleccionado (para cursor y rotar al click) */
  const cornerHitRef = useRef(false);
  /** Frame que se está arrastrando (para borde naranja en miniatura) */
  const [draggingItemId, setDraggingItemId] = useState<string | null>(null);
  /** Posiciones al inicio del arrastre (para mover varios juntos) */
  const dragStartPositionsRef = useRef<Record<string, { x: number; y: number; width: number; height: number }>>({});
  /** Frame sobre el que se puede soltar (destino de intercambio) — borde azul y contenido al 50% */
  const [dropTargetItemId, setDropTargetItemId] = useState<string | null>(null);
  /** Recuadro de selección por arrastre: {startX, startY, currentX, currentY} */
  const [selectionBox, setSelectionBox] = useState<{ startX: number; startY: number; currentX: number; currentY: number } | null>(null);
  /** Re-encuadre: Alt+arrastrar en frame con imagen activa pan de la foto dentro del recuadro */
  const imagePanRef = useRef<{
    itemId: string;
    startPointerX: number;
    startPointerY: number;
    startOffsetX: number;
    startOffsetY: number;
  } | null>(null);

  const ACCENT_ORANGE = "#c27b3d";
  const DROP_TARGET_BLUE = "#3b82f6";
  const SELECTED_STROKE_WIDTH = 30;

  const totalWidth = spec.pageWidth * 2 + spec.bleed * 2;
  const totalHeight = spec.pageHeight + spec.bleed * 2;
  const safeInset = spec.safe;
  const spine = spec.bleed + spec.pageWidth;

  /** Durante giro: merge left+right spread para un solo canvas sin línea del pliegue */
  const effectiveSpread = useMemo(() => {
    if (!splitSpreads) return spread;
    const { left: leftSpread, right: rightSpread } = splitSpreads;
    const inLeft = (x: number, w: number) => x + w / 2 < spine;
    const leftItems = leftSpread.items
      .filter((i) => inLeft(i.x, i.width))
      .map((i) => ({ ...i, id: `L-${i.id}` }));
    const rightItems = rightSpread.items
      .filter((i) => !inLeft(i.x, i.width))
      .map((i) => ({ ...i, id: `R-${i.id}` }));
    const leftTexts = (leftSpread.texts ?? []).filter((t) => inLeft(t.x, t.width ?? 0)).map((t) => ({ ...t, id: `L-${t.id}` }));
    const rightTexts = (rightSpread.texts ?? []).filter((t) => !inLeft(t.x, t.width ?? 0)).map((t) => ({ ...t, id: `R-${t.id}` }));
    return {
      id: "merged",
      items: [...leftItems, ...rightItems],
      texts: [...leftTexts, ...rightTexts],
      backgroundColor: leftSpread.backgroundColor,
      backgroundImageId: undefined,
    };
  }, [spread, splitSpreads, spine]);

  const imageCache = useImageCache(images);
  const imageMap = useMemo(() => {
    const map: Record<string, ImageAsset> = {};
    images.forEach((img) => {
      map[img.id] = img;
    });
    return map;
  }, [images]);

  useEffect(() => {
    effectiveSpread.items.forEach((item) => {
      const shape = item.shape ?? "rect";
      const live = liveFrameSize[item.id];
      const w = live ? Math.max(20, live.width) : item.width;
      const h = live ? Math.max(20, live.height) : item.height;
      const clipFunc = getClipFunc(shape, w, h);
      const hasOverflow = shape === "rect" && item.imageId && (item.imageRotation ?? 0) !== 0;
      const clipGroup = clipGroupRefs.current[item.id];
      const slotGroup = groupRefs.current[item.id];
      if (hasOverflow && clipGroup) {
        clipGroup.clipFunc(clipFunc);
        if (slotGroup) (slotGroup as Konva.Group).clipFunc(getClipFunc("rect", 99999, 99999));
      } else if (slotGroup) {
        (slotGroup as Konva.Group).clipFunc(clipFunc);
      }
    });
  }, [effectiveSpread.items, liveFrameSize]);

  const selectedIdsSet = useMemo(() => new Set(selectedItemIds), [selectedItemIds]);
  const isSelected = useCallback((id: string) => selectedIdsSet.has(id), [selectedIdsSet]);
  const hasTextSelected = useMemo(
    () => selectedItemIds.some((id) => spread.texts?.some((t) => t.id === id)),
    [selectedItemIds, spread.texts]
  );
  const hasNonRectFrameSelected = useMemo(
    () =>
      selectedItemIds.some((id) => {
        const item = spread.items.find((i) => i.id === id);
        return item && item.shape && item.shape !== "rect";
      }),
    [selectedItemIds, spread.items]
  );

  /** Maneja clic en un ítem: Shift/Cmd añade o quita de la selección; si no, reemplaza. */
  const handleSelectItem = useCallback(
    (id: string, additive: boolean) => {
      if (additive) {
        const next = selectedIdsSet.has(id)
          ? selectedItemIds.filter((x) => x !== id)
          : [...selectedItemIds, id];
        onSelectItems(next);
      } else {
        onSelectItems([id]);
      }
    },
    [selectedItemIds, selectedIdsSet, onSelectItems]
  );

  useEffect(() => {
    if (!transformerRef.current) return;
    const editingBlocks = editingTextId && selectedItemIds.includes(editingTextId);
    if (transformDisabled || editingBlocks) {
      transformerRef.current.nodes([]);
      transformerRef.current.getLayer()?.batchDraw();
      return;
    }
    const nodes: Konva.Node[] = [];
    for (const id of selectedItemIds) {
      const groupNode = groupRefs.current[id];
      const textNode = textRefs.current[id];
      if (groupNode) nodes.push(groupNode);
      else if (textNode) nodes.push(textNode);
    }
    transformerRef.current.nodes(nodes);
    transformerRef.current.getLayer()?.batchDraw();
  }, [selectedItemIds, editingTextId, spread.items, spread.texts, transformDisabled]);

  useEffect(() => {
    if (!editingTextId || !editInputRef.current || !measureSpanRef.current) return;
    const input = editInputRef.current;
    const span = measureSpanRef.current;
    const text = spread.texts.find((t) => t.id === editingTextId);
    if (text) {
      span.textContent = text.text || " ";
      input.style.width = `${Math.max(40, span.offsetWidth + 12)}px`;
    }
    input.focus();
    input.select();
  }, [editingTextId, spread.texts]);

  useEffect(() => {
    if (!selectionBox) return;
    const onUp = () => setSelectionBox(null);
    window.addEventListener("mouseup", onUp);
    return () => window.removeEventListener("mouseup", onUp);
  }, [selectionBox]);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && (event.key === "+" || event.key === "=")) {
        event.preventDefault();
        setUserZoom((prev) => Math.min(3, prev * 1.1));
      }
      if ((event.metaKey || event.ctrlKey) && event.key === "-") {
        event.preventDefault();
        setUserZoom((prev) => Math.max(1, prev / 1.1)); // Mínimo 100%: no alejarse más del canvas
      }
      if (event.key === "Alt") setCenteredScaling(true);
      if (event.key === "Shift" || event.key === "Meta") setRatioLockModifier(event.shiftKey || event.metaKey);
    };
    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.key === "Alt") setCenteredScaling(false);
      if (event.key === "Shift" || event.key === "Meta") setRatioLockModifier(event.shiftKey || event.metaKey);
    };
    window.addEventListener("keydown", handleKey);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKey);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const container = stage.container();

    const handleDrop = (event: DragEvent) => {
      event.preventDefault();
      if (!event.dataTransfer) return;
      const imageId = event.dataTransfer.getData("application/x-image-id");
      if (!imageId) return;
      stage.setPointersPositions(event);
      const pointer = stage.getPointerPosition();
      if (!pointer) return;
      const point = {
        x: pointer.x / userZoom,
        y: pointer.y / userZoom,
      };

      const hit = spread.items.find(
        (item) =>
          point.x >= item.x &&
          point.x <= item.x + item.width &&
          point.y >= item.y &&
          point.y <= item.y + item.height
      );

      if (hit) {
        onAssignImage(hit.id, imageId);
        onSelectItems([hit.id]);
        return;
      }

      // Si es la primera foto en una hoja vacía, aplicar plantilla de 1 foto completa (full page)
      const isFirstPhotoOnEmptySheet = spread.items.length === 0;
      let w: number;
      let h: number;
      let dropX: number;
      let dropY: number;
      if (isFirstPhotoOnEmptySheet) {
        w = spec.pageWidth * 2;
        h = spec.pageHeight;
        dropX = spec.bleed;
        dropY = spec.bleed;
      } else {
        w = spec.pageWidth * 0.4;
        h = spec.pageHeight * 0.4;
        dropX = point.x - w / 2;
        dropY = point.y - h / 2;
      }
      const { x, y, width, height } = clampFrameToPrintable(spec, dropX, dropY, w, h);
      onCreateFrame({ x, y, width, height, imageId });
    };

    const handleDragOver = (event: DragEvent) => {
      event.preventDefault();
    };

    container.addEventListener("drop", handleDrop);
    container.addEventListener("dragover", handleDragOver);
    return () => {
      container.removeEventListener("drop", handleDrop);
      container.removeEventListener("dragover", handleDragOver);
    };
  }, [onAssignImage, onCreateFrame, onSelectItems, spread.items, spec.pageHeight, spec.pageWidth, userZoom]);

  const [frameShapeOpen, setFrameShapeOpen] = useState(false);
  const frameShapeWrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!frameShapeOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (frameShapeWrapRef.current && !frameShapeWrapRef.current.contains(e.target as Node)) {
        setFrameShapeOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [frameShapeOpen]);

  const handleAddFrame = (shape: FrameShape = "rect") => {
    setFrameShapeOpen(false);
    const baseW = spec.pageWidth * 0.4;
    const baseH = spec.pageHeight * 0.4;
    onCreateFrame({
      x: totalWidth / 2 - baseW / 2,
      y: totalHeight / 2 - baseH / 2,
      width: baseW,
      height: baseH,
      shape,
    });
  };

  const handleAddText = () => {
    const fontSize = 360;
    onCreateText({
      x: totalWidth / 2,
      y: totalHeight / 2 - fontSize / 2,
      text: "Texto",
      fontSize,
      fontFamily: getPolaroidFontFamily("inter"),
      fill: "#1a1a1a",
      align: "center",
    });
  };

  /** Redondea el ángulo al múltiplo de 90° más cercano (0, 90, 180, 270) para alineación con el horizonte. */
  const snapRotationTo90 = useCallback((deg: number) => Math.round(deg / 90) * 90, []);

  /** Inicia rotación por arrastre (desde esquina); stage e item para no depender del evento. Con Shift: imanta a 0°/90°/180°/270°. */
  const handleCornerRotateStart = useCallback(
    (item: FrameItem, stage: Konva.Stage | null) => {
      if (!stage) return;
      const group = groupRefs.current[item.id];
      if (!group) return;
      const pointer = stage.getPointerPosition();
      if (!pointer) return;
      const center = group.getAbsoluteTransform().point({
        x: item.width / 2,
        y: item.height / 2,
      });
      const startAngle = (Math.atan2(pointer.y - center.y, pointer.x - center.x) * 180) / Math.PI;
      const container = stage.container();

      const onMove = (e: MouseEvent) => {
        const state = rotationDragRef.current;
        if (!state) return;
        const st = state.group.getStage();
        if (!st) return;
        const pos = st.getPointerPosition();
        if (!pos) return;
        const c = state.group.getAbsoluteTransform().point({
          x: state.itemWidth / 2,
          y: state.itemHeight / 2,
        });
        const currentAngle = (Math.atan2(pos.y - c.y, pos.x - c.x) * 180) / Math.PI;
        let newRotation = state.startRotation + (currentAngle - state.startAngle);
        if (e.shiftKey) newRotation = snapRotationTo90(newRotation);
        onChangeItem(state.itemId, { rotation: newRotation });
      };

      const onUp = () => {
        const state = rotationDragRef.current;
        if (!state) return;
        container.removeEventListener("mousemove", state.onMove);
        container.removeEventListener("mouseup", state.onUp);
        rotationDragRef.current = null;
      };

      rotationDragRef.current = {
        itemId: item.id,
        startRotation: item.rotation,
        startAngle,
        group,
        itemWidth: item.width,
        itemHeight: item.height,
        onMove,
        onUp,
      };
      container.addEventListener("mousemove", onMove as EventListener);
      container.addEventListener("mouseup", onUp);
    },
    [onChangeItem, snapRotationTo90]
  );

  const texts = effectiveSpread.texts ?? [];

  return (
    <div className={`min-w-0 max-w-full w-full h-full flex flex-col overflow-hidden ${previewMode ? "" : "space-y-3"}`}>
      {!previewMode && showAddActions && (
      <div className="flex items-center justify-between flex-wrap gap-2 shrink-0">
        <div className="flex gap-2" ref={frameShapeWrapRef}>
          {showAddFrameButton && (showShapePicker ? (
            <div className="relative">
              <button
                type="button"
                onClick={() => setFrameShapeOpen((o) => !o)}
                title="Agregar recuadro (elegir forma)"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-[#d1d5db] bg-white text-[#1a1a1a] shadow-[0_1px_2px_rgba(0,0,0,0.06),0_2px_4px_rgba(0,0,0,0.06)] transition-shadow hover:bg-[#f9fafb] hover:border-[#c27b3d] hover:shadow-[0_2px_4px_rgba(0,0,0,0.08),0_4px_8px_rgba(0,0,0,0.06)] active:shadow-[inset_0_1px_2px_rgba(0,0,0,0.06)]"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <rect x="3" y="3" width="18" height="18" rx="1" />
                </svg>
                <span className="ml-0.5 text-[10px]">▼</span>
              </button>
              {frameShapeOpen && (
                <div className="absolute left-0 top-full z-20 mt-1 w-44 rounded-lg border border-[#e5e7eb] bg-white py-1 shadow-lg">
                  {(
                    [
                      { shape: "rect" as FrameShape, label: "Rectángulo", icon: "rect" },
                      { shape: "circle" as FrameShape, label: "Círculo", icon: "circle" },
                      { shape: "triangle" as FrameShape, label: "Triángulo", icon: "triangle" },
                      { shape: "pentagon" as FrameShape, label: "Pentágono", icon: "pentagon" },
                      { shape: "heart" as FrameShape, label: "Corazón", icon: "heart" },
                    ] as const
                  ).map(({ shape, label, icon }) => (
                    <button
                      key={shape}
                      type="button"
                      onClick={() => handleAddFrame(shape)}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[#1a1a1a] hover:bg-[#f9fafb]"
                    >
                      {icon === "rect" && (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0">
                          <rect x="3" y="3" width="18" height="18" rx="1" />
                        </svg>
                      )}
                      {icon === "circle" && (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0">
                          <circle cx="12" cy="12" r="9" />
                        </svg>
                      )}
                      {icon === "triangle" && (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0">
                          <path d="M12 2L2 22h20L12 2z" />
                        </svg>
                      )}
                      {icon === "pentagon" && (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0">
                          <path d="M12 2l9 6.5v7L12 22l-9-6.5v-7L12 2z" />
                        </svg>
                      )}
                      {icon === "heart" && (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0">
                          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                        </svg>
                      )}
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => handleAddFrame("rect")}
              title="Agregar recuadro"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-[#d1d5db] bg-white text-[#1a1a1a] shadow-[0_1px_2px_rgba(0,0,0,0.06),0_2px_4px_rgba(0,0,0,0.06)] transition-shadow hover:bg-[#f9fafb] hover:border-[#c27b3d] hover:shadow-[0_2px_4px_rgba(0,0,0,0.08),0_4px_8px_rgba(0,0,0,0.06)] active:shadow-[inset_0_1px_2px_rgba(0,0,0,0.06)]"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <rect x="3" y="3" width="18" height="18" rx="1" />
              </svg>
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={handleAddText}
          title="Agregar texto"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-[#d1d5db] bg-white text-[#1a1a1a] shadow-[0_1px_2px_rgba(0,0,0,0.06),0_2px_4px_rgba(0,0,0,0.06)] transition-shadow hover:bg-[#f9fafb] hover:border-[#c27b3d] hover:shadow-[0_2px_4px_rgba(0,0,0,0.08),0_4px_8px_rgba(0,0,0,0.06)] active:shadow-[inset_0_1px_2px_rgba(0,0,0,0.06)] font-bold text-lg ml-auto"
        >
          T
        </button>
      </div>
      )}
      <div className="w-full flex-1 min-h-0 overflow-hidden rounded-xl border border-[#374151] bg-[#1f2937] flex items-center justify-center">
        {(() => {
          const stageContent = (
            <div style={{ position: "relative", width: totalWidth, height: totalHeight }}>
              <Stage
          ref={stageRef}
          width={totalWidth}
          height={totalHeight}
          scale={{ x: userZoom, y: userZoom }}
          x={0}
          y={0}
          draggable={false}
          onMouseMove={(e) => {
            if (rotationDragRef.current) return;
            const stage = stageRef.current;
            if (!stage) return;
            const pointer = stage.getPointerPosition();
            if (!pointer) return;
            const stageX = pointer.x / userZoom;
            const stageY = pointer.y / userZoom;
            if (selectionBox) {
              setSelectionBox((prev) => prev ? { ...prev, currentX: stageX, currentY: stageY } : null);
              return;
            }
            const selectedItem = selectedItemIds[0] ? spread.items.find((i) => i.id === selectedItemIds[0]) : null;
            if (!selectedItem) {
              cornerHitRef.current = false;
              return;
            }
            const group = groupRefs.current[selectedItem.id];
            if (!group) {
              cornerHitRef.current = false;
              return;
            }
            const sw = selectedItem.width;
            const sh = selectedItem.height;
            const corners = [
              { x: 0, y: 0 },
              { x: sw, y: 0 },
              { x: sw, y: sh },
              { x: 0, y: sh },
            ].map((p) => group.getAbsoluteTransform().point(p));
            const threshold = 24;
            const near = corners.some(
              (c) => Math.hypot(pointer.x - c.x, pointer.y - c.y) < threshold
            );
            cornerHitRef.current = near;
          }}
          onMouseDown={(event) => {
            if (cornerHitRef.current && selectedItemIds[0] && !forceFrameRotationZero) {
              const item = spread.items.find((i) => i.id === selectedItemIds[0]);
              if (item) {
                handleCornerRotateStart(item, stageRef.current);
                event.cancelBubble = true;
                return;
              }
            }
            const target = event.target;
            const stage = target.getStage();
            const isOnEmpty = target === stage || (target as Konva.Node).getClassName?.() === "Layer";
            if (isOnEmpty) {
              const pointer = stage?.getPointerPosition();
              if (pointer && stage) {
                setSelectionBox({
                  startX: pointer.x / userZoom,
                  startY: pointer.y / userZoom,
                  currentX: pointer.x / userZoom,
                  currentY: pointer.y / userZoom,
                });
              }
            }
          }}
          onMouseUp={(event) => {
            if (selectionBox) {
              const { startX, startY, currentX, currentY } = selectionBox;
              const minX = Math.min(startX, currentX);
              const maxX = Math.max(startX, currentX);
              const minY = Math.min(startY, currentY);
              const maxY = Math.max(startY, currentY);
              const w = maxX - minX;
              const h = maxY - minY;
              setSelectionBox(null);
              if (w > 6 && h > 6) {
                const ids: string[] = [];
                for (const item of spread.items) {
                  const ix = item.x + item.width / 2;
                  const iy = item.y + item.height / 2;
                  if (ix >= minX && ix <= maxX && iy >= minY && iy <= maxY) ids.push(item.id);
                }
                for (const t of spread.texts || []) {
                  const tx = t.x + (t.width ?? 0) / 2;
                  const ty = t.y + (t.fontSize ?? 12) / 2;
                  if (tx >= minX && tx <= maxX && ty >= minY && ty <= maxY) ids.push(t.id);
                }
                onSelectItems(ids);
              } else {
                onSelectItems([]);
              }
              return;
            }
          }}
          onClick={(event) => {
            const target = event.target;
            const stage = target.getStage();
            const additive = !!((event.evt as unknown as Record<string, unknown>).shiftKey || (event.evt as unknown as Record<string, unknown>).metaKey || (event.evt as unknown as Record<string, unknown>).ctrlKey);
            if (!stage || target === stage) {
              if (!additive) onSelectItems([]);
              return;
            }
            let node: Konva.Node | null = target;
            while (node && node !== stage) {
              for (const item of spread.items) {
                if (groupRefs.current[item.id] === node) {
                  handleSelectItem(item.id, additive);
                  return;
                }
              }
              for (const text of spread.texts || []) {
                if (textRefs.current[text.id] === node) {
                  handleSelectItem(text.id, additive);
                  return;
                }
              }
              node = node.getParent();
            }
            if (!additive) onSelectItems([]);
          }}
          onTap={(event) => {
            const target = event.target;
            const stage = target.getStage();
            const additive = !!((event.evt as unknown as Record<string, unknown>).shiftKey || (event.evt as unknown as Record<string, unknown>).metaKey || (event.evt as unknown as Record<string, unknown>).ctrlKey);
            if (!stage || target === stage) {
              if (!additive) onSelectItems([]);
              return;
            }
            let node: Konva.Node | null = target;
            while (node && node !== stage) {
              for (const item of spread.items) {
                if (groupRefs.current[item.id] === node) {
                  handleSelectItem(item.id, additive);
                  return;
                }
              }
              for (const text of spread.texts || []) {
                if (textRefs.current[text.id] === node) {
                  handleSelectItem(text.id, additive);
                  return;
                }
              }
              node = node.getParent();
            }
            if (!additive) onSelectItems([]);
          }}
          onDblClick={(event) => {
            if (event.target === event.target.getStage()) {
              const stage = event.target.getStage();
              const pointer = stage?.getPointerPosition();
              const point =
                pointer && stage
                  ? { x: pointer.x / userZoom, y: pointer.y / userZoom }
                  : undefined;
              onDoubleClickEmpty?.(point);
            }
          }}
          onDblTap={(event) => {
            if (event.target === event.target.getStage()) {
              const stage = event.target.getStage();
              const pointer = stage?.getPointerPosition();
              const point =
                pointer && stage
                  ? { x: pointer.x / userZoom, y: pointer.y / userZoom }
                  : undefined;
              onDoubleClickEmpty?.(point);
            }
          }}
        >
          <Layer>
            <Rect width={totalWidth} height={totalHeight} fill="#1f2937" listening={false} />
            {splitSpreads ? (
              <>
                <Rect
                  x={spec.bleed}
                  y={spec.bleed}
                  width={spec.pageWidth}
                  height={spec.pageHeight}
                  fill={splitSpreads.left.backgroundColor ?? "#ffffff"}
                  listening={false}
                />
                <Rect
                  x={spec.bleed + spec.pageWidth}
                  y={spec.bleed}
                  width={spec.pageWidth}
                  height={spec.pageHeight}
                  fill={splitSpreads.right.backgroundColor ?? "#ffffff"}
                  listening={false}
                />
                {splitSpreads.left.backgroundImageId && (() => {
                  const bgImage = imageCache[splitSpreads.left.backgroundImageId!];
                  if (!bgImage) return null;
                  const bgW = spec.pageWidth * 2;
                  const bgH = spec.pageHeight;
                  const virtualFrame = { width: bgW, height: bgH, imageOffsetX: 0, imageOffsetY: 0 } as FrameItem;
                  const crop = getCoverCrop(bgImage, virtualFrame, 1);
                  return (
                    <Group
                      clipFunc={(ctx) => {
                        ctx.beginPath();
                        ctx.rect(spec.bleed, spec.bleed, spec.pageWidth, spec.pageHeight);
                      }}
                      listening={false}
                    >
                      <KonvaImage
                        image={bgImage}
                        x={spec.bleed}
                        y={spec.bleed}
                        width={spec.pageWidth}
                        height={bgH}
                        listening={false}
                        crop={{ x: crop.cropX, y: crop.cropY, width: crop.cropWidth / 2, height: crop.cropHeight }}
                      />
                    </Group>
                  );
                })()}
                {splitSpreads.right.backgroundImageId && (() => {
                  const bgImage = imageCache[splitSpreads.right.backgroundImageId!];
                  if (!bgImage) return null;
                  const bgW = spec.pageWidth * 2;
                  const bgH = spec.pageHeight;
                  const virtualFrame = { width: bgW, height: bgH, imageOffsetX: 0, imageOffsetY: 0 } as FrameItem;
                  const crop = getCoverCrop(bgImage, virtualFrame, 1);
                  return (
                    <Group
                      clipFunc={(ctx) => {
                        ctx.beginPath();
                        ctx.rect(spec.bleed + spec.pageWidth, spec.bleed, spec.pageWidth, spec.pageHeight);
                      }}
                      listening={false}
                    >
                      <KonvaImage
                        image={bgImage}
                        x={spec.bleed + spec.pageWidth}
                        y={spec.bleed}
                        width={spec.pageWidth}
                        height={bgH}
                        listening={false}
                        crop={{ x: crop.cropX + crop.cropWidth / 2, y: crop.cropY, width: crop.cropWidth / 2, height: crop.cropHeight }}
                      />
                    </Group>
                  );
                })()}
              </>
            ) : (
              <>
                <Rect
                  x={spec.bleed}
                  y={spec.bleed}
                  width={spec.pageWidth * 2}
                  height={spec.pageHeight}
                  fill={spread.backgroundColor ?? "#ffffff"}
                  listening={false}
                />
                {/* Imagen de fondo del spread (cover en el área de página) */}
                {spread.backgroundImageId && (() => {
              const bgImage = imageCache[spread.backgroundImageId];
              if (!bgImage) return null;
              const bgW = spec.pageWidth * 2;
              const bgH = spec.pageHeight;
              const virtualFrame = { width: bgW, height: bgH, imageOffsetX: 0, imageOffsetY: 0 } as FrameItem;
              const crop = getCoverCrop(bgImage, virtualFrame, 1);
              return (
                <KonvaImage
                  image={bgImage}
                  x={spec.bleed}
                  y={spec.bleed}
                  width={bgW}
                  height={bgH}
                  listening={false}
                  crop={{ x: crop.cropX, y: crop.cropY, width: crop.cropWidth, height: crop.cropHeight }}
                />
              );
            })()}
              </>
            )}
            {/* Guías: doblez central (solo si no editorPageMode) y safe cut 10mm. En editorPageMode no se muestra la línea del doblez para evitar corte entre hojas. */}
            {!previewMode && (
              <>
                {!editorPageMode && (
                  <Line
                    points={[spec.pageWidth + spec.bleed, spec.bleed, spec.pageWidth + spec.bleed, spec.pageHeight + spec.bleed]}
                    stroke="#4b5563"
                    strokeWidth={3}
                    dash={[6, 8]}
                    listening={false}
                  />
                )}
                <Rect
                  x={spec.bleed + safeInset}
                  y={spec.bleed + safeInset}
                  width={spec.pageWidth * 2 - safeInset * 2}
                  height={spec.pageHeight - safeInset * 2}
                  stroke="#4b5563"
                  dash={[6, 8]}
                  strokeWidth={3}
                  listening={false}
                />
              </>
            )}
            {/* Guías de alineación (imantado) cuando se arrastra un objeto */}
            {snapGuides.v.map((x) => (
              <Line
                key={`v-${x}`}
                points={[x, 0, x, totalHeight]}
                stroke="#c27b3d"
                strokeWidth={3}
                dash={[6, 6]}
                listening={false}
              />
            ))}
            {snapGuides.h.map((y) => (
              <Line
                key={`h-${y}`}
                points={[0, y, totalWidth, y]}
                stroke="#c27b3d"
                strokeWidth={3}
                dash={[6, 6]}
                listening={false}
              />
            ))}
            {/* Recuadro de selección por arrastre */}
            {selectionBox && (
              <Rect
                x={Math.min(selectionBox.startX, selectionBox.currentX)}
                y={Math.min(selectionBox.startY, selectionBox.currentY)}
                width={Math.abs(selectionBox.currentX - selectionBox.startX)}
                height={Math.abs(selectionBox.currentY - selectionBox.startY)}
                stroke="#c27b3d"
                strokeWidth={2}
                fill="rgba(194, 123, 61, 0.15)"
                dash={[6, 4]}
                listening={false}
              />
            )}

            {effectiveSpread.items.map((item) => {
              const live = liveFrameSize[item.id];
              const w = live ? Math.max(20, live.width) : item.width;
              const h = live ? Math.max(20, live.height) : item.height;
              const shape = item.shape ?? "rect";
              const { contentW, contentH } = getShapeContentSize(shape, w, h);
              const image = item.imageId ? imageCache[item.imageId] : undefined;
              const imageAsset = item.imageId ? imageMap[item.imageId] : undefined;
              const rotationFillScale = getRotationFillScale(item.imageRotation ?? 0);
              const itemForCrop = { ...item, width: contentW, height: contentH };
              const itemForCoverCrop = {
                ...item,
                width: contentW * rotationFillScale,
                height: contentH * rotationFillScale,
              };
              const fillZoom = getRotationFillZoom(item.imageRotation ?? 0);
              const effectiveZoom = Math.max(item.imageZoom || 1, fillZoom);
              const coverCrop = image ? getCoverCrop(image, itemForCoverCrop, effectiveZoom) : null;
              const containBase =
                image && item.fitMode === "contain"
                  ? getContainSize(image, contentW, contentH, effectiveZoom)
                  : null;
              const containSize =
                containBase
                  ? {
                      width: containBase.width * rotationFillScale,
                      height: containBase.height * rotationFillScale,
                    }
                  : null;
              const isDragging = draggingItemId === item.id;
              return (
                <React.Fragment key={item.id}>
                  {/* Fantasma en posición original cuando se arrastra (solo si hay swap, no en editorPageMode) */}
                  {isDragging && !editorPageMode && (
                    <Group
                      key={`ghost-${item.id}`}
                      x={item.x}
                      y={item.y}
                      offsetX={0}
                      offsetY={0}
                      listening={false}
                    >
                      {shape === "rect" && <Rect width={w} height={h} fill="#ffffff" listening={false} />}
                      {shape === "circle" && (contentW === contentH ? (
                        <Circle
                          x={contentW / 2}
                          y={contentH / 2}
                          radius={contentW / 2}
                          fill="#ffffff"
                          listening={false}
                        />
                      ) : (
                        <Ellipse
                          x={contentW / 2}
                          y={contentH / 2}
                          radiusX={contentW / 2}
                          radiusY={contentH / 2}
                          fill="#ffffff"
                          listening={false}
                        />
                      ))}
                      {shape !== "rect" && shape !== "circle" && <Rect width={contentW} height={contentH} x={(w - contentW) / 2} y={(h - contentH) / 2} fill="#ffffff" listening={false} />}
                      {image && item.fitMode === "cover" && coverCrop && (
                        <Group listening={false} x={w / 2} y={h / 2} offsetX={0} offsetY={0} rotation={item.imageRotation ?? 0}>
                          <KonvaImage
                            image={image}
                            x={-(contentW * rotationFillScale) / 2}
                            y={-(contentH * rotationFillScale) / 2}
                            width={contentW * rotationFillScale}
                            height={contentH * rotationFillScale}
                            crop={{ x: coverCrop.cropX, y: coverCrop.cropY, width: coverCrop.cropWidth, height: coverCrop.cropHeight }}
                            listening={false}
                          />
                        </Group>
                      )}
                      {image && item.fitMode === "contain" && containSize && (
                        <Group listening={false} x={w / 2} y={h / 2} offsetX={0} offsetY={0} rotation={item.imageRotation ?? 0}>
                          <KonvaImage
                            image={image}
                            width={containSize.width}
                            height={containSize.height}
                            x={-containSize.width / 2}
                            y={-containSize.height / 2}
                            listening={false}
                          />
                        </Group>
                      )}
                      <Rect
                        x={0}
                        y={0}
                        width={w}
                        height={h}
                        stroke={ACCENT_ORANGE}
                        strokeWidth={SELECTED_STROKE_WIDTH}
                        fill="transparent"
                        listening={false}
                      />
                    </Group>
                  )}
                <Group
                  key={item.id}
                  ref={(el) => {
                    if (el) groupRefs.current[item.id] = el as Konva.Group;
                  }}
                  x={item.x}
                  y={item.y}
                  offsetX={0}
                  offsetY={0}
                  scaleX={item.id === draggingItemId && !editorPageMode ? 0.3125 : 1}
                  scaleY={item.id === draggingItemId && !editorPageMode ? 0.3125 : 1}
                  rotation={forceFrameRotationZero ? 0 : (item.rotation ?? 0)}
                  opacity={item.id === draggingItemId && !editorPageMode ? 0.25 : 1}
                  draggable={transformDisabled ? !!onSwapFrames : true}
                  dragBoundFunc={(pos) => {
                    if (imagePanRef.current && imagePanRef.current.itemId === item.id) {
                      return { x: item.x, y: item.y };
                    }
                    let left = pos.x;
                    let top = pos.y;
                    if (snapEnabled) {
                      const otherItems = editorPageMode
                        ? spread.items
                            .filter((o) => o.id !== item.id)
                            .map((o) => {
                              const ow = liveFrameSize[o.id] ? Math.max(20, liveFrameSize[o.id].width) : o.width;
                              const oh = liveFrameSize[o.id] ? Math.max(20, liveFrameSize[o.id].height) : o.height;
                              return { x: o.x, y: o.y, width: ow, height: oh };
                            })
                        : undefined;
                      const { left: newLeft, top: newTop } = snapToGuides(left, top, w, h, spec, otherItems);
                      left = newLeft;
                      top = newTop;
                    }
                    const clamped = clampFrameToPrintable(spec, left, top, w, h, item.shape);
                    return { x: clamped.x, y: clamped.y };
                  }}
                  onClick={(e) => { handleSelectItem(item.id, !!((e.evt as unknown as Record<string, unknown>).shiftKey || (e.evt as unknown as Record<string, unknown>).metaKey || (e.evt as unknown as Record<string, unknown>).ctrlKey)); }}
                  onTap={(e) => { handleSelectItem(item.id, !!((e.evt as unknown as Record<string, unknown>).shiftKey || (e.evt as unknown as Record<string, unknown>).metaKey || (e.evt as unknown as Record<string, unknown>).ctrlKey)); }}
                  onMouseDown={(e) => { handleSelectItem(item.id, !!((e.evt as unknown as Record<string, unknown>).shiftKey || (e.evt as unknown as Record<string, unknown>).metaKey || (e.evt as unknown as Record<string, unknown>).ctrlKey)); }}
                  onTouchStart={() => { handleSelectItem(item.id, false); }}
                  onDblClick={() => {
                    handleSelectItem(item.id, false);
                    onDoubleClickItem?.(item.id, "frame");
                  }}
                  onDblTap={() => {
                    handleSelectItem(item.id, false);
                    onDoubleClickItem?.(item.id, "frame");
                  }}
                  onTransform={undefined}
                  onTransformEnd={transformDisabled ? undefined : (e) => {
                    const g = e.target as Konva.Group;
                    const scaleX = g.scaleX();
                    const scaleY = g.scaleY();
                    const rot = g.rotation();
                    const newW = Math.max(20, item.width * scaleX);
                    const newH = Math.max(20, item.height * scaleY);
                    const left = g.x();
                    const top = g.y();
                    setLiveFrameSize((prev) => {
                      const next = { ...prev };
                      delete next[item.id];
                      return next;
                    });
                    const clamped = clampFrameToPrintable(spec, left, top, newW, newH, item.shape);
                    g.scaleX(1);
                    g.scaleY(1);
                    g.rotation(0);
                    g.x(clamped.x);
                    g.y(clamped.y);
                    onChangeItem(item.id, {
                      x: clamped.x,
                      y: clamped.y,
                      width: clamped.width,
                      height: clamped.height,
                      ...(forceFrameRotationZero ? { rotation: 0 } : { rotation: rot }),
                    });
                  }}
                  onDragStart={(e) => {
                    const altKey = (e.evt as MouseEvent).altKey;
                    const canImagePan =
                      altKey &&
                      selectedItemIds.length === 1 &&
                      selectedItemIds[0] === item.id &&
                      item.imageId &&
                      !transformDisabled;
                    if (canImagePan) {
                      const stage = (e.target as Konva.Group).getStage();
                      const pos = stage?.getPointerPosition();
                      if (pos) {
                        imagePanRef.current = {
                          itemId: item.id,
                          startPointerX: pos.x,
                          startPointerY: pos.y,
                          startOffsetX: item.imageOffsetX ?? 0,
                          startOffsetY: item.imageOffsetY ?? 0,
                        };
                      }
                    }
                    setDraggingItemId(item.id);
                    setDropTargetItemId(null);
                    const multi = selectedItemIds.length > 1 && selectedItemIds.includes(item.id);
                    if (multi) {
                      const pos: Record<string, { x: number; y: number; width: number; height: number }> = {};
                      for (const id of selectedItemIds) {
                        const it = spread.items.find((i) => i.id === id);
                        if (it) pos[id] = { x: it.x, y: it.y, width: it.width, height: it.height };
                        const txt = spread.texts?.find((t) => t.id === id);
                        if (txt) pos[id] = { x: txt.x, y: txt.y, width: txt.width ?? 100, height: txt.fontSize ?? 12 };
                      }
                      dragStartPositionsRef.current = pos;
                    } else {
                      dragStartPositionsRef.current = {};
                    }
                  }}
                  onDragMove={(e) => {
                    const g = e.target as Konva.Group;
                    if (imagePanRef.current && imagePanRef.current.itemId === item.id) {
                      const pan = imagePanRef.current;
                      const stage = g.getStage();
                      const pos = stage?.getPointerPosition();
                      if (pos) {
                        const dx = pos.x - pan.startPointerX;
                        const dy = pos.y - pan.startPointerY;
                        onChangeItem(item.id, {
                          imageOffsetX: Math.round(pan.startOffsetX + dx),
                          imageOffsetY: Math.round(pan.startOffsetY + dy),
                        });
                      }
                      return;
                    }
                    const multi = selectedItemIds.length > 1 && selectedItemIds.includes(item.id);
                    if (multi && dragStartPositionsRef.current[item.id]) {
                      const start = dragStartPositionsRef.current[item.id];
                      const dx = g.x() - start.x;
                      const dy = g.y() - start.y;
                      for (const id of selectedItemIds) {
                        if (id === item.id) continue;
                        const s = dragStartPositionsRef.current[id];
                        if (s) {
                          const newLeft = s.x + dx;
                          const newTop = s.y + dy;
                          const isText = spread.texts?.some((t) => t.id === id);
                          if (isText) {
                            onChangeText(id, { x: newLeft, y: newTop });
                          } else {
                            const otherItem = spread.items.find((i) => i.id === id);
                            const clamped = clampFrameToPrintable(spec, newLeft, newTop, s.width, s.height, otherItem?.shape);
                            onChangeItem(id, { x: clamped.x, y: clamped.y });
                          }
                        }
                      }
                    }
                    if (snapEnabled) {
                      const left = g.x();
                      const top = g.y();
                      const excludeIds = multi ? new Set(selectedItemIds) : new Set([item.id]);
                      const otherItems = editorPageMode
                        ? spread.items
                            .filter((o) => !excludeIds.has(o.id))
                            .map((o) => {
                              const ow = liveFrameSize[o.id] ? Math.max(20, liveFrameSize[o.id].width) : o.width;
                              const oh = liveFrameSize[o.id] ? Math.max(20, liveFrameSize[o.id].height) : o.height;
                              return { x: o.x, y: o.y, width: ow, height: oh };
                            })
                        : undefined;
                      const { guides } = snapToGuides(left, top, w, h, spec, otherItems);
                      setSnapGuides(guides);
                    }
                    if (!editorPageMode && !multi) {
                      const centerX = g.x() + w / 2;
                      const centerY = g.y() + h / 2;
                      const other = spread.items.find((it) => {
                        if (it.id === item.id) return false;
                        const ow = liveFrameSize[it.id] ? Math.max(20, liveFrameSize[it.id].width) : it.width;
                        const oh = liveFrameSize[it.id] ? Math.max(20, liveFrameSize[it.id].height) : it.height;
                        return (
                          centerX >= it.x &&
                          centerX <= it.x + ow &&
                          centerY >= it.y &&
                          centerY <= it.y + oh
                        );
                      });
                      setDropTargetItemId(other?.id ?? null);
                    }
                  }}
                  onDragEnd={(event) => {
                    const wasImagePan = imagePanRef.current && imagePanRef.current.itemId === item.id;
                    imagePanRef.current = null;
                    setDraggingItemId(null);
                    setDropTargetItemId(null);
                    setSnapGuides({ v: [], h: [] });
                    dragStartPositionsRef.current = {};
                    const g = event.target as Konva.Group;
                    if (wasImagePan) {
                      g.position({ x: item.x, y: item.y });
                      return;
                    }
                    const left = g.x();
                    const top = g.y();
                    const centerX = left + w / 2;
                    const centerY = top + h / 2;
                    const multi = selectedItemIds.length > 1 && selectedItemIds.includes(item.id);
                    if (multi) {
                      const clamped = clampFrameToPrintable(spec, left, top, w, h, item.shape);
                      onChangeItem(item.id, { x: clamped.x, y: clamped.y });
                    } else {
                      const other = spread.items.find((it) => {
                        if (it.id === item.id) return false;
                        const ow = liveFrameSize[it.id] ? Math.max(20, liveFrameSize[it.id].width) : it.width;
                        const oh = liveFrameSize[it.id] ? Math.max(20, liveFrameSize[it.id].height) : it.height;
                        return (
                          centerX >= it.x &&
                          centerX <= it.x + ow &&
                          centerY >= it.y &&
                          centerY <= it.y + oh
                        );
                      });
                      if (other && onSwapFrames) {
                        onSwapFrames(item.id, other.id);
                        g.position({ x: item.x, y: item.y });
                      } else if (transformDisabled) {
                        g.position({ x: item.x, y: item.y });
                      } else {
                        const clamped = clampFrameToPrintable(spec, left, top, w, h, item.shape);
                        onChangeItem(item.id, { x: clamped.x, y: clamped.y });
                      }
                    }
                  }}
                >
                  {/* Rect para el Transformer: todas las formas usan el frame completo */}
                  <Rect
                    x={0}
                    y={0}
                    width={item.width}
                    height={item.height}
                    fill="transparent"
                    listening={true}
                    onClick={(e) => { handleSelectItem(item.id, !!((e.evt as unknown as Record<string, unknown>).shiftKey || (e.evt as unknown as Record<string, unknown>).metaKey || (e.evt as unknown as Record<string, unknown>).ctrlKey)); }}
                    onTap={(e) => { handleSelectItem(item.id, !!((e.evt as unknown as Record<string, unknown>).shiftKey || (e.evt as unknown as Record<string, unknown>).metaKey || (e.evt as unknown as Record<string, unknown>).ctrlKey)); }}
                    onMouseDown={(e) => { handleSelectItem(item.id, !!((e.evt as unknown as Record<string, unknown>).shiftKey || (e.evt as unknown as Record<string, unknown>).metaKey || (e.evt as unknown as Record<string, unknown>).ctrlKey)); }}
                    onTouchStart={() => { handleSelectItem(item.id, false); }}
                    onDblClick={() => onDoubleClickItem?.(item.id, "frame")}
                    onDblTap={() => onDoubleClickItem?.(item.id, "frame")}
                  />
                  {shape === "rect" && (
                    <Rect
                      width={w}
                      height={h}
                      fill="#ffffff"
                      opacity={item.id === dropTargetItemId ? 0.5 : 1}
                      listening={false}
                    />
                  )}
                  {shape === "circle" && (contentW === contentH ? (
                    <Circle
                      x={contentW / 2}
                      y={contentH / 2}
                      radius={contentW / 2}
                      stroke={isSelected(item.id) || item.id === draggingItemId ? ACCENT_ORANGE : item.id === dropTargetItemId ? DROP_TARGET_BLUE : "#e5e7eb"}
                      strokeWidth={isSelected(item.id) || item.id === draggingItemId ? SELECTED_STROKE_WIDTH : 2}
                      fill="#ffffff"
                      opacity={item.id === dropTargetItemId ? 0.5 : 1}
                      listening={false}
                    />
                  ) : (
                    <Ellipse
                      x={contentW / 2}
                      y={contentH / 2}
                      radiusX={contentW / 2}
                      radiusY={contentH / 2}
                      stroke={isSelected(item.id) || item.id === draggingItemId ? ACCENT_ORANGE : item.id === dropTargetItemId ? DROP_TARGET_BLUE : "#e5e7eb"}
                      strokeWidth={isSelected(item.id) || item.id === draggingItemId ? SELECTED_STROKE_WIDTH : 2}
                      fill="#ffffff"
                      opacity={item.id === dropTargetItemId ? 0.5 : 1}
                      listening={false}
                    />
                  ))}
                  {shape === "triangle" && (() => {
                    const pts = getShapePoints(shape, w, h);
                    return pts ? (
                      <Line
                        points={pts}
                        closed
                        stroke={isSelected(item.id) || item.id === draggingItemId ? ACCENT_ORANGE : item.id === dropTargetItemId ? DROP_TARGET_BLUE : "#e5e7eb"}
                        strokeWidth={isSelected(item.id) || item.id === draggingItemId ? SELECTED_STROKE_WIDTH : 2}
                        fill="#ffffff"
                        opacity={item.id === dropTargetItemId ? 0.5 : 1}
                        listening={false}
                      />
                    ) : null;
                  })()}
                  {shape === "pentagon" && (() => {
                    const pts = getShapePoints(shape, w, h);
                    return pts ? (
                      <Line
                        points={pts}
                        closed
                        stroke={isSelected(item.id) || item.id === draggingItemId ? ACCENT_ORANGE : item.id === dropTargetItemId ? DROP_TARGET_BLUE : "#e5e7eb"}
                        strokeWidth={isSelected(item.id) || item.id === draggingItemId ? SELECTED_STROKE_WIDTH : 2}
                        fill="#ffffff"
                        opacity={item.id === dropTargetItemId ? 0.5 : 1}
                        listening={false}
                      />
                    ) : null;
                  })()}
                  {shape === "heart" && (() => {
                    const ox = (w - contentW) / 2;
                    const oy = (h - contentH) / 2;
                    const hcx = ox + contentW / 2;
                    const v = contentH / 7;
                    const hcy = oy + 2 * v;
                    const u = contentW / 8;
                    return (
                    <Shape
                      sceneFunc={(ctx, shape) => {
                        ctx.beginPath();
                        ctx.moveTo(hcx, hcy + v);
                        ctx.bezierCurveTo(hcx, hcy - 2 * v, hcx - 4 * u, hcy - 2 * v, hcx - 4 * u, hcy + v);
                        ctx.bezierCurveTo(hcx - 4 * u, hcy + 3 * v, hcx, hcy + 5 * v, hcx, hcy + 5 * v);
                        ctx.bezierCurveTo(hcx, hcy + 5 * v, hcx + 4 * u, hcy + 3 * v, hcx + 4 * u, hcy + v);
                        ctx.bezierCurveTo(hcx + 4 * u, hcy - 2 * v, hcx, hcy - 2 * v, hcx, hcy + v);
                        ctx.closePath();
                        ctx.fillStrokeShape(shape);
                      }}
                      fill="#ffffff"
                      stroke={isSelected(item.id) || item.id === draggingItemId ? ACCENT_ORANGE : item.id === dropTargetItemId ? DROP_TARGET_BLUE : "#e5e7eb"}
                      strokeWidth={isSelected(item.id) || item.id === draggingItemId ? SELECTED_STROKE_WIDTH : 2}
                      opacity={item.id === dropTargetItemId ? 0.5 : 1}
                      listening={false}
                    />
                    );
                  })()}
                  {image && item.fitMode === "cover" && coverCrop ? (() => {
                    const hasOverflow = shape === "rect" && (item.imageRotation ?? 0) !== 0;
                    const imgGroup = (
                      <Group
                        listening={false}
                        offsetX={0}
                        offsetY={0}
                        x={w / 2}
                        y={h / 2}
                        rotation={item.imageRotation ?? 0}
                        {...(!hasOverflow && { opacity: item.id === dropTargetItemId ? 0.5 : 1 })}
                      >
                        <KonvaImage
                          image={image}
                          x={-(contentW * rotationFillScale) / 2}
                          y={-(contentH * rotationFillScale) / 2}
                          width={contentW * rotationFillScale}
                          height={contentH * rotationFillScale}
                          scaleX={1}
                          scaleY={1}
                          crop={{
                            x: coverCrop.cropX,
                            y: coverCrop.cropY,
                            width: coverCrop.cropWidth,
                            height: coverCrop.cropHeight,
                          }}
                          opacity={item.imageOpacity ?? 1}
                        />
                      </Group>
                    );
                    return hasOverflow ? (
                      <Group ref={(el) => { if (el) clipGroupRefs.current[item.id] = el as Konva.Group; }} listening={false} opacity={item.id === dropTargetItemId ? 0.5 : 1}>
                        {imgGroup}
                      </Group>
                    ) : (
                      imgGroup
                    );
                  })() : null}
                  {image && item.fitMode === "contain" && containSize ? (() => {
                    const hasOverflow = shape === "rect" && (item.imageRotation ?? 0) !== 0;
                    const imgGroupContain = (
                      <Group
                        listening={false}
                        offsetX={0}
                        offsetY={0}
                        x={w / 2}
                        y={h / 2}
                        rotation={item.imageRotation ?? 0}
                        {...(!hasOverflow && { opacity: item.id === dropTargetItemId ? 0.5 : 1 })}
                      >
                        <KonvaImage
                          image={image}
                          width={containSize.width}
                          height={containSize.height}
                          x={-containSize.width / 2}
                          y={-containSize.height / 2}
                          opacity={item.imageOpacity ?? 1}
                        />
                      </Group>
                    );
                    return hasOverflow ? (
                      <Group ref={(el) => { if (el) clipGroupRefs.current[item.id] = el as Konva.Group; }} listening={false} opacity={item.id === dropTargetItemId ? 0.5 : 1}>
                        {imgGroupContain}
                      </Group>
                    ) : (
                      imgGroupContain
                    );
                  })() : null}
                  {!image ? (
                    <Rect
                      x={0}
                      y={0}
                      width={w}
                      height={h}
                      fill="#f8fafc"
                      opacity={item.id === dropTargetItemId ? 0.5 : 1}
                      listening={false}
                    />
                  ) : null}
                  {/* Overlay destino de drop: azul 50% para indicar dónde se intercambiará */}
                  {item.id === dropTargetItemId && (
                    <Rect
                      x={0}
                      y={0}
                      width={w}
                      height={h}
                      fill={DROP_TARGET_BLUE}
                      opacity={0.5}
                      listening={false}
                    />
                  )}
                  {/* Borde del marco: naranja si seleccionado/arrastrado, azul si destino, sino gris */}
                  {shape === "rect" && (
                    <Rect
                      width={w}
                      height={h}
                      stroke={
                        isSelected(item.id) || item.id === draggingItemId
                          ? ACCENT_ORANGE
                          : item.id === dropTargetItemId
                            ? DROP_TARGET_BLUE
                            : (item.borderColor ?? "#e5e7eb")
                      }
                      strokeWidth={
                        isSelected(item.id) || item.id === draggingItemId
                          ? SELECTED_STROKE_WIDTH
                          : Math.max(0, item.borderWidth ?? 0) > 0
                            ? Math.max(1, item.borderWidth ?? 0)
                            : 2
                      }
                      fill="transparent"
                      listening={false}
                    />
                  )}
                  {!image && imageAsset ? (
                    <KonvaImage
                      image={imageCache[imageAsset.id]}
                      x={0}
                      y={0}
                      width={w}
                      height={h}
                      opacity={item.id === dropTargetItemId ? 0.5 : 1}
                      listening={false}
                    />
                  ) : null}
                </Group>
                </React.Fragment>
              );
            })}
            {texts.map((textItem) => {
              const isEditing = editingTextId === textItem.id;
              return (
                <Text
                  key={textItem.id}
                  ref={(node) => {
                    if (node) textRefs.current[textItem.id] = node;
                  }}
                  x={textItem.x}
                  y={textItem.y}
                  text={isEditing ? "" : (textItem.text || "Texto")}
                  fontSize={textItem.fontSize}
                  fontFamily={`${getPolaroidFontFamily(normalizePolaroidFontValue(textItem.fontFamily))}, ${POLAROID_FONT_FALLBACK}`}
                  fill={textItem.fill}
                  rotation={textItem.rotation}
                  align={textItem.align}
                  fontStyle={
                    [textItem.bold && "bold", textItem.italic && "italic"].filter(Boolean).join(" ") || "normal"
                  }
                  textDecoration={textItem.underline ? "underline" : ""}
                  letterSpacing={textItem.letterSpacing ?? 0}
                  lineHeight={textItem.lineHeight ?? 1}
                  width={textItem.width}
                  wrap="none"
                  listening={!isEditing}
                  draggable={!isEditing && !transformDisabled}
                  visible={!isEditing}
                  onClick={(e) => { handleSelectItem(textItem.id, !!((e.evt as unknown as Record<string, unknown>).shiftKey || (e.evt as unknown as Record<string, unknown>).metaKey || (e.evt as unknown as Record<string, unknown>).ctrlKey)); }}
                  onTap={(e) => { handleSelectItem(textItem.id, !!((e.evt as unknown as Record<string, unknown>).shiftKey || (e.evt as unknown as Record<string, unknown>).metaKey || (e.evt as unknown as Record<string, unknown>).ctrlKey)); }}
                  onDblClick={(e) => {
                    e.cancelBubble = true;
                    handleSelectItem(textItem.id, false);
                    const node = textRefs.current[textItem.id];
                    if (node) {
                      setEditTextRect({
                        x: textItem.x,
                        y: textItem.y,
                        width: node.width(),
                        height: node.height(),
                      });
                    }
                    setEditingTextId(textItem.id);
                  }}
                  onDblTap={(e) => {
                    e.cancelBubble = true;
                    handleSelectItem(textItem.id, false);
                    const node = textRefs.current[textItem.id];
                    if (node) {
                      setEditTextRect({
                        x: textItem.x,
                        y: textItem.y,
                        width: node.width(),
                        height: node.height(),
                      });
                    }
                    setEditingTextId(textItem.id);
                  }}
                  onDragMove={(e) => {
                    if (!snapEnabled) return;
                    const node = e.target;
                    const w = node.width();
                    const h = node.height();
                    const left = node.x();
                    const top = node.y();
                    const { left: newLeft, top: newTop, guides } = snapToGuides(left, top, w, h, spec);
                    node.position({ x: newLeft, y: newTop });
                    setSnapGuides(guides);
                  }}
                  onDragEnd={(e) => {
                    setSnapGuides({ v: [], h: [] });
                    onChangeText(textItem.id, { x: e.target.x(), y: e.target.y() });
                  }}
                  onTransformEnd={(e) => {
                    const node = e.target;
                    const scaleX = node.scaleX();
                    node.scaleX(1);
                    node.scaleY(1);
                    onChangeText(textItem.id, {
                      x: node.x(),
                      y: node.y(),
                      fontSize: Math.max(8, Math.round(textItem.fontSize * scaleX)),
                      rotation: node.rotation(),
                    });
                  }}
                />
              );
            })}
            <Transformer
              ref={transformerRef}
              rotateEnabled={forceFrameRotationZero ? false : rotateEnabled}
              centeredScaling={centeredScaling}
              keepRatio={hasTextSelected || hasNonRectFrameSelected || ratioLockModifier}
              borderStroke="#c27b3d"
              borderStrokeWidth={editorPageMode ? 3 : 2}
              anchorSize={editorPageMode ? 24 : 16}
              anchorCornerRadius={editorPageMode ? 6 : 4}
              anchorFill="#c27b3d"
              anchorStroke="#fff"
              anchorStrokeWidth={editorPageMode ? 3 : 2.5}
              rotateAnchorOffset={45}
              boundBoxFunc={(oldBox, newBox) => {
                if (newBox.width < 20 || newBox.height < 20) return oldBox;
                return newBox;
              }}
            />
          </Layer>
        </Stage>
        {editingTextId && editTextRect && (() => {
          const editingText = spread.texts.find((t) => t.id === editingTextId);
          if (!editingText) return null;
          const resolvedFont = `${getPolaroidFontFamily(normalizePolaroidFontValue(editingText.fontFamily))}, ${POLAROID_FONT_FALLBACK}`;
          const textStyle = {
            fontFamily: resolvedFont,
            fontSize: editingText.fontSize * userZoom,
            fontWeight: editingText.bold ? "bold" : "normal",
            fontStyle: editingText.italic ? "italic" : "normal",
            letterSpacing: (editingText.letterSpacing ?? 0) * userZoom,
          };
          return (
            <>
              <span
                ref={measureSpanRef}
                aria-hidden
                style={{
                  position: "absolute",
                  left: -9999,
                  top: 0,
                  visibility: "hidden",
                  whiteSpace: "pre",
                  ...textStyle,
                }}
              />
              <input
                ref={editInputRef}
                type="text"
                className="bg-transparent outline-none resize-none border-none focus:ring-0 focus:outline-none"
                style={{
                  position: "absolute",
                  left: editTextRect.x * userZoom,
                  top: editTextRect.y * userZoom,
                  minWidth: 40,
                  width: Math.max(40, editTextRect.width * userZoom),
                  height: Math.max(24, editTextRect.height * userZoom),
                  fontFamily: resolvedFont,
                  fontSize: editingText.fontSize * userZoom,
                  color: editingText.fill,
                  fontWeight: editingText.bold ? "bold" : "normal",
                  fontStyle: editingText.italic ? "italic" : "normal",
                  textAlign: editingText.align,
                  letterSpacing: (editingText.letterSpacing ?? 0) * userZoom,
                  lineHeight: (editingText.lineHeight ?? 1) * (editingText.fontSize * userZoom),
                  padding: 0,
                  boxSizing: "border-box",
                  zIndex: 10,
                }}
                defaultValue={editingText.text || "Texto"}
                onInput={(e) => {
                  const el = e.currentTarget;
                  const span = measureSpanRef.current;
                  if (span) {
                    span.style.fontFamily = resolvedFont;
                    span.style.fontSize = `${editingText.fontSize * userZoom}px`;
                    span.style.fontWeight = editingText.bold ? "bold" : "normal";
                    span.style.fontStyle = editingText.italic ? "italic" : "normal";
                    span.style.letterSpacing = `${(editingText.letterSpacing ?? 0) * userZoom}px`;
                    span.textContent = el.value || " ";
                    el.style.width = `${Math.max(40, span.offsetWidth + 12)}px`;
                  }
                }}
                onBlur={(e) => {
                  const value = e.target.value.trim() || "Texto";
                  const span = measureSpanRef.current;
                  const widthPx = span ? span.offsetWidth + 12 : editTextRect.width * userZoom;
                  const widthStage = Math.max(20, widthPx / userZoom);
                  onChangeText(editingTextId, { text: value, width: widthStage });
                  setEditingTextId(null);
                  setEditTextRect(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    e.currentTarget.blur();
                  }
                  e.stopPropagation();
                }}
                onClick={(e) => e.stopPropagation()}
              />
            </>
          );
        })()}
            </div>
          );
          const pageModeContent = (
            <div
              style={{
                overflow: "hidden",
                width: (totalWidth * userZoom) / 2,
                height: totalHeight * userZoom,
              }}
            >
              <div
                style={{
                  width: totalWidth * userZoom,
                  height: totalHeight * userZoom,
                  overflow: "hidden",
                  transform: `translateX(${(bookHalf ? bookHalf === "right" : pageSide === "right") ? -(totalWidth * userZoom) / 2 : 0}px)`,
                }}
              >
                {stageContent}
              </div>
            </div>
          );
          if (bookHalf && containerWidth > 0 && containerHeight > 0) {
            const halfW = (totalWidth * userZoom) / 2;
            const halfH = totalHeight * userZoom;
            const fitScale = Math.min(containerWidth / halfW, containerHeight / halfH) || 1;
            const overflowScale = allowOverflow ? 1.18 : 1;
            return (
              <div
                style={{
                  width: containerWidth,
                  height: containerHeight,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  overflow: allowOverflow ? "visible" : "hidden",
                }}
              >
                <div
                  style={{
                    transform: `scale(${fitScale * overflowScale})`,
                    transformOrigin: "center center",
                  }}
                >
                  {pageModeContent}
                </div>
              </div>
            );
          }
          return viewMode === "page" ? pageModeContent : (
            (() => {
              // Usar dimensiones de fallback al inicio para que el canvas encaje desde el primer render (evitar caja blanca vacía)
              const effW = containerWidth > 0 ? containerWidth : 800;
              const effH = containerHeight > 0 ? containerHeight : 500;
              if (viewMode === "spread") {
                const stageW = totalWidth * userZoom;
                const stageH = totalHeight * userZoom;
                const targetWidth = effW * 0.75;
                const targetHeight = effH;
                // Escala para que el canvas ocupe 75% del ancho (o altura si limita antes), sin tope máximo
                const fitScale = previewMode
                  ? Math.max(effW / stageW, effH / stageH)
                  : Math.min(
                      stageW > 0 ? targetWidth / stageW : 1,
                      stageH > 0 ? targetHeight / stageH : 1
                    ) || 1;
                const scaledW = stageW * fitScale;
                const scaledH = stageH * fitScale;
                return (
                  <div
                    style={{
                      width: effW,
                      height: effH,
                      overflow: "hidden",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <div
                      style={{
                        width: scaledW,
                        height: scaledH,
                        overflow: "hidden",
                        flexShrink: 0,
                      }}
                    >
                      <div
                        style={{
                          width: stageW,
                          height: stageH,
                          transform: `scale(${fitScale}, ${fitScale})`,
                          transformOrigin: "0 0",
                        }}
                      >
                        {stageContent}
                      </div>
                    </div>
                  </div>
                );
              }
              return stageContent;
            })()
          );
        })()}
      </div>
    </div>
  );
}
