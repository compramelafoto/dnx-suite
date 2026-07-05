"use client";

import { useRef, useMemo, useCallback, memo, useState, useEffect } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import Card from "@/components/ui/Card";
import type { ImageAsset } from "./types";

const COLUMNS = 1; // Una columna: fotos una arriba de la otra
const ROW_HEIGHT = 104; // h-24 (96px) + gap
const GAP = 8;


type ImageThumbnailProps = {
  img: ImageAsset;
  onToggleFavorite: (id: string) => void;
  isSelected?: boolean;
  onSelect?: (id: string | null) => void;
};

const ImageThumbnail = memo(function ImageThumbnail({ img, onToggleFavorite, isSelected, onSelect }: ImageThumbnailProps) {
  return (
    <div
      className={`relative h-full min-h-[96px] w-full rounded-md cursor-pointer ${
        isSelected ? "ring-2 ring-[#c27b3d] ring-offset-1" : ""
      }`}
      onClick={(e) => {
        if (onSelect && !(e.target as HTMLElement).closest("button")) onSelect(isSelected ? null : img.id);
      }}
      title={isSelected ? "Seleccionada. Suprimir para borrar del listado." : "Clic para seleccionar. Suprimir borra."}
    >
      <img
        src={img.url}
        alt={img.name}
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData("application/x-image-id", img.id);
          e.dataTransfer.effectAllowed = "copy";
        }}
        className="h-24 w-full rounded-md object-cover"
      />
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onToggleFavorite(img.id);
        }}
        className={`absolute right-2 top-2 rounded-full px-2 py-0.5 text-xs ${
          img.favorite ? "bg-[#c27b3d] text-white" : "bg-white/90 text-[#6b7280]"
        }`}
      >
        {img.favorite ? "★" : "☆"}
      </button>
    </div>
  );
});

type ImageBrowserProps = {
  images: ImageAsset[];
  usedImageIds: Set<string>;
  onToggleFavorite: (id: string) => void;
  /** Id de la imagen seleccionada en el listado (Suprimir la borra). */
  selectedImageId?: string | null;
  onSelectImage?: (id: string | null) => void;
  /** Si true, muestra pestañas y fotos en una fila horizontal (para poner abajo del editor). */
  horizontal?: boolean;
  /** Cuántas veces está usada cada imagen en el diseño (solo en horizontal: opacidad 50% + badge). */
  usedImageCount?: Record<string, number>;
  /** Botón "Agregar fotos" dentro de la barra de imágenes (solo horizontal). */
  addPhotosButton?: {
    onClick: () => void;
    uploading?: boolean;
    /** Progreso de subida: muestra barra con porcentaje y restantes */
    uploadProgress?: { done: number; total: number };
  };
};

const TABS: Array<{ id: string; label: string; title: string; icon: React.ReactNode }> = [
  {
    id: "all",
    label: "Todas",
    title: "Todas las imágenes",
    icon: (
      <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  {
    id: "used",
    label: "Usadas",
    title: "Usadas en el diseño",
    icon: (
      <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M20 6L9 17l-5-5" />
      </svg>
    ),
  },
  {
    id: "unused",
    label: "Sin usar",
    title: "No usadas en el diseño",
    icon: (
      <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <rect x="3" y="3" width="18" height="18" rx="2" />
      </svg>
    ),
  },
  {
    id: "favorites",
    label: "Fav",
    title: "Favoritas",
    icon: (
      <svg width={16} height={16} viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden>
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
      </svg>
    ),
  },
];

export default function ImageBrowser({
  images,
  usedImageIds,
  onToggleFavorite,
  selectedImageId = null,
  onSelectImage,
  horizontal = false,
  usedImageCount,
  addPhotosButton,
}: ImageBrowserProps) {
  const [activeTab, setActiveTab] = useState("all");
  const scrollRef = useRef<HTMLDivElement>(null);
  const horizontalScrollRef = useRef<HTMLDivElement>(null);
  const prevImagesLengthRef = useRef(images.length);

  // Al agregar nuevas fotos (segunda tanda, etc.): mostrar pestaña Todas y hacer scroll al final
  useEffect(() => {
    if (horizontal && images.length > prevImagesLengthRef.current) {
      prevImagesLengthRef.current = images.length;
      setActiveTab("all"); // Mostrar todas para que las nuevas se vean
      requestAnimationFrame(() => {
        const el = horizontalScrollRef.current;
        if (el) el.scrollLeft = el.scrollWidth - el.clientWidth;
      });
    } else {
      prevImagesLengthRef.current = images.length;
    }
  }, [horizontal, images.length]);

  const filtered = useMemo(() => {
    return images.filter((img) => {
      if (activeTab === "used") return usedImageIds.has(img.id);
      if (activeTab === "unused") return !usedImageIds.has(img.id);
      if (activeTab === "favorites") return Boolean(img.favorite);
      return true;
    });
  }, [activeTab, images, usedImageIds]);

  const rowCount = Math.ceil(filtered.length / COLUMNS) || 1;
  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 2,
  });

  const stableOnToggle = useCallback((id: string) => onToggleFavorite(id), [onToggleFavorite]);

  const totalSize = virtualizer.getTotalSize();
  const virtualItems = virtualizer.getVirtualItems();

  if (horizontal) {
    return (
      <div className="flex flex-col gap-2 min-h-0 flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <div className="grid grid-cols-4 gap-0.5 border-b border-[#e5e7eb] -mb-px">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                title={tab.title}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center justify-center gap-1 px-2 py-1.5 text-xs font-medium transition-colors whitespace-nowrap border-b-2 -mb-px min-w-0 ${
                  activeTab === tab.id
                    ? "border-[#c27b3d] text-[#c27b3d]"
                    : "border-transparent text-[#6b7280] hover:text-[#1a1a1a] hover:border-[#e5e7eb]"
                }`}
              >
                <span className="shrink-0 flex items-center justify-center [&_svg]:text-current" aria-hidden>
                  {tab.icon}
                </span>
                <span className="truncate">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
        <div
          ref={horizontalScrollRef}
          className="flex gap-2 overflow-x-auto pb-1 min-h-[140px] items-center flex-1 min-h-0"
        >
          {addPhotosButton?.uploadProgress && addPhotosButton.uploadProgress.total > 0 && (
            <div className="shrink-0 w-40 flex flex-col gap-1.5 p-2 rounded-lg border-2 border-[#c27b3d]/30 bg-[#fef7f3]">
              <div className="flex justify-between text-xs">
                <span className="font-medium text-[#1a1a1a]">
                  Subiendo {addPhotosButton.uploadProgress.done} de {addPhotosButton.uploadProgress.total}
                </span>
                <span className="text-[#6b7280]">
                  {addPhotosButton.uploadProgress.total - addPhotosButton.uploadProgress.done} restante{(addPhotosButton.uploadProgress.total - addPhotosButton.uploadProgress.done) !== 1 ? "s" : ""}
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-[#e5e7eb] overflow-hidden">
                <div
                  className="h-full rounded-full bg-[#c27b3d] transition-all duration-300"
                  style={{
                    width: `${Math.min(100, Math.round((addPhotosButton.uploadProgress.done / addPhotosButton.uploadProgress.total) * 100))}%`,
                  }}
                />
              </div>
              <span className="text-[10px] font-medium text-[#6b7280]">
                {Math.min(100, Math.round((addPhotosButton.uploadProgress.done / addPhotosButton.uploadProgress.total) * 100))}%
              </span>
            </div>
          )}
          {addPhotosButton && (
            <button
              type="button"
              onClick={addPhotosButton.onClick}
              disabled={addPhotosButton.uploading}
              className="shrink-0 w-20 h-28 rounded-lg border-2 border-dashed border-[#c27b3d] bg-[#fff7ee]/50 hover:bg-[#fff7ee] hover:border-[#c27b3d] flex flex-col items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
              title="Agregar fotos"
            >
              <svg className="w-8 h-8 text-[#c27b3d]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
              </svg>
              <span className="text-2xl font-light text-[#c27b3d] leading-none">+</span>
              <span className="text-[10px] font-medium text-[#c27b3d]">Agregar fotos</span>
            </button>
          )}
          {filtered.length === 0 ? (
            <p className="text-xs text-[#6b7280] py-2 shrink-0">
              {addPhotosButton
                ? "Arrastrá fotos aquí o agregá con el botón."
                : activeTab === "favorites"
                  ? "No hay favoritas."
                  : activeTab === "used"
                    ? "Ninguna usada aún."
                    : activeTab === "unused"
                      ? "Todas usadas o no hay imágenes."
                      : "Agregá imágenes con el botón de arriba o cargá un pedido con fotos del cliente."}
            </p>
          ) : (
            filtered.map((img) => {
              const isUsed = usedImageIds.has(img.id);
              const count = (usedImageCount && usedImageCount[img.id]) ?? (isUsed ? 1 : 0);
              return (
                <div
                  key={img.id}
                  className="shrink-0 w-16 h-16 rounded-md overflow-hidden border-2 cursor-pointer transition-colors relative"
                  style={{
                    borderColor: selectedImageId === img.id ? "#c27b3d" : "#e2e8f0",
                    boxShadow: selectedImageId === img.id ? "0 0 0 2px rgba(194,123,61,0.3)" : undefined,
                    opacity: isUsed ? 0.5 : 1,
                  }}
                  onClick={() => onSelectImage?.(selectedImageId === img.id ? null : img.id)}
                  title={img.name}
                >
                  <img
                    src={img.url}
                    alt={img.name}
                    className="w-full h-full object-cover block"
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("application/x-image-id", img.id);
                      e.dataTransfer.effectAllowed = "copy";
                    }}
                  />
                  {count > 0 && (
                    <span
                      className="absolute inset-0 flex items-center justify-center text-red-600 font-bold text-sm drop-shadow-[0_0_1px_white]"
                      style={{ textShadow: "0 0 2px white, 0 0 4px white" }}
                      aria-hidden
                    >
                      {count}
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  }

  return (
    <Card className="flex flex-col gap-2 bg-[#f3f4f6] border border-[#d1d5db] shadow-sm p-4 min-h-0 h-full">
      <div className="flex flex-col gap-2 shrink-0">
        <div className="text-sm font-medium text-[#1a1a1a]">Imágenes</div>
        <div className="grid grid-cols-4 gap-0.5 border-b border-[#e5e7eb] -mb-px">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              title={tab.title}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center justify-center gap-1 px-1.5 py-2 text-xs font-medium transition-colors whitespace-nowrap border-b-2 -mb-px min-w-0 ${
                activeTab === tab.id
                  ? "border-[#c27b3d] text-[#c27b3d]"
                  : "border-transparent text-[#6b7280] hover:text-[#1a1a1a] hover:border-[#e5e7eb]"
              }`}
            >
              <span className="shrink-0 flex items-center justify-center [&_svg]:text-current" aria-hidden>
                {tab.icon}
              </span>
              <span className="truncate">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="min-h-0 flex-1 flex flex-col">
        <div
          ref={scrollRef}
          className="overflow-auto min-h-0 flex-1 min-h-[120px]"
          style={{ contain: "strict" }}
        >
          {filtered.length === 0 ? (
            <div className="py-6 text-center text-sm text-[#6b7280]">
              {activeTab === "favorites" ? "No hay favoritas." : activeTab === "used" ? "Ninguna usada aún." : activeTab === "unused" ? "Todas usadas o no hay imágenes." : "Agregá imágenes con el botón de arriba o cargá un pedido con fotos del cliente."}
            </div>
          ) : (
            <div
              style={{
                height: `${totalSize}px`,
                width: "100%",
                position: "relative",
              }}
            >
              {virtualItems.map((virtualRow) => {
                const start = virtualRow.index * COLUMNS;
                const rowImages = filtered.slice(start, start + COLUMNS);
                return (
                  <div
                    key={virtualRow.key}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      height: `${virtualRow.size}px`,
                      transform: `translateY(${virtualRow.start}px)`,
                      display: "grid",
                      gridTemplateColumns: `repeat(${COLUMNS}, 1fr)`,
                      gap: GAP,
                      paddingRight: 4,
                    }}
                  >
                    {rowImages.map((img) => (
                      <ImageThumbnail
                        key={img.id}
                        img={img}
                        onToggleFavorite={stableOnToggle}
                        isSelected={selectedImageId === img.id}
                        onSelect={onSelectImage ? (id) => onSelectImage(id) : undefined}
                      />
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
