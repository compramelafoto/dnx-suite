"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import CanvasEditor from "@/components/fotolibros/CanvasEditor";
import Inspector from "@/components/fotolibros/Inspector";
import ImageBrowser from "@/components/fotolibros/ImageBrowser";
import SheetNavigator from "@/components/fotolibros/SheetNavigator";
import LayoutTemplatesStrip from "@/components/fotolibros/LayoutTemplatesStrip";
import { LAYOUT_TEMPLATES } from "@/components/fotolibros/LayoutTemplatesStrip";

/** Índice de la plantilla "Vacío" (0 slots). Hoja inicia sin recuadros. */
const EMPTY_LAYOUT_INDEX = LAYOUT_TEMPLATES.findIndex((t) => t.slots.length === 0);
import { slotToRect, getFitModeForMinVisible, getBestTemplateIndexForOrientations, getBestImageOrderForTemplate } from "@/components/fotolibros/layoutTemplates";
import type { LayoutTemplate } from "@/components/fotolibros/layoutTemplates";
import { saveUserLayoutFromSpread, getUserLayoutsForSlotCount, type UserLayout } from "@/lib/userLayouts";
import { useImageOrientations } from "@/components/fotolibros/useImageOrientations";
import { clampFrameToPrintable } from "@/components/fotolibros/printableArea";
import { useHistory } from "@/components/fotolibros/useHistory";
import type { AlbumDocument, FrameItem, ImageAsset, Spread, TextItem } from "@/components/fotolibros/types";

/** Export a 300 DPI: 1 cm = 300/2.54 px */
const DPI = 300;
const CM_TO_PX = DPI / 2.54;
const PX_TO_CM = 2.54 / DPI;
const BLEED_SAFE_PX = Math.round((3 / 10) * CM_TO_PX); // 3 mm (para export/impresión)
const SAFE_CUT_PX = Math.round(1 * CM_TO_PX); // 10 mm margen de corte seguro (guías en hoja principal)
const DISPLAY_BLEED_PX = 8; // Margen visual mínimo alrededor del canvas
const MIN_CM = 1;
const MAX_CM = 100;
const MAX_CM_FULL_WIDTH = 200;
const MIN_PX = MIN_CM * CM_TO_PX;
const MAX_PX = MAX_CM * CM_TO_PX;

const createInitialDocument = (): AlbumDocument => ({
  id: "design",
  title: "Diseño",
  spec: {
    pageWidth: Math.round(20 * CM_TO_PX),   // 20 cm a 300 DPI
    pageHeight: Math.round(20 * CM_TO_PX),  // 20 cm
    bleed: DISPLAY_BLEED_PX,   // Margen visual mínimo (8px)
    safe: SAFE_CUT_PX,         // Guía safe cut 10 mm desde todos los bordes
  },
  spreads: Array.from({ length: 6 }).map((_, index) => ({
    id: `spread-${index + 1}`,
    items: [],
    texts: [],
  })),
});

const createId = () => `frame-${Math.random().toString(36).slice(2, 10)}`;

const PRESET_BACKGROUND_COLORS: { hex: string; name: string }[] = [
  { hex: "#ffffff", name: "Blanco" },
  { hex: "#f8f9fa", name: "Gris claro" },
  { hex: "#e9ecef", name: "Gris" },
  { hex: "#dee2e6", name: "Gris medio" },
  { hex: "#adb5bd", name: "Gris oscuro" },
  { hex: "#212529", name: "Negro" },
  { hex: "#fff8f0", name: "Crema" },
  { hex: "#f5f5dc", name: "Beige" },
  { hex: "#ffe4e6", name: "Rosa claro" },
  { hex: "#e0f2fe", name: "Azul claro" },
  { hex: "#dcfce7", name: "Verde claro" },
  { hex: "#fef3c7", name: "Amarillo claro" },
];

function isInputFocused(): boolean {
  if (typeof document === "undefined") return false;
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName.toLowerCase();
  const role = (el.getAttribute("role") ?? "").toLowerCase();
  return (
    tag === "input" ||
    tag === "textarea" ||
    tag === "select" ||
    role === "textbox" ||
    (el as HTMLElement).isContentEditable
  );
}

export default function DisenadorPlantillasPage() {
  const [images, setImages] = useState<ImageAsset[]>([]);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [authChecked, setAuthChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadTotal, setUploadTotal] = useState(0);
  const [uploadDone, setUploadDone] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { state, setPresent, replacePresent, undo, redo } = useHistory<AlbumDocument>(
    createInitialDocument()
  );
  const [selectedSpreadId, setSelectedSpreadId] = useState(state.present.spreads[0]?.id ?? "");
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [selectedLayoutIndex, setSelectedLayoutIndex] = useState(EMPTY_LAYOUT_INDEX >= 0 ? EMPTY_LAYOUT_INDEX : 0);
  const [designPanelCollapsed, setDesignPanelCollapsed] = useState(true);
  const [templatesPopupOpen, setTemplatesPopupOpen] = useState(false);
  const [templatesPopupRect, setTemplatesPopupRect] = useState<DOMRect | null>(null);
  const templatesButtonRef = useRef<HTMLButtonElement>(null);
  const templatesPopupRef = useRef<HTMLDivElement>(null);
  const collapseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [backgroundDropOverList, setBackgroundDropOverList] = useState(false);
  const [photosOfSheetDropOver, setPhotosOfSheetDropOver] = useState(false);
  const [backgroundColorPopoverOpen, setBackgroundColorPopoverOpen] = useState(false);
  const backgroundColorButtonRef = useRef<HTMLButtonElement>(null);
  const [clipboard, setClipboard] = useState<FrameItem | null>(null);
  const [selectedImageIdInList, setSelectedImageIdInList] = useState<string | null>(null);
  const [removedImageIds, setRemovedImageIds] = useState<Set<string>>(new Set());
  const canvasWrapRef = useRef<HTMLDivElement | null>(null);
  const modalCanvasWrapRef = useRef<HTMLDivElement | null>(null);
  const [modalCanvasSize, setModalCanvasSize] = useState({ width: 0, height: 0 });
  const [canvasContainerSize, setCanvasContainerSize] = useState({ width: 0, height: 0 });
  const [floatingInspectorItemId, setFloatingInspectorItemId] = useState<string | null>(null);
  const floatingInspectorSnapshotRef = useRef<FrameItem | TextItem | null>(null);
  const floatingInspectorCancelDeletesRef = useRef(false);
  const floatingInspectorItemIdRef = useRef<string | null>(null);
  floatingInspectorItemIdRef.current = floatingInspectorItemId;
  const [showSaveAsTemplateModal, setShowSaveAsTemplateModal] = useState(false);
  const [saveAsTemplateName, setSaveAsTemplateName] = useState("");
  const [saveAsTemplateSheetCount, setSaveAsTemplateSheetCount] = useState(1);
  const [savingAsTemplate, setSavingAsTemplate] = useState(false);
  const [saveModalError, setSaveModalError] = useState<string | null>(null);
  const [savingProject, setSavingProject] = useState(false);
  const [projectSavedModal, setProjectSavedModal] = useState<{ id: string; title: string } | null>(null);
  const [sizeInputWidthCm, setSizeInputWidthCm] = useState(40);
  const [sizeInputHeightCm, setSizeInputHeightCm] = useState(20);
  const [userLayoutsVersion, setUserLayoutsVersion] = useState(0);
  /** Spread anterior al cambiar plantilla: anima fotos de posición vieja a nueva */

  useEffect(() => {
    setSizeInputWidthCm(Number((state.present.spec.pageWidth * 2 * PX_TO_CM).toFixed(1)));
    setSizeInputHeightCm(Number((state.present.spec.pageHeight * PX_TO_CM).toFixed(1)));
  }, [state.present.spec.pageWidth, state.present.spec.pageHeight]);

  const visibleImages = useMemo(
    () => images.filter((img) => !removedImageIds.has(img.id)),
    [images, removedImageIds]
  );

  const imageOrientations = useImageOrientations(visibleImages);

  const activeSpread = useMemo(
    () => state.present.spreads.find((s) => s.id === selectedSpreadId) ?? state.present.spreads[0],
    [selectedSpreadId, state.present.spreads]
  );

  useEffect(() => {
    if (!floatingInspectorItemId || !activeSpread) return;
    const exists =
      activeSpread.items?.some((i) => i.id === floatingInspectorItemId) ||
      activeSpread.texts?.some((t) => t.id === floatingInspectorItemId);
    if (!exists) setFloatingInspectorItemId(null);
  }, [floatingInspectorItemId, activeSpread]);

  useEffect(() => {
    setFloatingInspectorItemId(null);
  }, [selectedSpreadId]);

  useEffect(() => {
    if (!floatingInspectorItemId) return;
    let ro: ResizeObserver | null = null;
    const setup = () => {
      const el = modalCanvasWrapRef.current;
      if (el) {
        ro = new ResizeObserver(() => {
          setModalCanvasSize({ width: el.clientWidth, height: el.clientHeight });
        });
        ro.observe(el);
        setModalCanvasSize({ width: el.clientWidth, height: el.clientHeight });
      }
    };
    const timer = setTimeout(setup, 0);
    return () => {
      clearTimeout(timer);
      ro?.disconnect();
    };
  }, [floatingInspectorItemId]);

  const usedImageIds = useMemo(() => {
    const ids = new Set<string>();
    state.present.spreads.forEach((spread) =>
      spread.items.forEach((item) => {
        if (item.imageId) ids.add(item.imageId);
      })
    );
    return ids;
  }, [state.present.spreads]);

  const usedImageCount = useMemo(() => {
    const count: Record<string, number> = {};
    state.present.spreads.forEach((spread) =>
      spread.items.forEach((item) => {
        if (item.imageId) {
          count[item.imageId] = (count[item.imageId] ?? 0) + 1;
        }
      })
    );
    return count;
  }, [state.present.spreads]);

  useEffect(() => {
    fetch("/api/auth/me", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : { user: null }))
      .then((data) => {
        const role = data?.user?.role ?? null;
        setIsAdmin(role === "ADMIN");
        setAuthChecked(true);
      })
      .catch(() => {
        setIsAdmin(false);
        setAuthChecked(true);
      });
  }, []);

  useEffect(() => {
    if (!activeSpread && state.present.spreads[0]) {
      setSelectedSpreadId(state.present.spreads[0].id);
    }
  }, [activeSpread, state.present.spreads]);

  /** Sincronizar: si la hoja está vacía, plantilla seleccionada = Vacío (evita recuadro inicial). */
  useEffect(() => {
    const items = activeSpread?.items ?? [];
    if (items.length === 0 && EMPTY_LAYOUT_INDEX >= 0) {
      setSelectedLayoutIndex(EMPTY_LAYOUT_INDEX);
    }
  }, [activeSpread?.id, activeSpread?.items?.length]);

  useEffect(() => {
    if (selectedItemIds.length > 0) setSelectedImageIdInList(null);
  }, [selectedItemIds]);

  const updateDocument = useCallback(
    (updater: (doc: AlbumDocument) => AlbumDocument) => {
      setPresent(updater(state.present));
    },
    [setPresent, state.present]
  );

  const updateSpread = useCallback(
    (spreadId: string, updater: (spread: Spread) => Spread) => {
      updateDocument((doc) => ({
        ...doc,
        spreads: doc.spreads.map((s) => (s.id === spreadId ? updater(s) : s)),
      }));
    },
    [updateDocument]
  );

  const openFloatingInspector = useCallback(
    (id: string, options?: { isNewItem?: boolean }) => {
      setSelectedItemIds([id]);
      setFloatingInspectorItemId(id);
      floatingInspectorCancelDeletesRef.current = options?.isNewItem ?? false;
      if (!options?.isNewItem && activeSpread) {
        const item =
          activeSpread.items?.find((i) => i.id === id) ?? activeSpread.texts?.find((t) => t.id === id) ?? null;
        floatingInspectorSnapshotRef.current = item ? JSON.parse(JSON.stringify(item)) : null;
      } else {
        floatingInspectorSnapshotRef.current = null;
      }
    },
    [activeSpread]
  );

  /** Un clic: selecciona (o múltiples con Shift/Cmd). Doble clic abre Editor de Página. */
  const handleSelectItems = useCallback((ids: string[]) => {
    setSelectedItemIds(ids);
  }, []);

  /** En el Editor de Página (modal): al seleccionar ítem(s), cambiar cuál se edita. */
  const handleSelectInModal = useCallback(
    (ids: string[]) => {
      setSelectedItemIds(ids);
      if (ids.length === 1) openFloatingInspector(ids[0]);
    },
    [openFloatingInspector]
  );

  const closeFloatingInspectorWithCancel = useCallback(() => {
    const id = floatingInspectorItemIdRef.current;
    const snapshot = floatingInspectorSnapshotRef.current;
    const cancelDeletes = floatingInspectorCancelDeletesRef.current;
    setFloatingInspectorItemId(null);
    setSelectedItemIds([]);
    floatingInspectorSnapshotRef.current = null;
    floatingInspectorCancelDeletesRef.current = false;

    if (!id || !activeSpread) return;
    if (cancelDeletes) {
      updateSpread(activeSpread.id, (spread) => ({
        ...spread,
        items: (spread.items ?? []).filter((item) => item.id !== id),
        texts: (spread.texts ?? []).filter((t) => t.id !== id),
      }));
    } else if (snapshot) {
      if (snapshot.type === "frame") {
        updateSpread(activeSpread.id, (spread) => ({
          ...spread,
          items: (spread.items ?? []).map((item) => (item.id === id ? (snapshot as FrameItem) : item)),
        }));
      } else {
        updateSpread(activeSpread.id, (spread) => ({
          ...spread,
          texts: (spread.texts ?? []).map((t) => (t.id === id ? (snapshot as TextItem) : t)),
        }));
      }
    }
  }, [activeSpread, updateSpread]);

  /** Cierra el Editor de Página guardando la disposición como preferencia del usuario. */
  const closeEditorDePagina = useCallback(() => {
    if (activeSpread && activeSpread.items && activeSpread.items.length > 0) {
      saveUserLayoutFromSpread(activeSpread, state.present.spec);
      setUserLayoutsVersion((v) => v + 1);
    }
    setFloatingInspectorItemId(null);
    setSelectedItemIds([]);
  }, [activeSpread, state.present.spec]);

  useEffect(() => {
    if (!floatingInspectorItemId) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeFloatingInspectorWithCancel();
      } else if (e.key === "Enter" && !e.repeat) {
        const el = document.activeElement;
        const isInput = el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || (el as HTMLElement).isContentEditable);
        if (!isInput) {
          e.preventDefault();
          closeEditorDePagina();
        }
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [floatingInspectorItemId, closeFloatingInspectorWithCancel, closeEditorDePagina]);

  /** Cambia tamaño de hoja (en px a 300 DPI); el canvas se actualiza en tiempo real y los elementos se reescalan. */
  const handleSpecChange = useCallback(
    (updates: { pageWidth?: number; pageHeight?: number }) => {
      const spec = state.present.spec;
      const newPageW = Math.max(MIN_PX, Math.min(MAX_PX, updates.pageWidth ?? spec.pageWidth));
      const newPageH = Math.max(MIN_PX, Math.min(MAX_PX, updates.pageHeight ?? spec.pageHeight));
      if (newPageW === spec.pageWidth && newPageH === spec.pageHeight) return;
      const scaleX = newPageW / spec.pageWidth;
      const scaleY = newPageH / spec.pageHeight;
      updateDocument((doc) => {
        const newSpec = { ...doc.spec, pageWidth: newPageW, pageHeight: newPageH };
        const newSpreads = doc.spreads.map((spread) => ({
          ...spread,
          items: (spread.items ?? []).map((item) => {
            const left = item.x - spec.bleed;
            const top = item.y - spec.bleed;
            const newLeft = left * scaleX + newSpec.bleed;
            const newTop = top * scaleY + newSpec.bleed;
            const newWidth = Math.max(20, item.width * scaleX);
            const newHeight = Math.max(20, item.height * scaleY);
            const clamped = clampFrameToPrintable(newSpec, newLeft, newTop, newWidth, newHeight, item.shape);
            return { ...item, x: clamped.x, y: clamped.y, width: clamped.width, height: clamped.height };
          }),
          texts: (spread.texts ?? []).map((t) => {
            const left = t.x - spec.bleed;
            const top = t.y - spec.bleed;
            const newX = left * scaleX + newSpec.bleed;
            const newY = top * scaleY + newSpec.bleed;
            return { ...t, x: newX, y: newY };
          }),
        }));
        return { ...doc, spec: newSpec, spreads: newSpreads };
      });
    },
    [state.present.spec, updateDocument]
  );

  const handleCreateFrame = useCallback(
    (payload: Partial<FrameItem>): string | null => {
      if (!activeSpread) return null;
      const spec = state.present.spec;
      const x = payload.x ?? spec.bleed + 50;
      const y = payload.y ?? spec.bleed + 50;
      const width = payload.width ?? 240;
      const height = payload.height ?? 180;
      const clamped = clampFrameToPrintable(spec, x, y, width, height, payload.shape);
      const frame: FrameItem = {
        id: createId(),
        type: "frame",
        x: clamped.x,
        y: clamped.y,
        width: clamped.width,
        height: clamped.height,
        rotation: payload.rotation ?? 0,
        imageId: payload.imageId,
        fitMode: payload.fitMode ?? "cover",
        imageZoom: payload.imageZoom ?? 1,
        shape: payload.shape ?? "rect",
      };
      updateSpread(activeSpread.id, (spread) => ({ ...spread, items: [...(spread.items ?? []), frame] }));
      setSelectedItemIds([frame.id]);
      return frame.id;
    },
    [activeSpread, state.present.spec, updateSpread]
  );

  const handleCreateText = useCallback(
    (payload: Partial<TextItem>): string | null => {
      if (!activeSpread) return null;
      const spec = state.present.spec;
      const centerX = spec.bleed + spec.pageWidth;
      const centerY = spec.bleed + spec.pageHeight / 2 - 180;
      const text: TextItem = {
        id: createId(),
        type: "text",
        x: payload.x ?? centerX,
        y: payload.y ?? centerY,
        text: payload.text ?? "Texto",
        fontSize: payload.fontSize ?? 360,
        fontFamily: payload.fontFamily ?? "Inter",
        fill: payload.fill ?? "#1a1a1a",
        rotation: payload.rotation ?? 0,
        align: payload.align ?? "center",
        bold: payload.bold,
        italic: payload.italic,
        letterSpacing: payload.letterSpacing ?? 0,
        lineHeight: payload.lineHeight ?? 1,
      };
      updateSpread(activeSpread.id, (spread) => ({
        ...spread,
        texts: [...(spread.texts ?? []), text],
      }));
      setSelectedItemIds([text.id]);
      return text.id;
    },
    [activeSpread, state.present.spec, updateSpread]
  );

  const applyTemplate = useCallback(
    (template: LayoutTemplate) => {
      if (!activeSpread) return;
      const spec = state.present.spec;
      const contentWidth = spec.pageWidth * 2;
      const contentHeight = spec.pageHeight;
      const existingItems = activeSpread.items ?? [];
      const n = template.slots.length;
      const existingImageIds = existingItems
        .filter((it): it is FrameItem & { imageId: string } => Boolean(it.imageId))
        .map((it) => it.imageId);
      const existingAssets =
        existingImageIds.length >= n
          ? existingImageIds
              .slice(0, n)
              .map((id) => visibleImages.find((img) => img.id === id))
              .filter((x): x is ImageAsset => Boolean(x))
          : [];
      const imagesToUse =
        existingAssets.length >= n
          ? existingAssets
          : [...existingAssets, ...visibleImages.filter((img) => !existingAssets.includes(img))].slice(0, n);
      const orientations = imagesToUse.map((img) => imageOrientations.get(img?.id ?? "") ?? "S");
      const imageOrder = getBestImageOrderForTemplate(template, orientations);
      const newItems: FrameItem[] = template.slots.map((slot, i) => {
        const rect = slotToRect(slot, contentWidth, contentHeight, spec.bleed, spec.bleed);
        const clamped = clampFrameToPrintable(spec, rect.x, rect.y, rect.width, rect.height, existingItems[i]?.shape);
        const existing = existingItems[i];
        const img = imagesToUse[imageOrder[i] ?? i];
        const autoImageId = img?.id;
        const photoO = imageOrientations.get(img?.id ?? "") ?? "S";
        const slotO = template.slotOrientations?.[i];
        const fitMode =
          existing?.fitMode ??
          (autoImageId ? getFitModeForMinVisible(photoO, slot, slotO) : "contain");
        return {
          id: createId(),
          type: "frame" as const,
          x: clamped.x,
          y: clamped.y,
          width: clamped.width,
          height: clamped.height,
          rotation: 0,
          imageId: autoImageId ?? existing?.imageId,
          fitMode,
          imageZoom: existing?.imageZoom ?? 1,
          shape: existing?.shape ?? "rect",
        };
      });
      updateSpread(activeSpread.id, (spread) => ({ ...spread, items: newItems }));
      setSelectedItemIds([]);
    },
    [activeSpread, state.present.spec, updateSpread, visibleImages, imageOrientations]
  );

  const handleApplyLayout = useCallback(
    (templateIndex: number) => {
      const template = LAYOUT_TEMPLATES[templateIndex];
      if (template) {
        applyTemplate(template);
        setSelectedLayoutIndex(templateIndex);
      }
    },
    [applyTemplate]
  );

  const handleUpdateItem = useCallback(
    (itemId: string, next: Partial<FrameItem>) => {
      if (!activeSpread) return;
      updateSpread(activeSpread.id, (spread) => ({
        ...spread,
        items: (spread.items ?? []).map((item) => (item.id === itemId ? { ...item, ...next } : item)),
      }));
    },
    [activeSpread, updateSpread]
  );

  const handleUpdateText = useCallback(
    (textId: string, next: Partial<TextItem>) => {
      if (!activeSpread) return;
      updateSpread(activeSpread.id, (spread) => ({
        ...spread,
        texts: (spread.texts ?? []).map((t) => (t.id === textId ? { ...t, ...next } : t)),
      }));
    },
    [activeSpread, updateSpread]
  );

  const scheduleCollapseDesignPanel = useCallback(() => {
    if (collapseTimeoutRef.current) clearTimeout(collapseTimeoutRef.current);
    collapseTimeoutRef.current = setTimeout(() => {
      setDesignPanelCollapsed(true);
      collapseTimeoutRef.current = null;
    }, 500);
  }, []);

  const handleApplyUserLayout = useCallback(
    (userLayout: UserLayout) => {
      applyTemplate(userLayout);
      scheduleCollapseDesignPanel();
    },
    [applyTemplate, scheduleCollapseDesignPanel]
  );

  /** Índice de la primera plantilla con N slots. -1 si no existe. */
  const getFirstTemplateIndexForSlotCount = useCallback((n: number): number => {
    if (n <= 0) return -1;
    return LAYOUT_TEMPLATES.findIndex((t) => t.slots.length === n);
  }, []);

  useEffect(() => {
    return () => {
      if (collapseTimeoutRef.current) clearTimeout(collapseTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (!templatesPopupOpen) return;
    const onMouseDown = (e: MouseEvent) => {
      const popup = templatesPopupRef.current;
      const btn = templatesButtonRef.current;
      if (popup?.contains(e.target as Node) || btn?.contains(e.target as Node)) return;
      setTemplatesPopupOpen(false);
      setTemplatesPopupRect(null);
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [templatesPopupOpen]);

  useEffect(() => {
    if (!backgroundColorPopoverOpen) return;
    const onMouseDown = (e: MouseEvent) => {
      const btn = backgroundColorButtonRef.current;
      const popover = document.getElementById("backgroundColor-popover");
      if (btn?.contains(e.target as Node) || popover?.contains(e.target as Node)) return;
      setBackgroundColorPopoverOpen(false);
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [backgroundColorPopoverOpen]);

  /** Auto-aplicar plantilla óptima cuando cambia la cantidad de fotos: selecciona la que mejor encaja con las orientaciones. */
  useEffect(() => {
    if (!activeSpread) return;
    const items = activeSpread.items ?? [];
    const photoCount = items.filter((i) => i.imageId).length;
    const slotCount = items.length;
    const targetCount = photoCount > 0 ? photoCount : (slotCount > 0 ? slotCount : 0);
    if (targetCount === 0) return;

    const orientations = items
      .filter((i): i is FrameItem & { imageId: string } => Boolean(i.imageId))
      .map((i) => imageOrientations.get(i.imageId) ?? "S");

    const bestIdx =
      orientations.length === targetCount
        ? getBestTemplateIndexForOrientations(LAYOUT_TEMPLATES, targetCount, orientations)
        : getFirstTemplateIndexForSlotCount(targetCount);
    if (bestIdx < 0) return;

    const currentTemplate = LAYOUT_TEMPLATES[selectedLayoutIndex];
    if (currentTemplate && currentTemplate.slots.length === targetCount) return;

    handleApplyLayout(bestIdx);
  }, [activeSpread?.id, activeSpread?.items, selectedLayoutIndex, imageOrientations, getFirstTemplateIndexForSlotCount, handleApplyLayout]);

  const handleSetSpreadBackground = useCallback(
    (imageId: string) => {
      if (!activeSpread) return;
      updateSpread(activeSpread.id, (spread) => ({ ...spread, backgroundImageId: imageId }));
    },
    [activeSpread, updateSpread]
  );

  const handleClearSpreadBackground = useCallback(() => {
    if (!activeSpread) return;
    updateSpread(activeSpread.id, (spread) => {
      const { backgroundImageId, ...rest } = spread;
      return rest;
    });
  }, [activeSpread, updateSpread]);

  const handleSetSpreadBackgroundColor = useCallback(
    (color: string) => {
      if (!activeSpread) return;
      updateSpread(activeSpread.id, (spread) => ({ ...spread, backgroundColor: color }));
    },
    [activeSpread, updateSpread]
  );

  const handleClearSpreadBackgroundColor = useCallback(() => {
    if (!activeSpread) return;
    updateSpread(activeSpread.id, (spread) => {
      const { backgroundColor, ...rest } = spread;
      return rest;
    });
  }, [activeSpread, updateSpread]);

  const handleDeleteSelected = useCallback(() => {
    if (selectedItemIds.length === 0 || !activeSpread) return;
    const idsSet = new Set(selectedItemIds);
    updateSpread(activeSpread.id, (spread) => ({
      ...spread,
      items: (spread.items ?? []).filter((item) => !idsSet.has(item.id)),
      texts: (spread.texts ?? []).filter((t) => !idsSet.has(t.id)),
    }));
    setSelectedItemIds([]);
    setFloatingInspectorItemId(null);
  }, [activeSpread, selectedItemIds, updateSpread]);

  const handleCopy = useCallback(() => {
    if (!selectedItemIds[0] || !activeSpread) return;
    const item = activeSpread.items.find((i) => i.id === selectedItemIds[0]);
    if (item) setClipboard(item);
  }, [activeSpread, selectedItemIds]);

  const handlePaste = useCallback(() => {
    if (!activeSpread || !clipboard) return;
    const { id: _id, ...rest } = clipboard;
    const frame: FrameItem = {
      ...rest,
      id: createId(),
      x: clipboard.x + 24,
      y: clipboard.y + 24,
    };
    updateSpread(activeSpread.id, (spread) => ({ ...spread, items: [...spread.items, frame] }));
    setSelectedItemIds([frame.id]);
  }, [activeSpread, clipboard, updateSpread]);

  const handleDuplicate = useCallback(() => {
    if (selectedItemIds.length === 0 || !activeSpread) return;
    const frames: FrameItem[] = [];
    for (const id of selectedItemIds) {
      const item = activeSpread.items.find((i) => i.id === id);
      if (item) frames.push({ ...item, id: createId(), x: item.x + 24, y: item.y + 24 });
    }
    if (frames.length === 0) return;
    updateSpread(activeSpread.id, (spread) => ({ ...spread, items: [...spread.items, ...frames] }));
    setSelectedItemIds(frames.map((f) => f.id));
  }, [activeSpread, selectedItemIds, updateSpread]);

  const handleToggleFavorite = useCallback((_id: string) => {}, []);

  const handleRemoveImageFromList = useCallback(
    (imageId: string) => {
      setRemovedImageIds((prev) => new Set(prev).add(imageId));
      setSelectedImageIdInList(null);
      updateDocument((doc) => ({
        ...doc,
        spreads: doc.spreads.map((spread) => ({
          ...spread,
          backgroundImageId: spread.backgroundImageId === imageId ? undefined : spread.backgroundImageId,
          items: (spread.items ?? []).map((item) =>
            item.imageId === imageId ? { ...item, imageId: undefined } : item
          ),
        })),
      }));
    },
    [updateDocument]
  );

  const handleAssignImage = useCallback(
    (itemId: string, imageId: string) => {
      handleUpdateItem(itemId, { imageId });
    },
    [handleUpdateItem]
  );

  const handleSwapFrames = useCallback(
    (idA: string, idB: string) => {
      if (!activeSpread) return;
      const itemA = activeSpread.items?.find((i) => i.id === idA);
      const itemB = activeSpread.items?.find((i) => i.id === idB);
      if (!itemA || !itemB) return;
      updateSpread(activeSpread.id, (spread) => ({
        ...spread,
        items: (spread.items ?? []).map((it) => {
          if (it.id === idA) return { ...it, imageId: itemB.imageId };
          if (it.id === idB) return { ...it, imageId: itemA.imageId };
          return it;
        }),
      }));
    },
    [activeSpread, updateSpread]
  );

  const MAX_UPLOAD_MB = 10;
  const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;

  const handleUploadImage = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const files = input.files;
    if (!files?.length) return;
    const fileList = Array.from(files);
    setUploadError(null);

    // Validar 10MB antes de subir: si alguna supera, rechazar todas
    const tooLarge = fileList.filter((f) => f.size > MAX_UPLOAD_BYTES);
    if (tooLarge.length > 0) {
      const names = tooLarge.map((f) => f.name).join(", ");
      setUploadError(
        `Una o más imágenes superan ${MAX_UPLOAD_MB} MB. No se subió ninguna: ${names}`
      );
      input.value = "";
      setFileInputKey((k) => k + 1);
      return;
    }

    setUploadingImage(true);
    setUploadTotal(fileList.length);
    setUploadDone(0);
    const toAdd: ImageAsset[] = [];
    let abortError: string | null = null;

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      try {
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch("/api/admin/template-image/upload", {
          method: "POST",
          credentials: "include",
          body: formData,
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error((data as { error?: string })?.error || `Error ${res.status} al subir`);
        }
        const imageUrl = (data as { imageUrl?: string })?.imageUrl;
        if (!imageUrl) {
          throw new Error("El servidor no devolvió la URL de la imagen");
        }
        toAdd.push({ id: imageUrl, url: imageUrl, name: file.name || `Imagen ${i + 1}` });
        setUploadDone(i + 1);
      } catch (err) {
        console.error("Upload error:", err);
        abortError = err instanceof Error ? err.message : "Error al subir la imagen";
        break;
      }
    }

    input.value = "";
    setFileInputKey((k) => k + 1);
    setUploadingImage(false);
    setUploadTotal(0);
    setUploadDone(0);

    if (abortError) {
      setUploadError(
        `Ocurrió un error al subir. No se agregó ninguna imagen. ${abortError}`
      );
    } else if (toAdd.length > 0) {
      setImages((prev) => [...prev, ...toAdd]);
    }
  }, []);

  const handleSaveProject = useCallback(async () => {
    setSavingProject(true);
    try {
      const document = {
        ...state.present,
        id: "design",
      } as AlbumDocument;
      const res = await fetch("/api/admin/photobook-projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          document,
          images: visibleImages,
          title: document.title || `Proyecto ${new Date().toLocaleDateString("es-AR")}`,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Error al guardar");
      setProjectSavedModal({ id: data.id, title: data.title || "Proyecto guardado" });
    } catch (e) {
      console.error(e);
      alert(e instanceof Error ? e.message : "Error al guardar proyecto");
    } finally {
      setSavingProject(false);
    }
  }, [state.present, visibleImages]);

  const handleOpenSaveAsTemplate = useCallback(() => {
    setSaveModalError(null);
    const spreadIndex = state.present.spreads.findIndex((s) => s.id === selectedSpreadId);
    setSaveAsTemplateName(`Plantilla hoja ${(spreadIndex >= 0 ? spreadIndex : 0) + 1}`);
    setSaveAsTemplateSheetCount(1);
    setShowSaveAsTemplateModal(true);
  }, [selectedSpreadId, state.present.spreads]);

  const handleSaveAsTemplate = useCallback(async () => {
    const spreads = state.present.spreads ?? [];
    const count = Math.min(Math.max(1, saveAsTemplateSheetCount), spreads.length);
    if (count < 1) return;
    setSaveModalError(null);
    const name = saveAsTemplateName.trim();
    if (!name) {
      setSaveModalError("El nombre es obligatorio.");
      return;
    }
    const spec = state.present.spec;
    const totalW = 2 * spec.pageWidth + 2 * spec.bleed;
    const totalH = spec.pageHeight + 2 * spec.bleed;
    const widthCm = Math.round(totalW * PX_TO_CM * 10) / 10;
    const heightCm = Math.round(totalH * PX_TO_CM * 10) / 10;

    const spreadsToSave = spreads.slice(0, count);
    const missingBg = spreadsToSave.findIndex((s) => !s.backgroundImageId);
    if (missingBg >= 0) {
      setSaveModalError(`La hoja ${missingBg + 1} no tiene imagen de fondo. Agregá una imagen de fondo a todas las hojas que querés guardar.`);
      return;
    }

    const firstSpread = spreadsToSave[0]!;
    const bgImage = images.find((i) => i.id === firstSpread.backgroundImageId);
    const imageUrl = bgImage?.url;
    if (!imageUrl) {
      setSaveModalError("No se encontró la URL de la imagen de fondo de la primera hoja.");
      return;
    }

    const slots = firstSpread.items.map((item, i) => ({
      index: i,
      bbox: {
        x: Math.round(item.x),
        y: Math.round(item.y),
        width: Math.round(item.width),
        height: Math.round(item.height),
      },
    }));
    const textElements = firstSpread.texts?.length
      ? firstSpread.texts.map((t) => ({
          id: t.id,
          x: t.x,
          y: t.y,
          text: t.text,
          fontSize: t.fontSize,
          fontFamily: t.fontFamily,
          fill: t.fill,
          align: t.align,
          bold: t.bold,
          italic: t.italic,
          letterSpacing: t.letterSpacing,
          lineHeight: t.lineHeight,
          underline: t.underline,
        }))
      : undefined;

    const pagesJson =
      count > 1
        ? spreadsToSave.slice(1).map((spread) => {
            const bg = images.find((i) => i.id === spread.backgroundImageId);
            const pageImageUrl = bg?.url;
            if (!pageImageUrl) {
              throw new Error(`No se encontró la imagen de fondo de una de las hojas.`);
            }
            return {
              imageUrl: pageImageUrl,
              widthCm,
              heightCm,
              slots: spread.items.map((item, i) => ({
                index: i,
                bbox: {
                  x: Math.round(item.x),
                  y: Math.round(item.y),
                  width: Math.round(item.width),
                  height: Math.round(item.height),
                },
              })),
              textElements: spread.texts?.length
                ? spread.texts.map((t) => ({
                    id: t.id,
                    x: t.x,
                    y: t.y,
                    text: t.text,
                    fontSize: t.fontSize,
                    fontFamily: t.fontFamily,
                    fill: t.fill,
                    align: t.align,
                    bold: t.bold,
                    italic: t.italic,
                    letterSpacing: t.letterSpacing,
                    lineHeight: t.lineHeight,
                    underline: t.underline,
                  }))
                : undefined,
            };
          })
        : null;

    setSavingAsTemplate(true);
    try {
      const res = await fetch("/api/admin/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name,
          imageUrl,
          widthCm: widthCm || 20,
          heightCm: heightCm || 20,
          slots,
          textElements,
          pagesJson,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Error al guardar");
      setShowSaveAsTemplateModal(false);
    } catch (e) {
      console.error(e);
      setSaveModalError(e instanceof Error ? e.message : "Error al guardar como plantilla");
    } finally {
      setSavingAsTemplate(false);
    }
  }, [images, saveAsTemplateName, saveAsTemplateSheetCount, state.present.spec, state.present.spreads]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (!isInputFocused() && e.code === "Space") e.preventDefault();
      if (isInputFocused()) return;
      if (e.key === "Escape") {
        setSelectedItemIds([]);
        setSelectedImageIdInList(null);
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        if (selectedImageIdInList) {
          handleRemoveImageFromList(selectedImageIdInList);
          return;
        }
        if (selectedItemIds.length > 0) {
          handleDeleteSelected();
        }
        return;
      }
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key === "c") {
        e.preventDefault();
        handleCopy();
        return;
      }
      if (mod && e.key === "v") {
        e.preventDefault();
        handlePaste();
        return;
      }
      if (mod && e.key === "d") {
        e.preventDefault();
        handleDuplicate();
        return;
      }
      if (mod && !e.shiftKey && e.key === "z") {
        e.preventDefault();
        undo();
        return;
      }
      if (mod && e.shiftKey && e.key === "z") {
        e.preventDefault();
        redo();
        return;
      }
      if (e.key === "v" && !mod) {
        e.preventDefault();
        setSelectedItemIds([]);
        return;
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        const idx = state.present.spreads.findIndex((s) => s.id === selectedSpreadId);
        if (idx > 0) setSelectedSpreadId(state.present.spreads[idx - 1].id);
        return;
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        const idx = state.present.spreads.findIndex((s) => s.id === selectedSpreadId);
        if (idx >= 0 && idx < state.present.spreads.length - 1)
          setSelectedSpreadId(state.present.spreads[idx + 1].id);
        return;
      }
      if (e.key === "ArrowUp" && !isInputFocused()) {
        e.preventDefault();
        const items = activeSpread?.items ?? [];
        const photoCount = items.filter((i) => i.imageId).length;
        const slotCount = items.length;
        const filter = slotCount > 0 ? (photoCount > 0 ? photoCount : slotCount) : null;
        const filtered = filter != null
          ? LAYOUT_TEMPLATES.filter((t) => t.slots.length === filter)
          : LAYOUT_TEMPLATES;
        const idxInFiltered = filtered.findIndex((t) => LAYOUT_TEMPLATES.indexOf(t) === selectedLayoutIndex);
        const curIdx = idxInFiltered >= 0 ? idxInFiltered : 0;
        const prevIdx = (curIdx - 1 + filtered.length) % filtered.length;
        const originalIndex = LAYOUT_TEMPLATES.indexOf(filtered[prevIdx]);
        setSelectedLayoutIndex(originalIndex);
        handleApplyLayout(originalIndex);
        scheduleCollapseDesignPanel();
        return;
      }
      if (e.key === "ArrowDown" && !isInputFocused()) {
        e.preventDefault();
        const items = activeSpread?.items ?? [];
        const photoCount = items.filter((i) => i.imageId).length;
        const slotCount = items.length;
        const filter = slotCount > 0 ? (photoCount > 0 ? photoCount : slotCount) : null;
        const filtered = filter != null
          ? LAYOUT_TEMPLATES.filter((t) => t.slots.length === filter)
          : LAYOUT_TEMPLATES;
        const idxInFiltered = filtered.findIndex((t) => LAYOUT_TEMPLATES.indexOf(t) === selectedLayoutIndex);
        const curIdx = idxInFiltered >= 0 ? idxInFiltered : 0;
        const nextIdx = (curIdx + 1) % filtered.length;
        const originalIndex = LAYOUT_TEMPLATES.indexOf(filtered[nextIdx]);
        setSelectedLayoutIndex(originalIndex);
        handleApplyLayout(originalIndex);
        scheduleCollapseDesignPanel();
        return;
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [
    undo,
    redo,
    selectedItemIds,
    selectedImageIdInList,
    selectedSpreadId,
    selectedLayoutIndex,
    activeSpread,
    state.present.spreads,
    handleDeleteSelected,
    handleRemoveImageFromList,
    handleCopy,
    handlePaste,
    handleDuplicate,
    handleApplyLayout,
    scheduleCollapseDesignPanel,
  ]);

  useEffect(() => {
    const el = canvasWrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setCanvasContainerSize({ width: el.clientWidth, height: el.clientHeight });
    });
    ro.observe(el);
    setCanvasContainerSize({ width: el.clientWidth, height: el.clientHeight });
    return () => ro.disconnect();
  }, [activeSpread]);

  useEffect(() => {
    const el = canvasWrapRef.current;
    if (!el) return;
    const handleWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
      if (Math.abs(e.deltaX) < 40) return;
      e.preventDefault();
      const idx = state.present.spreads.findIndex((s) => s.id === selectedSpreadId);
      if (e.deltaX > 0 && idx >= 0 && idx < state.present.spreads.length - 1) {
        setSelectedSpreadId(state.present.spreads[idx + 1].id);
      } else if (e.deltaX < 0 && idx > 0) {
        setSelectedSpreadId(state.present.spreads[idx - 1].id);
      }
    };
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [selectedSpreadId, state.present.spreads]);

  const selectedItem =
    activeSpread?.items?.find((item) => item.id === selectedItemIds[0]) ??
    activeSpread?.texts?.find((t) => t.id === selectedItemIds[0]) ??
    null;

  if (!authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f1f5f9]">
        <p className="text-[#64748b]">Cargando…</p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-[#f1f5f9] p-4">
        <p className="text-[#64748b] text-center">Solo administradores.</p>
        <Link href="/admin/plantillas" className="text-[#c27b3d] hover:underline font-medium">
          ← Admin Plantillas
        </Link>
      </div>
    );
  }

  const googleFontsUrl =
    "https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=Poppins:wght@400;600;700&family=Montserrat:wght@400;600;700&family=Raleway:wght@400;600;700&family=Playfair+Display:wght@400;600;700&family=Cormorant+Garamond:wght@400;500;600;700&family=Lora:wght@400;600;700&family=Space+Grotesk:wght@400;600;700&family=DM+Sans:wght@400;600;700&family=Bebas+Neue&family=Abril+Fatface&family=Oswald:wght@400;600&family=Great+Vibes&family=Dancing+Script:wght@400;600&family=Satisfy&family=Pacifico&display=swap";

  return (
    <div className="h-screen flex flex-col overflow-hidden w-full max-w-full min-w-0 bg-[#f1f5f9]">
      <link rel="stylesheet" href={googleFontsUrl} />
      <header className="shrink-0 flex flex-wrap items-center gap-3 px-4 py-3 bg-white border-b border-[#e2e8f0]">
        <Link href="/admin/plantillas" className="text-[#64748b] hover:text-[#1a1a1a] text-sm">
          ← Admin Plantillas
        </Link>
        <div className="flex-1 flex flex-wrap items-center gap-4">
          <span className="font-semibold text-[#1a1a1a]">Diseñador de plantillas</span>
          <div className="flex items-center gap-2 flex-wrap">
            <label className="text-xs text-[#6b7280]" title="Alto de la hoja completa">Alto hoja completa (cm)</label>
            <input
              type="number"
              min={MIN_CM}
              max={MAX_CM}
              step={0.1}
              value={sizeInputHeightCm}
              onChange={(e) => {
                const cm = e.target.valueAsNumber;
                if (!Number.isNaN(cm)) setSizeInputHeightCm(cm);
              }}
              className="w-20 rounded border border-[#e5e7eb] px-2 py-1 text-xs"
              aria-label="Alto hoja completa en centímetros"
            />
            <label className="text-xs text-[#6b7280]" title="Ancho de la hoja completa (lienzo abierto, 2 páginas)">Ancho hoja completa (cm)</label>
            <input
              type="number"
              min={MIN_CM}
              max={MAX_CM_FULL_WIDTH}
              step={0.1}
              value={sizeInputWidthCm}
              onChange={(e) => {
                const cm = e.target.valueAsNumber;
                if (!Number.isNaN(cm)) setSizeInputWidthCm(cm);
              }}
              className="w-20 rounded border border-[#e5e7eb] px-2 py-1 text-xs"
              aria-label="Ancho hoja completa en centímetros"
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                const fullW = Math.max(MIN_CM, Math.min(MAX_CM_FULL_WIDTH, sizeInputWidthCm));
                const fullH = Math.max(MIN_CM, Math.min(MAX_CM, sizeInputHeightCm));
                handleSpecChange({
                  pageWidth: Math.round((fullW / 2) * CM_TO_PX),
                  pageHeight: Math.round(fullH * CM_TO_PX),
                });
                setSizeInputWidthCm(Number(fullW.toFixed(1)));
                setSizeInputHeightCm(Number(fullH.toFixed(1)));
              }}
            >
              Aplicar
            </Button>
            <span className="text-[10px] text-[#9ca3af]" title="Hoja completa como se envía al laboratorio">
              Hoja completa · Export 300 DPI
            </span>
          </div>
        </div>
      </header>

      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <div
          className={
            !floatingInspectorItemId && selectedItemIds.length > 0
              ? "flex-1 min-h-0 grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-0 p-3 overflow-hidden"
              : "flex-1 min-h-0 flex gap-3 p-3 overflow-hidden"
          }
        >
          <div className="flex-1 min-h-0 min-w-0 flex flex-col gap-2 overflow-hidden">
          {/* Panel diseño: collapsed = barra compacta; expanded = flotante */}
          <div className="shrink-0">
            {designPanelCollapsed ? (
              <Card className="px-3 py-2">
                <div className="flex justify-center">
                  <button
                    ref={templatesButtonRef}
                    type="button"
                    onClick={() => {
                      const items = activeSpread?.items ?? [];
                      const photoCount = items.filter((i) => i.imageId).length;
                      if (photoCount === 0) return;
                      const rect = templatesButtonRef.current?.getBoundingClientRect();
                      if (rect) setTemplatesPopupRect(rect);
                      setTemplatesPopupOpen((v) => !v);
                    }}
                    className={`shrink-0 w-12 h-12 rounded-lg border flex items-center justify-center transition-colors focus:outline-none ${
                      (activeSpread?.items ?? []).filter((i) => i.imageId).length > 0
                        ? "border-[#e5e7eb] bg-white hover:bg-[#f9fafb] hover:border-[#c27b3d] text-[#6b7280]"
                        : "border-[#e5e7eb] bg-[#f9fafb] text-[#9ca3af] cursor-not-allowed"
                    }`}
                    title={
                      (activeSpread?.items ?? []).filter((i) => i.imageId).length === 0
                        ? "Agregá fotos para ver plantillas"
                        : "Ver plantillas"
                    }
                  >
                    <svg width={28} height={28} viewBox="0 0 100 100" className="text-current">
                      <rect x="2" y="2" width="46" height="46" rx="2" fill="currentColor" opacity="0.6" />
                      <rect x="52" y="2" width="46" height="46" rx="2" fill="currentColor" opacity="0.6" />
                      <rect x="2" y="52" width="46" height="46" rx="2" fill="currentColor" opacity="0.6" />
                      <rect x="52" y="52" width="46" height="46" rx="2" fill="currentColor" />
                    </svg>
                  </button>
                </div>
                {templatesPopupOpen &&
                  templatesPopupRect &&
                  typeof document !== "undefined" &&
                  createPortal(
                    (() => {
                      const items = activeSpread?.items ?? [];
                      const photoCount = items.filter((i) => i.imageId).length;
                      const slotCount = items.length;
                      const filterCount = photoCount > 0 ? photoCount : slotCount;
                      if (filterCount === 0) return null;
                      const templates = LAYOUT_TEMPLATES.filter((t) => t.slots.length === filterCount);
                      if (templates.length === 0) return null;
                      const popupW = Math.min(600, window.innerWidth * 0.9);
                      const left = templatesPopupRect.left + templatesPopupRect.width / 2 - popupW / 2;
                      const top = templatesPopupRect.top - 160;
                      return (
                        <div
                          ref={templatesPopupRef}
                          className="fixed z-[9999] bg-white rounded-lg border border-[#e5e7eb] shadow-xl p-2"
                          style={{
                            left: Math.max(8, Math.min(left, window.innerWidth - popupW - 8)),
                            top: Math.max(8, top),
                            width: popupW,
                          }}
                        >
                          <div className="flex gap-2 overflow-x-auto pb-1 max-h-[140px]" style={{ scrollSnapType: "x proximity" }}>
                            {templates.map((template) => {
                              const originalIndex = LAYOUT_TEMPLATES.indexOf(template);
                              return (
                                <div key={template.id} style={{ scrollSnapAlign: "start" }} className="shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      handleApplyLayout(originalIndex);
                                      setTemplatesPopupOpen(false);
                                      setTemplatesPopupRect(null);
                                    }}
                                    className={`rounded-lg border-2 p-1 transition-colors text-left ${
                                      originalIndex === selectedLayoutIndex ? "border-[#c27b3d] bg-[#fff7ee]" : "border-[#e5e7eb] bg-white hover:border-[#d1d5db]"
                                    }`}
                                    style={{ width: 56, height: 68 }}
                                    title={template.name}
                                  >
                                    <div className="flex h-[52px] w-[52px] items-center justify-center rounded bg-[#f9fafb] mx-auto">
                                      <svg width={52} height={52} viewBox="0 0 100 100" className="overflow-visible">
                                        {template.slots.map((slot, i) => (
                                          <rect
                                            key={i}
                                            x={slot.nx * 100 + 1}
                                            y={slot.ny * 100 + 1}
                                            width={Math.max(2, slot.nw * 100 - 2)}
                                            height={Math.max(2, slot.nh * 100 - 2)}
                                            fill="#e5e7eb"
                                            rx={2}
                                          />
                                        ))}
                                      </svg>
                                    </div>
                                    <div className="mt-0.5 truncate text-[10px] text-[#6b7280]">{template.name}</div>
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })(),
                    document.body
                  )}
              </Card>
            ) : (
              <Card className="fixed left-4 top-24 z-40 max-h-[calc(100vh-7rem)] w-[min(400px,calc(100vw-2rem))] overflow-auto p-3 space-y-3 shadow-xl">
                {(() => {
                  const items = activeSpread?.items ?? [];
                  const slotCount = items.length > 0 ? items.length : null;
                  const userLayouts = slotCount != null ? getUserLayoutsForSlotCount(slotCount) : [];
                  return userLayouts.length > 0 ? (
                    <div className="space-y-1">
                      <p className="text-[10px] font-medium text-[#6b7280]">Tus disposiciones más usadas</p>
                      <div className="flex flex-wrap gap-2">
                        {userLayouts.map((ul) => (
                          <button
                            key={ul.id}
                            type="button"
                            onClick={() => handleApplyUserLayout(ul)}
                            className="shrink-0 rounded-lg border-2 border-[#e5e7eb] p-1 hover:border-[#c27b3d] hover:bg-[#fff7ee] transition-colors"
                            title={`${ul.name} (${ul.usedCount} usos)`}
                            style={{ width: 64, height: 68 }}
                          >
                            <div className="mx-auto flex h-[52px] w-[52px] items-center justify-center rounded bg-[#f9fafb]">
                              <svg width={52} height={52} viewBox="0 0 100 100" className="overflow-visible">
                                {ul.slots.map((slot, i) => (
                                  <rect
                                    key={i}
                                    x={slot.nx * 100 + 1}
                                    y={slot.ny * 100 + 1}
                                    width={Math.max(2, slot.nw * 100 - 2)}
                                    height={Math.max(2, slot.nh * 100 - 2)}
                                    fill="#e5e7eb"
                                    rx={2}
                                  />
                                ))}
                              </svg>
                            </div>
                            <div className="mt-0.5 truncate text-[9px] text-[#6b7280]">{ul.name}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null;
                })()}
                <LayoutTemplatesStrip
                  selectedIndex={selectedLayoutIndex}
                  onSelectTemplate={(index) => {
                    setSelectedLayoutIndex(index);
                    handleApplyLayout(index);
                    scheduleCollapseDesignPanel();
                  }}
                  variant="grid"
                  slotCountFilter={(() => {
                    const items = activeSpread?.items ?? [];
                    const photoCount = items.filter((i) => i.imageId).length;
                    const slotCount = items.length;
                    if (slotCount === 0) return null;
                    return photoCount > 0 ? photoCount : slotCount;
                  })()}
                  orientationsForSort={(() => {
                    const items = activeSpread?.items ?? [];
                    const photoCount = items.filter((i) => i.imageId).length;
                    if (photoCount === 0) return null;
                    return items
                      .filter((i): i is FrameItem & { imageId: string } => Boolean(i.imageId))
                      .map((i) => imageOrientations.get(i.imageId) ?? "S");
                  })()}
                />
                <SheetNavigator
                  currentIndex={state.present.spreads.findIndex((s) => s.id === selectedSpreadId)}
                  totalSheets={state.present.spreads.length}
                  onPrev={() => {
                    const idx = state.present.spreads.findIndex((s) => s.id === selectedSpreadId);
                    if (idx > 0) {
                      setSelectedSpreadId(state.present.spreads[idx - 1].id);
                      setSelectedItemIds([]);
                    }
                  }}
                  onNext={() => {
                    const idx = state.present.spreads.findIndex((s) => s.id === selectedSpreadId);
                    if (idx >= 0 && idx < state.present.spreads.length - 1) {
                      setSelectedSpreadId(state.present.spreads[idx + 1].id);
                      setSelectedItemIds([]);
                    }
                  }}
                />
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={snapEnabled}
                    onChange={(e) => setSnapEnabled(e.target.checked)}
                    className="rounded border-[#e5e7eb] text-[#c27b3d] focus:ring-[#c27b3d]"
                  />
                  <span className="text-xs text-[#1a1a1a]">Imantado (guías de alineación)</span>
                </label>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setDesignPanelCollapsed(true)}
                  className="w-full"
                >
                  Ocultar plantillas
                </Button>
              </Card>
            )}
          </div>
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden rounded-lg border border-[#e2e8f0] bg-white shadow-sm">
            {activeSpread ? (
              <div ref={canvasWrapRef} className="flex-1 min-h-0 overflow-hidden flex flex-col min-w-0 pl-2 pt-2 pb-2 pr-3">
                {(() => {
                  const spreadIndex = state.present.spreads.findIndex((s) => s.id === selectedSpreadId);
                  const prevSpread = spreadIndex > 0 ? state.present.spreads[spreadIndex - 1] : null;
                  const nextSpread = spreadIndex >= 0 && spreadIndex < state.present.spreads.length - 1
                    ? state.present.spreads[spreadIndex + 1]
                    : null;
                  const goPrev = () => {
                    if (prevSpread) setSelectedSpreadId(prevSpread.id);
                  };
                  const goNext = () => {
                    if (nextSpread) setSelectedSpreadId(nextSpread.id);
                  };
                  const w = Math.max(0, canvasContainerSize.width - 12);
                  const h = Math.max(0, canvasContainerSize.height - 100);
                  const gapPx = 8;
                  const availableW = Math.max(0, w - 2 * gapPx);
                  // Proporción 2:4:2, con mínimo 100px por lateral para que siempre se vean
                  const sideW = Math.max(100, Math.floor(availableW / 4));
                  const centerW = Math.floor(availableW / 2);
                  const spreadIndex1 = state.present.spreads.findIndex((s) => s.id === selectedSpreadId) + 1;
                  const totalSpreads = state.present.spreads.length;
                  return (
                    <div className="flex-1 flex flex-col min-h-0">
                      <div className="flex-1 flex min-h-0 gap-2 items-stretch overflow-hidden">
                        {/* Columna izquierda: spread anterior (~25%), clicable para ir atrás */}
                        <div
                          className={`flex-[2] min-w-[100px] min-h-0 relative flex items-center justify-center shrink-0 overflow-hidden ${prevSpread ? "cursor-pointer" : ""}`}
                          onClick={prevSpread ? goPrev : undefined}
                          role={prevSpread ? "button" : undefined}
                          tabIndex={prevSpread ? 0 : undefined}
                          onKeyDown={prevSpread ? (e) => e.key === "Enter" && goPrev() : undefined}
                          aria-label={prevSpread ? "Spread anterior" : undefined}
                        >
                          {prevSpread ? (
                            <div className="absolute inset-0 opacity-60 pointer-events-none">
                              <CanvasEditor
                                spec={state.present.spec}
                                spread={prevSpread}
                                images={images}
                                selectedItemIds={[]}
                                onSelectItems={() => {}}
                                onChangeItem={() => {}}
                                onChangeText={() => {}}
                                onCreateFrame={() => {}}
                                onCreateText={() => {}}
                                onAssignImage={() => {}}
                                transformDisabled
                                snapEnabled={false}
                                viewMode="spread"
                                containerWidth={sideW}
                                containerHeight={h}
                                previewMode
                                forceFrameRotationZero
                              />
                            </div>
                          ) : (
                            <div className="absolute inset-0 bg-[#1f2937] rounded-l-xl" />
                          )}
                        </div>
                        {/* Columna central: spread actual (~50%), mismo tamaño siempre (con o sin fotos) */}
                        <div className="flex-[4] min-h-[360px] min-w-0 relative flex flex-col flex-1">
                          <div className="shrink-0 py-1 text-center text-sm font-medium text-[#374151]">
                            Hoja {spreadIndex1} / {totalSpreads}
                          </div>
                          <div className="flex-1 min-h-[320px] relative">
                          <CanvasEditor
                            spec={state.present.spec}
                            spread={activeSpread}
                            images={images}
                            selectedItemIds={selectedItemIds}
                            onSelectItems={handleSelectItems}
                            onChangeItem={handleUpdateItem}
                            onChangeText={handleUpdateText}
                            onCreateFrame={handleCreateFrame}
                            onCreateText={handleCreateText}
                            onAssignImage={handleAssignImage}
                            onSwapFrames={handleSwapFrames}
                            transformDisabled={true}
                            snapEnabled={snapEnabled}
                            viewMode="spread"
                            pageSide="left"
                            containerWidth={centerW}
                            containerHeight={Math.max(0, h - 32)}
                            showAddActions={false}
                            onDoubleClickItem={(id) => openFloatingInspector(id)}
                            onDoubleClickEmpty={() => {}}
                            forceFrameRotationZero
                          />
                          {prevSpread && (
                            <button
                              type="button"
                              className="absolute left-2 top-1/2 -translate-y-1/2 z-10 w-10 h-10 flex items-center justify-center rounded-full bg-black/40 text-white opacity-50 hover:opacity-100 transition-opacity"
                              onClick={goPrev}
                              aria-label="Spread anterior"
                            >
                              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M19 12H5M12 19l-7-7 7-7" />
                              </svg>
                            </button>
                          )}
                          {nextSpread && (
                            <button
                              type="button"
                              className="absolute right-2 top-1/2 -translate-y-1/2 z-10 w-10 h-10 flex items-center justify-center rounded-full bg-black/40 text-white opacity-50 hover:opacity-100 transition-opacity"
                              onClick={goNext}
                              aria-label="Spread siguiente"
                            >
                              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M5 12h14M12 5l7 7-7 7" />
                              </svg>
                            </button>
                          )}
                          </div>
                        </div>
                        {/* Columna derecha: spread siguiente (~25%), clicable para avanzar */}
                        <div
                          className={`flex-[2] min-w-[100px] min-h-0 relative flex items-center justify-center shrink-0 overflow-hidden ${nextSpread ? "cursor-pointer" : ""}`}
                          onClick={nextSpread ? goNext : undefined}
                          role={nextSpread ? "button" : undefined}
                          tabIndex={nextSpread ? 0 : undefined}
                          onKeyDown={nextSpread ? (e) => e.key === "Enter" && goNext() : undefined}
                          aria-label={nextSpread ? "Spread siguiente" : undefined}
                        >
                          {nextSpread ? (
                            <div className="absolute inset-0 opacity-60 pointer-events-none">
                              <CanvasEditor
                                spec={state.present.spec}
                                spread={nextSpread}
                                images={images}
                                selectedItemIds={[]}
                                onSelectItems={() => {}}
                                onChangeItem={() => {}}
                                onChangeText={() => {}}
                                onCreateFrame={() => {}}
                                onCreateText={() => {}}
                                onAssignImage={() => {}}
                                transformDisabled
                                snapEnabled={false}
                                viewMode="spread"
                                containerWidth={sideW}
                                containerHeight={h}
                                previewMode
                                forceFrameRotationZero
                              />
                            </div>
                          ) : (
                            <div className="absolute inset-0 bg-[#1f2937] rounded-r-xl" />
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-sm text-[#64748b]">
                No hay hoja seleccionada.
              </div>
            )}
          </div>
        </div>

        {/* Panel lateral Inspector: columna dedicada cuando hay selección (frame o texto). */}
        {!floatingInspectorItemId && selectedItemIds.length > 0 && (
          <div className="flex w-full xl:w-[360px] shrink-0 flex-col overflow-hidden rounded-lg border border-[#e2e8f0] bg-white shadow-sm min-h-0">
            <div className="shrink-0 px-3 py-2 border-b border-[#e2e8f0] text-sm font-medium text-[#1a1a1a] flex items-center justify-between">
              <span>Inspector</span>
              <button
                type="button"
                onClick={() => setSelectedItemIds([])}
                className="text-[#6b7280] hover:text-[#1a1a1a] p-1 rounded"
                title="Cerrar"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-auto p-4">
              {(() => {
                const selectedItem =
                  activeSpread?.items?.find((i) => i.id === selectedItemIds[0]) ??
                  activeSpread?.texts?.find((t) => t.id === selectedItemIds[0]) ??
                  null;
                return (
                  <Inspector
                    key={selectedItem ? `inspector-${selectedItem.id}` : "none"}
                    item={selectedItem}
                    imageUrl={
                      selectedItem?.type === "frame" && selectedItem.imageId
                        ? images.find((i) => i.id === selectedItem.imageId)?.url ?? null
                        : null
                    }
                    onChange={(next) => {
                      if (!selectedItem) return;
                      if (selectedItem.type === "frame") handleUpdateItem(selectedItem.id, next as Partial<FrameItem>);
                      else handleUpdateText(selectedItem.id, next as Partial<TextItem>);
                    }}
                    simpleMode={true}
                    pxToCm={PX_TO_CM}
                  />
                );
              })()}
            </div>
          </div>
        )}
        </div>

        {/* Fotos usadas en esta hoja + Fondo + Color + Agregar texto (derecha) */}
        {activeSpread && (
          <div className="shrink-0 px-3 py-2 border-t border-[#e2e8f0] bg-[#fafafa] flex items-center justify-center gap-3 flex-wrap">
            <div
              className={`inline-flex flex-col rounded-lg border px-3 py-2 w-fit min-w-[160px] transition-colors ${
                photosOfSheetDropOver ? "bg-[#fff7ee] border-[#c27b3d]" : "border-[#e2e8f0] bg-white shadow-sm"
              }`}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "copy";
                setPhotosOfSheetDropOver(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                const el = e.currentTarget;
                if (!el.contains(e.relatedTarget as Node)) setPhotosOfSheetDropOver(false);
              }}
              onDrop={(e) => {
                e.preventDefault();
                setPhotosOfSheetDropOver(false);
                const imageId = e.dataTransfer.getData("application/x-image-id");
                if (!imageId) return;
                const emptyFrame = (activeSpread.items ?? []).find((item) => !item.imageId);
                if (emptyFrame) {
                  handleAssignImage(emptyFrame.id, imageId);
                } else {
                  handleCreateFrame({ imageId });
                }
              }}
            >
              <div className="flex flex-wrap items-center justify-center gap-2 min-h-[52px]">
                {Array.from(
                  new Map(
                    (activeSpread.items ?? [])
                      .filter((item) => item.imageId)
                      .map((item) => [item.imageId!, item])
                  ).values()
                ).map((item) => {
                  const asset = images.find((i) => i.id === item.imageId);
                  if (!asset) return null;
                  return (
                    <div
                      key={item.id}
                      className="shrink-0 w-12 h-12 rounded border border-[#e5e7eb] overflow-hidden bg-[#f3f4f6]"
                      title={asset.name}
                    >
                      <img
                        src={asset.url}
                        alt=""
                        className="w-full h-full object-cover block"
                      />
                    </div>
                  );
                })}
                {(activeSpread.items?.length ?? 0) === 0 && (
                  <div className="flex flex-col items-center justify-center py-4 px-2 text-center">
                    <svg className="w-12 h-12 text-[#c27b3d]/60 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5" aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                    </svg>
                    <p className="text-[11px] text-[#9ca3af]">Arrastrá las imágenes aquí para agregarlas a la hoja</p>
                  </div>
                )}
              </div>
            </div>
            <div
              className={`shrink-0 w-14 rounded-lg border-2 flex flex-col items-center justify-center gap-0.5 py-2 transition-colors cursor-pointer ${
                backgroundDropOverList ? "bg-[#fff7ee] border-[#c27b3d]" : "bg-[#f3f4f6] border-[#e5e7eb] hover:border-[#cbd5e1]"
              }`}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "copy";
                setBackgroundDropOverList(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                const el = e.currentTarget;
                if (!el.contains(e.relatedTarget as Node)) setBackgroundDropOverList(false);
              }}
              onDrop={(e) => {
                e.preventDefault();
                setBackgroundDropOverList(false);
                const imageId = e.dataTransfer.getData("application/x-image-id");
                if (imageId) handleSetSpreadBackground(imageId);
              }}
              title="Arrastrá una foto aquí para usarla como fondo"
            >
              <svg className="w-6 h-6 text-[#6b7280]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
              </svg>
              <span className="text-[9px] font-medium text-[#6b7280] leading-tight">Fondo</span>
              <div className="flex gap-1">
                {selectedImageIdInList && (
                  <button type="button" onClick={(e) => { e.stopPropagation(); handleSetSpreadBackground(selectedImageIdInList); }} className="text-[8px] text-[#c27b3d] hover:underline font-medium">Usar</button>
                )}
                {activeSpread.backgroundImageId && (
                  <button type="button" onClick={(e) => { e.stopPropagation(); handleClearSpreadBackground(); }} className="text-[8px] text-[#c27b3d] hover:underline font-medium">Quitar</button>
                )}
              </div>
            </div>
            <div className="relative shrink-0">
              <button
                ref={backgroundColorButtonRef}
                type="button"
                onClick={() => setBackgroundColorPopoverOpen((o) => !o)}
                className={`w-14 rounded-lg border-2 flex flex-col items-center justify-center gap-0.5 py-2 transition-colors cursor-pointer ${
                  activeSpread?.backgroundColor ? "border-[#c27b3d] bg-[#fff7ee]" : "bg-[#f3f4f6] border-[#e5e7eb] hover:border-[#cbd5e1]"
                }`}
                title="Color de fondo"
              >
                <svg className="w-6 h-6 text-[#6b7280]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.098 19.902a3.75 3.75 0 005.304 0l6.401-6.402M6.75 21A3.75 3.75 0 013 17.25V4.125C3 3.504 3.504 3 4.125 3h5.25c.621 0 1.125.504 1.125 1.125v4.072M6.75 21a3.75 3.75 0 003.75-3.75V8.197M6.75 21h13.125c.621 0 1.125-.504 1.125-1.125v-5.25c0-.621-.504-1.125-1.125-1.125h-4.072M6.75 21a3.75 3.75 0 013.75-3.75h.563M12 3v9m0 0v9m0-9h9" />
                </svg>
                <span className="text-[9px] font-medium text-[#6b7280] leading-tight">Color</span>
                {activeSpread?.backgroundColor && (
                  <div className="w-4 h-2 rounded-sm border border-[#e5e7eb]" style={{ backgroundColor: activeSpread.backgroundColor }} />
                )}
              </button>
              {backgroundColorPopoverOpen && (
                <div
                  id="backgroundColor-popover"
                  className="absolute z-50 left-0 top-full mt-1 bg-white rounded-lg border border-[#e5e7eb] shadow-xl p-2 min-w-[140px]"
                >
                  <div className="grid grid-cols-4 gap-1.5 mb-2">
                    {PRESET_BACKGROUND_COLORS.map(({ hex, name }) => (
                      <button
                        key={hex}
                        type="button"
                        onClick={() => {
                          handleSetSpreadBackgroundColor(hex);
                          setBackgroundColorPopoverOpen(false);
                        }}
                        className={`w-8 h-8 rounded-lg border-2 transition-colors ${
                          activeSpread?.backgroundColor === hex ? "border-[#c27b3d] scale-110" : "border-[#e5e7eb] hover:border-[#cbd5e1]"
                        }`}
                        style={{ backgroundColor: hex }}
                        title={name}
                      />
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      handleClearSpreadBackgroundColor();
                      setBackgroundColorPopoverOpen(false);
                    }}
                    className="w-full text-[10px] text-[#c27b3d] hover:underline font-medium py-1 border-t border-[#e5e7eb] mt-1 pt-1"
                  >
                    Desactivar
                  </button>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => {
                handleCreateText({});
              }}
              title="Agregar texto"
              className="shrink-0 w-14 rounded-lg border-2 flex flex-col items-center justify-center gap-0.5 py-2 transition-colors cursor-pointer bg-[#f3f4f6] border-[#e5e7eb] hover:border-[#cbd5e1]"
            >
              <span className="w-6 h-6 flex items-center justify-center text-[#6b7280] font-bold text-base leading-none">T</span>
              <span className="text-[9px] font-medium text-[#6b7280] leading-tight">Texto</span>
            </button>
          </div>
        )}

        <div className="shrink-0 border-t border-[#e2e8f0] bg-white flex flex-col min-h-0">
          {uploadError && (
            <div className="px-3 py-2 bg-red-50 border-b border-red-200">
              <p className="text-xs text-red-700 break-words">{uploadError}</p>
              <button
                type="button"
                onClick={() => setUploadError(null)}
                className="mt-1 text-[10px] text-red-600 hover:underline"
              >
                Cerrar
              </button>
            </div>
          )}
          <div className="flex items-stretch gap-2 min-h-0 px-3 py-2">
            <input
              key={fileInputKey}
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              multiple
              className="hidden"
              onChange={handleUploadImage}
            />
            <div className="flex-1 min-w-0 flex flex-col min-h-[140px]">
              <ImageBrowser
                images={visibleImages}
                usedImageIds={usedImageIds}
                usedImageCount={usedImageCount}
                onToggleFavorite={handleToggleFavorite}
                selectedImageId={selectedImageIdInList}
                onSelectImage={setSelectedImageIdInList}
                horizontal
                addPhotosButton={{
                  onClick: () => fileInputRef.current?.click(),
                  uploading: uploadingImage,
                  uploadProgress:
                    uploadingImage && uploadTotal > 0
                      ? { done: uploadDone, total: uploadTotal }
                      : undefined,
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {showSaveAsTemplateModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => !savingAsTemplate && setShowSaveAsTemplateModal(false)}
        >
          <Card className="w-full max-w-xl min-w-[380px] p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-[#1a1a1a] mb-2">Guardar como plantilla</h3>
            <p className="text-sm text-[#6b7280] mb-4">
              Guardá una o varias hojas (fondo + recuadros) como plantilla pública. Una sola hoja para dípticos, varias para fotolibros.
            </p>
            {saveModalError && (
              <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md p-2 mb-4">
                {saveModalError}
              </p>
            )}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1">Nombre</label>
                <Input
                  value={saveAsTemplateName}
                  onChange={(e) => setSaveAsTemplateName(e.target.value)}
                  placeholder="ej. Díptico 4 fotos"
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1">Número de hojas</label>
                <select
                  value={saveAsTemplateSheetCount}
                  onChange={(e) => setSaveAsTemplateSheetCount(Number(e.target.value))}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                >
                  {Array.from({ length: state.present.spreads?.length ?? 0 }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>
                      {n} {n === 1 ? "hoja" : "hojas"}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setShowSaveAsTemplateModal(false)}
                disabled={savingAsTemplate}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                variant="primary"
                onClick={() => handleSaveAsTemplate()}
                disabled={
                  savingAsTemplate ||
                  !saveAsTemplateName.trim() ||
                  (state.present.spreads?.length ?? 0) < saveAsTemplateSheetCount ||
                  state.present.spreads
                    ?.slice(0, saveAsTemplateSheetCount)
                    .some((s) => !s.backgroundImageId)
                }
              >
                {savingAsTemplate ? "Guardando…" : "Guardar"}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {projectSavedModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setProjectSavedModal(null)}
        >
          <Card className="w-full max-w-xl min-w-[420px] p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center text-green-600 shrink-0">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-[#1a1a1a]">Proyecto guardado</h3>
                <p className="text-sm text-[#6b7280]">{projectSavedModal.title}</p>
              </div>
            </div>
            <p className="text-sm text-[#6b7280] mb-4">
              Tu diseño se guardó en la carpeta de proyectos. Podés retomarlo cuando quieras desde la vista previa.
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <Link href={`/fotolibro/${projectSavedModal.id}/vista`} className="flex-1">
                <Button variant="primary" className="w-full">
                  Ver fotolibro
                </Button>
              </Link>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setProjectSavedModal(null)}
              >
                Seguir editando
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Panel flotante: canvas completo + Inspector (doble clic en frame o texto) */}
      {floatingInspectorItemId && activeSpread && (() => {
        const floatingItem =
          activeSpread.items?.find((i) => i.id === floatingInspectorItemId) ??
          activeSpread.texts?.find((t) => t.id === floatingInspectorItemId) ??
          null;
        if (!floatingItem) return null;
        return (
          <div
            className="fixed inset-0 z-50 flex flex-col bg-black/20"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Editor de Página"
          >
            <div
              className="flex-1 min-h-0 flex flex-col lg:flex-row gap-0 bg-white m-4 rounded-lg shadow-xl border border-[#e2e8f0] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex-1 min-h-0 flex flex-col min-w-0">
                <div className="shrink-0 flex items-center justify-between px-4 py-2 border-b border-[#e2e8f0] bg-[#fafafa]">
                  <span className="text-sm font-medium text-[#1a1a1a]">
                    Editor de Página — Solo se cierra con Esc, Enter o el botón Cerrar (no al hacer clic afuera)
                  </span>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => closeEditorDePagina()}
                  >
                    Cerrar
                  </Button>
                </div>
                <div ref={modalCanvasWrapRef} className="flex-1 min-h-0 overflow-hidden p-2">
                  <CanvasEditor
                    spec={state.present.spec}
                    spread={activeSpread}
                    images={images}
                    selectedItemIds={selectedItemIds}
                    onSelectItems={handleSelectInModal}
                    onChangeItem={handleUpdateItem}
                    onChangeText={handleUpdateText}
                    onCreateFrame={handleCreateFrame}
                    onCreateText={handleCreateText}
                    onAssignImage={handleAssignImage}
                    transformDisabled={false}
                    snapEnabled={true}
                    viewMode="spread"
                    pageSide="left"
                    containerWidth={Math.max(0, modalCanvasSize.width - 16)}
                    containerHeight={Math.max(0, modalCanvasSize.height - 16)}
                    onDoubleClickItem={(id) => openFloatingInspector(id)}
                    onDoubleClickEmpty={() => {}}
                    forceFrameRotationZero
                    showShapePicker={false}
                    showAddActions
                    showAddFrameButton={false}
                    editorPageMode
                  />
                </div>
              </div>
              <div className="w-full lg:w-80 shrink-0 flex flex-col border-l border-[#e2e8f0] overflow-hidden">
                <div className="shrink-0 px-4 py-2 border-b border-[#e2e8f0] bg-[#fafafa] text-sm font-medium text-[#1a1a1a]">
                  Inspector — {floatingItem.type === "frame" ? "Zoom y ajuste" : "Formato del texto"}
                </div>
                <div className="flex-1 overflow-auto p-4">
                  <Inspector
                    key={`inspector-${floatingItem.id}`}
                    item={floatingItem}
                    imageUrl={
                      floatingItem.type === "frame" && floatingItem.imageId
                        ? images.find((i) => i.id === floatingItem.imageId)?.url ?? null
                        : null
                    }
                    onChange={(next) => {
                      if (floatingItem.type === "frame") handleUpdateItem(floatingItem.id, next as Partial<FrameItem>);
                      else handleUpdateText(floatingItem.id, next as Partial<TextItem>);
                    }}
                    showShapeSelector={floatingItem.type === "frame"}
                    pxToCm={PX_TO_CM}
                  />
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Botones fijos abajo a la derecha */}
      <div className="fixed bottom-6 right-6 z-40 flex flex-col gap-2">
        <Button
          type="button"
          variant="primary"
          accentColor="#22c55e"
          onClick={handleSaveProject}
          disabled={savingProject}
        >
          {savingProject ? "Guardando…" : "Guardar proyecto"}
        </Button>
        <Button
          type="button"
          onClick={handleOpenSaveAsTemplate}
          disabled={savingAsTemplate}
        >
          {savingAsTemplate ? "Guardando…" : "Guardar como plantilla"}
        </Button>
      </div>
    </div>
  );
}
