"use client";

import { cn } from "@/lib/utils";

interface PhotoCardProps {
  src: string;
  alt: string;
  selected?: boolean;
  isCover?: boolean;
  statusBadge?: string | null;
  sellDigital?: boolean;
  sellPrint?: boolean;
  onSelect?: () => void;
  onRemove?: () => void;
  onSetCover?: () => void;
  onRequestRemoval?: () => void;
  onOpenSlide?: () => void;
  onSellDigitalChange?: (value: boolean) => void;
  onSellPrintChange?: (value: boolean) => void;
  noDrag?: boolean;
  className?: string;
}

export default function PhotoCard({
  src,
  alt,
  selected = false,
  isCover = false,
  statusBadge = null,
  sellDigital = true,
  sellPrint = true,
  onSelect,
  onRemove,
  onSetCover,
  onRequestRemoval,
  onOpenSlide,
  onSellDigitalChange,
  onSellPrintChange,
  noDrag = false,
  className,
}: PhotoCardProps) {
  const showSellToggles = Boolean(onSellDigitalChange || onSellPrintChange);
  function handleKeyDown(e: React.KeyboardEvent) {
    if (onSelect && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      onSelect();
    }
  }

  return (
    <div
      role={onSelect ? "button" : undefined}
      tabIndex={onSelect ? 0 : undefined}
      onClick={(e) => {
        onSelect?.();
      }}
      onKeyDown={onSelect ? handleKeyDown : undefined}
      onContextMenu={noDrag ? (e) => e.preventDefault() : undefined}
      className={cn(
        "relative rounded-lg overflow-hidden group transition-all duration-200",
        "hover:shadow-lg hover:scale-[1.02]",
        "bg-[#f3f4f6] flex items-center justify-center",
        "min-h-[150px] max-h-64",
        onSelect && "cursor-pointer",
        selected && "ring-2 ring-[#c27b3d] ring-offset-2",
        isCover && "ring-2 ring-[#10b981] ring-offset-2",
        className
      )}
    >
      {selected && (
        <div className="absolute top-2 left-2 z-10 flex items-center gap-1.5 bg-[#c27b3d] text-white text-xs font-medium px-2.5 py-1 rounded-full shadow">
          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
          Seleccionada
        </div>
      )}
      <div 
        className={cn("relative w-full h-full flex items-center justify-center p-2", noDrag && "select-none")}
      >
        <img
          src={src}
          alt={alt}
          className={cn("max-w-full max-h-64 object-contain transition-transform")}
          style={{ width: "auto", height: "auto", ...(noDrag ? { WebkitUserDrag: "none" as const, userSelect: "none" } : {}) }}
          draggable={!noDrag}
          onDragStart={noDrag ? (e) => e.preventDefault() : undefined}
        />
      </div>
      {isCover && (
        <div className="absolute top-2 left-2 bg-[#10b981] text-white text-xs font-medium px-2 py-1 rounded">
          Portada
        </div>
      )}
      {statusBadge && (
        <div className="absolute bottom-2 left-2 bg-black/70 text-white text-[11px] font-medium px-2 py-1 rounded">
          {statusBadge}
        </div>
      )}
      <div className="absolute top-2 right-2 flex gap-1">
        {onOpenSlide && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onOpenSlide();
            }}
            className="bg-[#2563eb] text-white rounded-full p-2 hover:bg-[#1d4ed8] transition-colors shadow"
            aria-label="Ver en modo slide"
            title="Ver en modo slide"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607zM10.5 7.5v6m3-3h-6" />
            </svg>
          </button>
        )}
        {onSetCover && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSetCover();
            }}
            className={cn(
              "text-white rounded-full p-1.5 transition-colors",
              isCover ? "bg-[#10b981]" : "bg-[#3b82f6] hover:bg-[#2563eb]"
            )}
            aria-label={isCover ? "Ya es portada" : "Establecer como portada"}
            title={isCover ? "Ya es portada" : "Establecer como portada"}
          >
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
          </button>
        )}
        {onRemove && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            className="bg-[#ef4444] text-white rounded-full p-1.5 hover:bg-[#dc2626] transition-colors"
            aria-label="Eliminar foto"
            title="Eliminar foto"
          >
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        )}
      </div>
      {/* Botón de remoción en esquina inferior derecha */}
      {onRequestRemoval && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRequestRemoval();
          }}
          className="absolute bottom-1.5 right-1.5 bg-yellow-500 hover:bg-yellow-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
          aria-label="Solicitar remoción de foto"
          title="Solicitar remoción de foto"
        >
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        </button>
      )}
      {/* Toggles de venta: Digital / Impresa */}
      {showSellToggles && (
        <div className="absolute bottom-0 left-0 right-0 flex gap-1 p-1.5 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
          {onSellDigitalChange && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onSellDigitalChange(!sellDigital); }}
              className={cn(
                "flex-1 min-w-0 text-[10px] font-medium py-1.5 px-2 rounded transition-colors",
                sellDigital ? "bg-[#c27b3d] text-white" : "bg-white/20 text-white/80 hover:bg-white/30"
              )}
              title={sellDigital ? "Se vende digital (click para desactivar)" : "No se vende digital (click para activar)"}
            >
              Digital
            </button>
          )}
          {onSellPrintChange && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onSellPrintChange(!sellPrint); }}
              className={cn(
                "flex-1 min-w-0 text-[10px] font-medium py-1.5 px-2 rounded transition-colors",
                sellPrint ? "bg-[#10b981] text-white" : "bg-white/20 text-white/80 hover:bg-white/30"
              )}
              title={sellPrint ? "Se vende impresa (click para desactivar)" : "No se vende impresa (click para activar)"}
            >
              Impresa
            </button>
          )}
        </div>
      )}
    </div>
  );
}
