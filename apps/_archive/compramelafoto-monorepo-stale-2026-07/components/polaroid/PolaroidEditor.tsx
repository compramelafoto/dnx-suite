"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Cropper from "react-easy-crop";
import Card from "@/components/ui/Card";
import SizeSelector from "./SizeSelector";
import Uploader from "./Uploader";
import ThumbnailStrip from "./ThumbnailStrip";
import OrderPanel from "./OrderPanel";
import Button from "@/components/ui/Button";
import {
  exportSheetsAsZip,
  getPolaroidFrame,
  renderPolaroidToCanvas,
  type CropAreaPixels,
  type PolaroidItem,
  type PolaroidText,
} from "./export";
import { POLAROID_PRESETS, type PolaroidPreset } from "./presets";
import { getTextureUrl, TEXTURES } from "./textures";
import { getPolaroidFontFamily, normalizePolaroidFontValue, POLAROID_FONT_FALLBACK, POLAROID_FONTS } from "./fonts";

const MAX_TEXTS = 5;
const DEFAULT_TEXT: Omit<PolaroidText, "id"> = {
  value: "",
  color: "#111111",
  fontSize: 32,
  fontFamily: "inter",
  rotation: 0,
  align: "center",
  x: 0.5,
  y: 0.85,
  bold: false,
  italic: false,
  strokeWidth: 0,
  strokeColor: "#111111",
  shadowColor: "rgba(0,0,0,0.35)",
  shadowBlur: 0,
  shadowOffsetX: 0,
  shadowOffsetY: 2,
};

function createText(): PolaroidText {
  return {
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    ...DEFAULT_TEXT,
  };
}

function createTextureSeed() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export default function PolaroidEditor({
  onExport,
  submitLabel,
}: {
  onExport?: (payload: { blob: Blob; filename: string; items: PolaroidItem[] }) => Promise<void>;
  submitLabel?: string;
}) {
  const [defaultPresetId, setDefaultPresetId] = useState<PolaroidPreset["id"]>(POLAROID_PRESETS[0].id);
  const [items, setItems] = useState<PolaroidItem[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [exporting, setExporting] = useState(false);
  const [showTextureMenu, setShowTextureMenu] = useState(false);
  const [showFontMenu, setShowFontMenu] = useState(false);
  const previewWrapRef = useRef<HTMLDivElement | null>(null);
  const finalPreviewRef = useRef<HTMLCanvasElement | null>(null);
  const historyRef = useRef<PolaroidItem[][]>([]);
  const draggingRef = useRef<{ id: string } | null>(null);
  const resizingRef = useRef<{
    id: string;
    startX: number;
    startY: number;
    startSize: number;
  } | null>(null);
  const rotatingRef = useRef<{
    id: string;
    centerX: number;
    centerY: number;
    startAngle: number;
    startRotation: number;
  } | null>(null);
  const [selectedTextId, setSelectedTextId] = useState<string | null>(null);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [textToolActive, setTextToolActive] = useState(false);
  const [selectedPanel, setSelectedPanel] = useState<"texture" | "text" | null>(null);

  const activeItem = useMemo(
    () => items.find((item) => item.id === activeId) || null,
    [items, activeId]
  );

  const presetsById = useMemo(() => new Map(POLAROID_PRESETS.map((p) => [p.id, p])), []);

  const activePreset = useMemo(() => {
    if (!activeItem) {
      return presetsById.get(defaultPresetId) ?? POLAROID_PRESETS[0];
    }
    return presetsById.get(activeItem.presetId) ?? POLAROID_PRESETS[0];
  }, [activeItem, defaultPresetId, presetsById]);

  const selectedItems = useMemo(
    () => items.filter((item) => selectedIds.includes(item.id)),
    [items, selectedIds]
  );
  const bulkPreset =
    presetsById.get(selectedItems[0]?.presetId || defaultPresetId) ?? POLAROID_PRESETS[0];

  const photoAspect = useMemo(() => {
    const widthPx = Math.max(1, Math.round(activePreset.widthCm * 100));
    const heightPx = Math.max(1, Math.round(activePreset.heightCm * 100));
    const frame = getPolaroidFrame(widthPx, heightPx);
    return frame.photoWidth / frame.photoHeight;
  }, [activePreset]);

  const framePercent = useMemo(() => {
    const baseWidth = 1000;
    const baseHeight = Math.max(
      1,
      Math.round((baseWidth * activePreset.heightCm) / activePreset.widthCm)
    );
    const frame = getPolaroidFrame(baseWidth, baseHeight);
    return {
      photoX: (frame.photoX / baseWidth) * 100,
      photoY: (frame.photoY / baseHeight) * 100,
      photoW: (frame.photoWidth / baseWidth) * 100,
      photoH: (frame.photoHeight / baseHeight) * 100,
    };
  }, [activePreset]);

  useEffect(() => {
    if (!activeItem || !finalPreviewRef.current) return;
    let active = true;

    (async () => {
      const previewCanvas = await renderPolaroidToCanvas(activeItem, activePreset, 120);
      if (!active || !finalPreviewRef.current) return;
      const target = finalPreviewRef.current;
      const ctx = target.getContext("2d");
      if (!ctx) return;
      target.width = previewCanvas.width;
      target.height = previewCanvas.height;
      ctx.clearRect(0, 0, target.width, target.height);
      ctx.drawImage(previewCanvas, 0, 0);
    })();

    return () => {
      active = false;
    };
  }, [activeItem, activePreset]);

  useEffect(() => {
    if (!activeItem) return;
    if (activeItem.presetId !== defaultPresetId) {
      setDefaultPresetId(activeItem.presetId);
    }
  }, [activeItem, defaultPresetId]);

  useEffect(() => {
    setShowFontMenu(false);
  }, [selectedTextId]);

  useEffect(() => {
    function isEditableTarget(target: EventTarget | null) {
      const el = target as HTMLElement | null;
      if (!el) return false;
      if (el.isContentEditable) return true;
      const tag = el.tagName?.toLowerCase();
      return tag === "input" || tag === "textarea" || tag === "select";
    }

    function handleUndo(event: KeyboardEvent) {
      if (isEditableTarget(event.target)) return;
      if (!event.metaKey && !event.ctrlKey) return;
      if (event.key.toLowerCase() !== "z") return;
      if (event.shiftKey) return;
      const last = historyRef.current.pop();
      if (!last) return;
      event.preventDefault();
      setItems(last);
      if (activeId && !last.some((item) => item.id === activeId)) {
        setActiveId(last[0]?.id ?? null);
      }
    }

    window.addEventListener("keydown", handleUndo);
    return () => {
      window.removeEventListener("keydown", handleUndo);
    };
  }, [activeId]);

  const updateActive = (partial: Partial<PolaroidItem>) => {
    if (!activeItem) return;
    setItems((prev) =>
      {
        historyRef.current.push(prev);
        if (historyRef.current.length > 50) historyRef.current.shift();
        return prev.map((item) => (item.id === activeItem.id ? { ...item, ...partial } : item));
      }
    );
  };

  const updateSelected = (partial: Partial<PolaroidItem>) => {
    if (selectedIds.length === 0) return;
    setItems((prev) => {
      historyRef.current.push(prev);
      if (historyRef.current.length > 50) historyRef.current.shift();
      return prev.map((item) => (selectedIds.includes(item.id) ? { ...item, ...partial } : item));
    });
  };

  const updateSelectedTexture = (textureId: string) => {
    if (selectedIds.length === 0) return;
    setItems((prev) => {
      historyRef.current.push(prev);
      if (historyRef.current.length > 50) historyRef.current.shift();
      return prev.map((item) =>
        selectedIds.includes(item.id)
          ? { ...item, textureId, textureSeed: createTextureSeed() }
          : item
      );
    });
  };

  const updateActiveText = (id: string, partial: Partial<PolaroidText>) => {
    if (!activeItem) return;
    updateActive({
      texts: activeItem.texts.map((text) => (text.id === id ? { ...text, ...partial } : text)),
    });
  };

  const handleUpload = (files: FileList) => {
    const next: PolaroidItem[] = Array.from(files).map((file) => ({
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      imageSrc: URL.createObjectURL(file),
      crop: { x: 0, y: 0 },
      zoom: 1,
      cropPixels: null,
      textureId: "none",
      textureSeed: createTextureSeed(),
      // Calcular escala inicial para que la textura se adapte al alto completo de la foto polaroid
      // Esto se calculará cuando se seleccione una textura, por ahora dejamos 1
      textureScale: 1,
      textureRotation: 0,
      textureOffsetX: 0,
      textureOffsetY: 0,
      texts: [],
      copies: 1,
      presetId: defaultPresetId,
      finish: "BRILLO",
    }));
    setItems((prev) => {
      historyRef.current.push(prev);
      if (historyRef.current.length > 50) historyRef.current.shift();
      return [...prev, ...next];
    });
    if (!activeId && next.length > 0) setActiveId(next[0].id);
  };

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((val) => val !== id) : [...prev, id]
    );
  };

  const handleRemoveItem = (id: string) => {
    setItems((prev) => {
      historyRef.current.push(prev);
      if (historyRef.current.length > 50) historyRef.current.shift();
      const next = prev.filter((item) => item.id !== id);
      if (activeId === id) {
        setActiveId(next[0]?.id ?? null);
      }
      return next;
    });
    setSelectedIds((prev) => prev.filter((val) => val !== id));
    setSelectedTextId(null);
    setEditingTextId(null);
    setTextToolActive(false);
    setSelectedPanel(null);
  };

  const onPointerDownText = (id: string, event: React.PointerEvent<HTMLDivElement>) => {
    if (!previewWrapRef.current) return;
    event.stopPropagation();
    event.preventDefault(); // Prevenir comportamiento por defecto que podría causar duplicación
    draggingRef.current = { id };
    setSelectedTextId(id);
    setTextToolActive(true);
    setSelectedPanel("text");
    (event.currentTarget as HTMLDivElement).setPointerCapture(event.pointerId);
  };

  useEffect(() => {
    function handlePointerMove(event: PointerEvent) {
      if (!activeItem || !previewWrapRef.current) return;
      const rect = previewWrapRef.current.getBoundingClientRect();
      if (rotatingRef.current) {
        const centerX = rotatingRef.current.centerX;
        const centerY = rotatingRef.current.centerY;
        const angle = Math.atan2(event.clientY - centerY, event.clientX - centerX);
        const delta = angle - rotatingRef.current.startAngle;
        const nextRotation = rotatingRef.current.startRotation + (delta * 180) / Math.PI;
        updateActiveText(rotatingRef.current.id, { rotation: Math.round(nextRotation) });
        return;
      }
      if (resizingRef.current) {
        const deltaX = event.clientX - resizingRef.current.startX;
        const deltaY = event.clientY - resizingRef.current.startY;
        const delta = (deltaX + deltaY) / 4;
        const nextSize = Math.max(12, Math.min(120, resizingRef.current.startSize + delta));
        updateActiveText(resizingRef.current.id, { fontSize: Math.round(nextSize) });
        return;
      }
      if (!draggingRef.current) return;
      const x = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
      const y = Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height));
      updateActiveText(draggingRef.current.id, { x, y });
    }

    function handlePointerUp() {
      draggingRef.current = null;
      resizingRef.current = null;
      rotatingRef.current = null;
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [activeItem]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (!activeItem || !selectedTextId || editingTextId) return;
      const target = event.target as HTMLElement | null;
      if (target?.isContentEditable) return;
      const tag = target?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;
      if (event.key !== "Delete" && event.key !== "Backspace") return;
      const nextTexts = activeItem.texts.filter((t) => t.id !== selectedTextId);
      updateActive({ texts: nextTexts });
      setSelectedTextId(nextTexts[0]?.id ?? null);
      setSelectedPanel(nextTexts.length ? "text" : null);
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeItem, editingTextId, selectedTextId]);

  const handleExport = async () => {
    if (!items.length) return;
    setExporting(true);
    try {
      const { blob, filename } = await exportSheetsAsZip(items);
      if (onExport) {
        await onExport({ blob, filename, items });
      } else {
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        link.click();
        URL.revokeObjectURL(url);
      }
    } finally {
      setExporting(false);
    }
  };

  const activeIndex = useMemo(() => {
    if (!activeId) return 0;
    const index = items.findIndex((item) => item.id === activeId);
    return Math.max(0, index);
  }, [activeId, items]);

  const activeText = useMemo(() => {
    if (!activeItem || activeItem.texts.length === 0) return null;
    if (!selectedTextId) return null;
    return activeItem.texts.find((text) => text.id === selectedTextId) || null;
  }, [activeItem, selectedTextId]);

  const hasText = Boolean(activeItem && activeItem.texts.length > 0);
  const hasTexture = Boolean(activeItem && activeItem.textureId && activeItem.textureId !== "none");
  const showTexturePanel = selectedPanel === "texture" && hasTexture;
  const showTextPanel = selectedPanel === "text" && hasText;

  useEffect(() => {
    if (selectedPanel === "text" && !hasText) {
      setSelectedPanel(null);
    }
    if (selectedPanel === "texture" && !hasTexture) {
      setSelectedPanel(null);
    }
  }, [hasText, hasTexture, selectedPanel]);

  useEffect(() => {
    if (!activeItem || activeItem.texts.length === 0) return;
    if (selectedTextId && !activeItem.texts.some((t) => t.id === selectedTextId)) {
      setSelectedTextId(activeItem.texts[0].id);
      setSelectedPanel("text");
    }
  }, [activeItem, selectedTextId]);

  const goPrev = () => {
    if (!items.length) return;
    const prevIndex = Math.max(0, activeIndex - 1);
    setActiveId(items[prevIndex].id);
  };

  const goNext = () => {
    if (!items.length) return;
    const nextIndex = Math.min(items.length - 1, activeIndex + 1);
    setActiveId(items[nextIndex].id);
  };

  return (
    <div className="w-full space-y-6">
      <Card className="p-6 space-y-6">
        <div className="flex justify-center">
          <Uploader
            onFiles={handleUpload}
            buttonLabel="⬆️ Agregar imágenes"
            helperText={null}
            buttonClassName="text-base sm:text-lg px-6 sm:px-8 py-2.5 sm:py-3"
            wrapperClassName="text-center w-full"
          />
        </div>
        {selectedIds.length <= 1 ? (
          <div className="text-sm text-[#6b7280] text-center">
            Seleccioná más de una imagen para editar de forma masiva el pedido.
          </div>
        ) : null}
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,360px)] items-start">
          <ThumbnailStrip
            items={items}
            activeId={activeId}
            onSelect={setActiveId}
            selectedIds={selectedIds}
            onToggleSelect={toggleSelected}
            onRemove={handleRemoveItem}
          />
          {selectedIds.length > 1 ? (
            <Card className="p-6 space-y-4">
              <div className="text-sm font-medium text-[#1a1a1a]">Configuración masiva</div>
              <div className="text-xs text-[#6b7280]">
                Aplicar a {selectedIds.length} polaroids seleccionadas.
              </div>
              <SizeSelector
                value={bulkPreset}
                onChange={(next) => updateSelected({ presetId: next.id })}
              />
              <div className="space-y-2">
                <label className="block text-sm text-[#6b7280]">Acabado</label>
                <select
                  value={selectedItems[0]?.finish || "BRILLO"}
                  onChange={(e) =>
                    updateSelected({ finish: e.target.value as "BRILLO" | "MATE" })
                  }
                  className="w-full rounded-md border border-[#e5e7eb] px-3 py-2 text-sm"
                >
                  <option value="BRILLO">Brillo</option>
                  <option value="MATE">Mate</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="block text-sm text-[#6b7280]">Copias</label>
                <input
                  type="number"
                  min="1"
                  max="99"
                  value={selectedItems[0]?.copies ?? 1}
                  onChange={(e) => {
                    const next = Math.max(1, Math.min(99, Number(e.target.value || 1)));
                    updateSelected({ copies: next });
                  }}
                  className="w-full rounded-md border border-[#e5e7eb] px-3 py-2 text-sm"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm text-[#6b7280]">Textura</label>
                <select
                  value={selectedItems[0]?.textureId || "none"}
                  onChange={(e) => updateSelectedTexture(e.target.value)}
                  className="w-full rounded-md border border-[#e5e7eb] px-3 py-2 text-sm"
                >
                  {TEXTURES.map((texture) => (
                    <option key={texture.id} value={texture.id}>
                      {texture.name}
                    </option>
                  ))}
                </select>
              </div>
            </Card>
          ) : null}
        </div>
      </Card>

      {activeItem ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)] gap-6 items-start">
            <Card className="p-6 space-y-4">
              <div className="text-sm font-medium text-[#1a1a1a]">Diseño</div>
              <div className="rounded-2xl bg-[#f3f4f6] p-6">
              <div
                ref={previewWrapRef}
                className="relative w-full sm:w-3/4 lg:w-2/3 max-w-none mx-auto"
                style={{ aspectRatio: `${activePreset.widthCm} / ${activePreset.heightCm}` }}
                onPointerDown={(event) => {
                  if (!previewWrapRef.current || !activeItem) return;
                  // No hacer nada si el click es en un texto (ya se maneja en el handler del texto)
                  const target = event.target as HTMLElement;
                  if (target.closest('[data-text-element]')) {
                    return;
                  }
                  const rect = previewWrapRef.current.getBoundingClientRect();
                  const x = event.clientX - rect.left;
                  const y = event.clientY - rect.top;
                  const photoLeft = (framePercent.photoX / 100) * rect.width;
                  const photoTop = (framePercent.photoY / 100) * rect.height;
                  const photoRight = photoLeft + (framePercent.photoW / 100) * rect.width;
                  const photoBottom = photoTop + (framePercent.photoH / 100) * rect.height;
                  const clickedOnPhoto = x >= photoLeft && x <= photoRight && y >= photoTop && y <= photoBottom;

                  setSelectedTextId(null);
                  setEditingTextId(null);
                  setTextToolActive(false);
                  if (!clickedOnPhoto && activeItem.textureId !== "none") {
                    setSelectedPanel("texture");
                  } else {
                    setSelectedPanel(null);
                  }
                }}
              >
                <canvas
                  ref={finalPreviewRef}
                  className="absolute inset-0 w-full h-full rounded-2xl"
                />
                <div
                  className="absolute overflow-hidden rounded-lg"
                  style={{
                    left: `${framePercent.photoX}%`,
                    top: `${framePercent.photoY}%`,
                    width: `${framePercent.photoW}%`,
                    height: `${framePercent.photoH}%`,
                  }}
                >
                  <Cropper
                    image={activeItem.imageSrc}
                    crop={activeItem.crop}
                    zoom={activeItem.zoom}
                    aspect={photoAspect}
                    cropShape="rect"
                    onCropChange={(crop) => updateActive({ crop })}
                    onCropAreaChange={(_, areaPixels) =>
                      updateActive({ cropPixels: areaPixels as CropAreaPixels })
                    }
                    onZoomChange={(zoom) => updateActive({ zoom })}
                    onCropComplete={(_, areaPixels) =>
                      updateActive({ cropPixels: areaPixels as CropAreaPixels })
                    }
                    objectFit="contain"
                    showGrid={false}
                    minZoom={1}
                    maxZoom={5}
                    classes={{
                      containerClassName: "absolute inset-0",
                      mediaClassName: "opacity-0",
                      cropAreaClassName: "hidden",
                    }}
                  />
                </div>
                <div className="absolute left-1/2 top-full mt-4 -translate-x-1/2 z-20 flex flex-row items-center gap-3 md:left-0 md:top-1/2 md:-translate-x-full md:-translate-y-1/2 md:flex-col md:gap-2">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      if (!activeItem) return;
                      if (activeItem.texts.length >= MAX_TEXTS) return;
                      const nextText = createText();
                      updateActive({ texts: [...activeItem.texts, nextText] });
                      setSelectedTextId(nextText.id);
                      setEditingTextId(nextText.id);
                      setTextToolActive(true);
                      setSelectedPanel("text");
                    }}
                    className="h-16 w-16 md:h-24 md:w-24 rounded-lg bg-white/95 border border-[#e5e7eb] text-xl md:text-2xl font-semibold text-[#1a1a1a] shadow-sm"
                    title="Agregar texto"
                  >
                    T
                  </button>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        if (activeItem?.textureId && activeItem.textureId !== "none") {
                          setSelectedPanel("texture");
                        } else {
                          setSelectedPanel(null);
                        }
                        setShowTextureMenu((prev) => !prev);
                      }}
                      className="h-16 w-16 md:h-24 md:w-24 rounded-lg bg-white/95 border border-[#e5e7eb] text-xl md:text-2xl text-[#1a1a1a] shadow-sm"
                      title="Fondo"
                    >
                      🖼️
                    </button>
                    {showTextureMenu ? (
                      <div
                        className="absolute left-full top-0 ml-2 w-64 max-h-72 overflow-auto rounded-lg border border-[#e5e7eb] bg-white p-2 shadow-sm"
                        onPointerDown={(event) => event.stopPropagation()}
                      >
                        <div className="space-y-2">
                          {TEXTURES.map((texture) => {
                            const isActive = texture.id === activeItem.textureId;
                            const url = getTextureUrl(texture);
                            return (
                              <button
                                key={texture.id}
                                type="button"
                                onClick={() => {
                                  // Calcular escala inicial para adaptar textura al alto completo
                                  // La escala inicial será 1, que con el nuevo cálculo en export.ts
                                  // hará que la textura se adapte al alto completo
                                  updateActive({ 
                                    textureId: texture.id, 
                                    textureSeed: createTextureSeed(),
                                    textureScale: 1, // Escala inicial que se adaptará al alto completo
                                    textureRotation: 0,
                                    textureOffsetX: 0,
                                    textureOffsetY: 0,
                                  });
                                  if (texture.id !== "none") {
                                    setSelectedPanel("texture");
                                  } else {
                                    setSelectedPanel(null);
                                  }
                                  setShowTextureMenu(false);
                                }}
                                className={`flex w-full items-center gap-3 rounded-md border px-2 py-2 text-left text-sm ${
                                  isActive ? "border-[#c27b3d] bg-[#fff7ed]" : "border-[#e5e7eb]"
                                }`}
                              >
                                {url ? (
                                  <img
                                    src={url}
                                    alt={texture.name}
                                    className="h-10 w-10 rounded object-cover border border-[#e5e7eb]"
                                  />
                                ) : (
                                  <div className="flex h-10 w-10 items-center justify-center rounded border border-[#e5e7eb] text-xs text-[#6b7280]">
                                    Sin
                                  </div>
                                )}
                                <span className="text-sm text-[#1a1a1a]">{texture.name}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ) : null}
                  </div>
                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        updateActive({ zoom: Math.min(5, Number((activeItem.zoom + 0.2).toFixed(2))) });
                      }}
                      className="h-12 w-16 md:h-16 md:w-24 rounded-lg bg-white/95 border border-[#e5e7eb] text-base md:text-lg text-[#1a1a1a] shadow-sm"
                      title="Acercar"
                    >
                      🔍+
                    </button>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        updateActive({ zoom: Math.max(0.6, Number((activeItem.zoom - 0.2).toFixed(2))) });
                      }}
                      className="h-12 w-16 md:h-16 md:w-24 rounded-lg bg-white/95 border border-[#e5e7eb] text-base md:text-lg text-[#1a1a1a] shadow-sm"
                      title="Alejar"
                    >
                      🔍-
                    </button>
                  </div>
                </div>
                <div className="absolute inset-0 pointer-events-none">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      goPrev();
                    }}
                    disabled={activeIndex === 0}
                    className="pointer-events-auto absolute -left-6 top-1/2 -translate-y-1/2 h-12 w-12 rounded-full bg-white border border-[#c27b3d] text-2xl text-[#1a1a1a] shadow-md disabled:opacity-40"
                    aria-label="Anterior"
                  >
                    ←
                  </button>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      goNext();
                    }}
                    disabled={activeIndex >= items.length - 1}
                    className="pointer-events-auto absolute -right-6 top-1/2 -translate-y-1/2 h-12 w-12 rounded-full bg-white border border-[#c27b3d] text-2xl text-[#1a1a1a] shadow-md disabled:opacity-40"
                    aria-label="Siguiente"
                  >
                    →
                  </button>
                </div>
                {activeItem.texts.map((text) => (
                  <div
                    key={text.id}
                    data-text-element="true"
                    onPointerDown={(event) => {
                      event.stopPropagation();
                      event.preventDefault();
                      onPointerDownText(text.id, event);
                    }}
                    onDoubleClick={(event) => {
                      event.stopPropagation();
                      event.preventDefault();
                      setEditingTextId(text.id);
                    }}
                    onClick={(event) => {
                      event.stopPropagation();
                      event.preventDefault();
                      // Solo seleccionar si no está editando
                      if (editingTextId !== text.id) {
                        setSelectedTextId(text.id);
                        setSelectedPanel("text");
                      }
                    }}
                    className={`absolute select-none cursor-move ${
                      selectedTextId === text.id ? "ring-1 ring-[#c27b3d]" : ""
                    }`}
                    style={{
                      left: `${text.x * 100}%`,
                      top: `${text.y * 100}%`,
                      transform: `translate(-50%, -50%) rotate(${text.rotation}deg)`,
                      color: text.color,
                      fontFamily: `${getPolaroidFontFamily(text.fontFamily)}, ${POLAROID_FONT_FALLBACK}`,
                      fontSize: `${text.fontSize}px`,
                      fontWeight: text.bold ? "700" : "400",
                      fontStyle: text.italic ? "italic" : "normal",
                      textAlign: text.align as any,
                      whiteSpace: "pre",
                      pointerEvents: "auto",
                      userSelect: "none",
                      textShadow:
                        text.shadowBlur && text.shadowBlur > 0
                          ? `${text.shadowOffsetX ?? 0}px ${text.shadowOffsetY ?? 2}px ${text.shadowBlur}px ${
                              text.shadowColor ?? "rgba(0,0,0,0.35)"
                            }`
                          : undefined,
                      WebkitTextStroke:
                        text.strokeWidth && text.strokeWidth > 0
                          ? `${text.strokeWidth}px ${text.strokeColor || "#111111"}`
                          : undefined,
                    }}
                  >
                    {editingTextId === text.id ? (
                      <span
                        contentEditable
                        suppressContentEditableWarning
                        onClick={(event) => event.stopPropagation()}
                        onBlur={(e) => {
                          updateActiveText(text.id, { value: e.currentTarget.textContent || "" });
                          setEditingTextId(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            (e.currentTarget as HTMLElement).blur();
                          }
                        }}
                      >
                        {text.value || "Texto"}
                      </span>
                    ) : (
                      <span>{text.value || "Texto"}</span>
                    )}
                    {selectedTextId === text.id && (
                      <span
                        onPointerDown={(event) => {
                          event.stopPropagation();
                          resizingRef.current = {
                            id: text.id,
                            startX: event.clientX,
                            startY: event.clientY,
                            startSize: text.fontSize,
                          };
                        }}
                        className="absolute -right-2 -bottom-2 h-3 w-3 rounded bg-[#c27b3d] border border-white"
                      />
                    )}
                    {selectedTextId === text.id && (
                      <span
                        onPointerDown={(event) => {
                          event.stopPropagation();
                          const parent = event.currentTarget.parentElement;
                          if (!parent) return;
                          const rect = parent.getBoundingClientRect();
                          const centerX = rect.left + rect.width / 2;
                          const centerY = rect.top + rect.height / 2;
                          rotatingRef.current = {
                            id: text.id,
                            centerX,
                            centerY,
                            startAngle: Math.atan2(event.clientY - centerY, event.clientX - centerX),
                            startRotation: text.rotation,
                          };
                        }}
                        className="absolute left-1/2 top-full mt-2 -translate-x-1/2 h-4 w-4 rounded-full bg-white border border-[#c27b3d] shadow-sm"
                        title="Rotar"
                      />
                    )}
                  </div>
                ))}
                </div>
              </div>
            </Card>

            <div className="space-y-6">
              <div className="grid gap-6 md:grid-cols-1">
                <Card className="p-6 space-y-4">
                  <div className="text-sm font-medium text-[#1a1a1a]">Ajustes</div>
                  <SizeSelector
                    value={activePreset}
                    onChange={(next) => {
                      if (!activeItem) return;
                      updateActive({ presetId: next.id });
                      setDefaultPresetId(next.id);
                    }}
                  />
                  <div className="space-y-2">
                    <label className="block text-sm text-[#6b7280]">Acabado</label>
                    <select
                      value={activeItem.finish}
                      onChange={(e) =>
                        updateActive({ finish: e.target.value as "BRILLO" | "MATE" })
                      }
                      className="w-full rounded-md border border-[#e5e7eb] px-3 py-2 text-sm"
                    >
                      <option value="BRILLO">Brillo</option>
                      <option value="MATE">Mate</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm text-[#6b7280]">Copias</label>
                    <input
                      type="number"
                      min="1"
                      max="99"
                      value={activeItem.copies}
                      onChange={(e) => {
                        const next = Math.max(1, Math.min(99, Number(e.target.value || 1)));
                        updateActive({ copies: next });
                      }}
                      className="w-full rounded-md border border-[#e5e7eb] px-3 py-2 text-sm"
                    />
                  </div>
              {showTexturePanel ? (
                <div className="space-y-2">
                  <label className="block text-sm text-[#6b7280]">Textura</label>
                  <div className="grid grid-cols-1 gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs text-[#6b7280]">
                        <span>Escala</span>
                        <span>{(activeItem.textureScale ?? 1).toFixed(2)}x</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            updateActive({
                              textureScale: Math.max(0.3, Number(((activeItem.textureScale ?? 1) - 0.05).toFixed(2))),
                            })
                          }
                          className="h-8 w-8 rounded-md border border-[#e5e7eb] text-sm"
                        >
                          -
                        </button>
                        <input
                          type="range"
                          min="0.3"
                          max="3"
                          step="0.05"
                          value={activeItem.textureScale ?? 1}
                          onChange={(e) => updateActive({ textureScale: Number(e.target.value) })}
                          className="w-full"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            updateActive({
                              textureScale: Math.min(3, Number(((activeItem.textureScale ?? 1) + 0.05).toFixed(2))),
                            })
                          }
                          className="h-8 w-8 rounded-md border border-[#e5e7eb] text-sm"
                        >
                          +
                        </button>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs text-[#6b7280]">
                        <span>Rotación</span>
                        <span>{Math.round(activeItem.textureRotation ?? 0)}°</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            updateActive({
                              textureRotation: Math.max(-180, (activeItem.textureRotation ?? 0) - 1),
                            })
                          }
                          className="h-8 w-8 rounded-md border border-[#e5e7eb] text-sm"
                        >
                          -
                        </button>
                        <input
                          type="range"
                          min="-180"
                          max="180"
                          step="1"
                          value={activeItem.textureRotation ?? 0}
                          onChange={(e) => updateActive({ textureRotation: Number(e.target.value) })}
                          className="w-full"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            updateActive({
                              textureRotation: Math.min(180, (activeItem.textureRotation ?? 0) + 1),
                            })
                          }
                          className="h-8 w-8 rounded-md border border-[#e5e7eb] text-sm"
                        >
                          +
                        </button>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs text-[#6b7280]">
                        <span>Posición X</span>
                        <span>{Math.round((activeItem.textureOffsetX ?? 0) * 100)}%</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            updateActive({
                              textureOffsetX: Math.max(-0.5, Number(((activeItem.textureOffsetX ?? 0) - 0.02).toFixed(2))),
                            })
                          }
                          className="h-8 w-8 rounded-md border border-[#e5e7eb] text-sm"
                        >
                          -
                        </button>
                        <input
                          type="range"
                          min="-0.5"
                          max="0.5"
                          step="0.01"
                          value={activeItem.textureOffsetX ?? 0}
                          onChange={(e) => updateActive({ textureOffsetX: Number(e.target.value) })}
                          className="w-full"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            updateActive({
                              textureOffsetX: Math.min(0.5, Number(((activeItem.textureOffsetX ?? 0) + 0.02).toFixed(2))),
                            })
                          }
                          className="h-8 w-8 rounded-md border border-[#e5e7eb] text-sm"
                        >
                          +
                        </button>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs text-[#6b7280]">
                        <span>Posición Y</span>
                        <span>{Math.round((activeItem.textureOffsetY ?? 0) * 100)}%</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            updateActive({
                              textureOffsetY: Math.max(-0.5, Number(((activeItem.textureOffsetY ?? 0) - 0.02).toFixed(2))),
                            })
                          }
                          className="h-8 w-8 rounded-md border border-[#e5e7eb] text-sm"
                        >
                          -
                        </button>
                        <input
                          type="range"
                          min="-0.5"
                          max="0.5"
                          step="0.01"
                          value={activeItem.textureOffsetY ?? 0}
                          onChange={(e) => updateActive({ textureOffsetY: Number(e.target.value) })}
                          className="w-full"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            updateActive({
                              textureOffsetY: Math.min(0.5, Number(((activeItem.textureOffsetY ?? 0) + 0.02).toFixed(2))),
                            })
                          }
                          className="h-8 w-8 rounded-md border border-[#e5e7eb] text-sm"
                        >
                          +
                        </button>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        updateActive({
                          textureScale: 1,
                          textureRotation: 0,
                          textureOffsetX: 0,
                          textureOffsetY: 0,
                        })
                      }
                      className="rounded-md border border-[#e5e7eb] px-3 py-2 text-xs text-[#1a1a1a] hover:bg-[#f9fafb]"
                    >
                      Reset textura
                    </button>
                  </div>
                </div>
              ) : null}
                  {selectedTextId ? (
                    <div className="text-xs text-[#6b7280]">
                      Con el texto seleccionado, presioná Supr para borrarlo.
                    </div>
                  ) : (
                    <div className="text-xs text-[#6b7280]">
                      Seleccioná un texto para editarlo o borrarlo.
                    </div>
                  )}
                </Card>

            {showTextPanel ? (
              <Card className="p-6 space-y-4">
                <div className="text-sm font-medium text-[#1a1a1a]">Formato de texto</div>
                {activeText ? (
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="color"
                      value={activeText.color}
                      onChange={(e) => updateActiveText(activeText.id, { color: e.target.value })}
                    />
                    <div className="relative col-span-2">
                      <button
                        type="button"
                        onPointerDown={(event) => {
                          event.stopPropagation();
                          setShowFontMenu((prev) => !prev);
                        }}
                        className="w-full text-left text-xs border border-[#e5e7eb] rounded px-2 py-1"
                        style={{ fontFamily: getPolaroidFontFamily(activeText.fontFamily) }}
                      >
                        {
                          POLAROID_FONTS.find(
                            (font) => font.value === normalizePolaroidFontValue(activeText.fontFamily)
                          )?.label
                        }
                      </button>
                      {showFontMenu ? (
                        <div
                          className="absolute left-0 top-full mt-1 w-full max-h-56 overflow-auto rounded-md border border-[#e5e7eb] bg-white shadow-sm z-20"
                          onPointerDown={(event) => event.stopPropagation()}
                        >
                          {POLAROID_FONTS.map((font) => (
                            <button
                              key={font.value}
                              type="button"
                              onPointerDown={(event) => {
                                event.stopPropagation();
                                updateActiveText(activeText.id, { fontFamily: font.value });
                                setShowFontMenu(false);
                              }}
                              className="flex w-full items-center px-2 py-2 text-left text-xs hover:bg-[#f9fafb]"
                              style={{ fontFamily: getPolaroidFontFamily(font.value) }}
                            >
                              {font.label}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      onClick={() => updateActiveText(activeText.id, { bold: !activeText.bold })}
                      className={`text-xs border rounded px-2 py-1 flex items-center justify-center gap-2 ${activeText.bold ? "border-[#c27b3d]" : "border-[#e5e7eb]"}`}
                      title="Negrita"
                    >
                      <span style={{ fontWeight: 700 }}>Aa</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => updateActiveText(activeText.id, { italic: !activeText.italic })}
                      className={`text-xs border rounded px-2 py-1 flex items-center justify-center gap-2 ${activeText.italic ? "border-[#c27b3d]" : "border-[#e5e7eb]"}`}
                      title="Cursiva"
                    >
                      <span style={{ fontStyle: "italic" }}>Aa</span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        updateActiveText(activeText.id, {
                          shadowBlur: activeText.shadowBlur ? 0 : 6,
                          shadowOffsetX: 0,
                          shadowOffsetY: 2,
                        })
                      }
                      className={`text-xs border rounded px-2 py-1 flex items-center justify-center gap-2 ${activeText.shadowBlur ? "border-[#c27b3d]" : "border-[#e5e7eb]"}`}
                      title="Sombra"
                    >
                      <span
                        style={{
                          textShadow: "0 2px 4px rgba(0,0,0,0.35)",
                          fontWeight: 600,
                        }}
                      >
                        Aa
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        updateActiveText(activeText.id, {
                          strokeWidth: activeText.strokeWidth ? 0 : 2,
                        })
                      }
                      className={`text-xs border rounded px-2 py-1 flex items-center justify-center gap-2 ${activeText.strokeWidth ? "border-[#c27b3d]" : "border-[#e5e7eb]"}`}
                      title="Borde"
                    >
                      <span
                        style={{
                          WebkitTextStroke: "1px #111111",
                          color: "transparent",
                          fontWeight: 700,
                        }}
                      >
                        Aa
                      </span>
                    </button>
                    {activeText.strokeWidth ? (
                      <input
                        type="color"
                        value={activeText.strokeColor || "#111111"}
                        onChange={(e) => updateActiveText(activeText.id, { strokeColor: e.target.value })}
                      />
                    ) : null}
                    {activeText.shadowBlur ? (
                      <input
                        type="color"
                        value={activeText.shadowColor || "rgba(0,0,0,0.35)"}
                        onChange={(e) => updateActiveText(activeText.id, { shadowColor: e.target.value })}
                      />
                    ) : null}
                  </div>
                ) : (
                  <div className="text-xs text-[#6b7280]">
                    Seleccioná un texto o usá la herramienta de texto para editar el formato.
                  </div>
                )}
              </Card>
            ) : null}

              </div>

          <div className="h-0" />
            </div>
          </div>
        </div>
      ) : (
        <Card className="p-6 text-sm text-[#6b7280]">
          Subí fotos para comenzar a editar.
        </Card>
      )}

      <OrderPanel
        itemCount={items.reduce((sum, item) => sum + Math.max(1, item.copies || 1), 0)}
        onExport={handleExport}
        exporting={exporting}
        submitLabel={submitLabel}
        helperText={onExport ? "Se generan las hojas finales para imprimir y se prepara el pedido." : undefined}
      />
    </div>
  );
}
