"use client";

import type { MouseEvent as ReactMouseEvent } from "react";
import { Check, Maximize2, Star, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type AlbumExplorerTilePhoto = {
  id: string;
  src: string;
  alt: string;
  selected: boolean;
  isCover: boolean;
  canDelete?: boolean;
  sellDigital: boolean;
  sellPrint: boolean;
};

type Props = {
  photo: AlbumExplorerTilePhoto;
  /** Click en la miniatura: alterna la selección (con Shift, selecciona un rango). */
  onClick?: (e: ReactMouseEvent) => void;
  onOpen: () => void;
  onRemove?: () => void;
  onSetCover?: () => void;
  onSellOptionChange?: (field: "sellDigital" | "sellPrint", value: boolean) => void;
};

const iconBtn =
  "w-7 h-7 flex items-center justify-center rounded-md text-white/90 hover:bg-white/20 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70";

/** Miniatura del explorador de fotos: imagen + nombre, acciones solo al pasar el mouse. */
export default function AlbumExplorerPhotoTile({
  photo,
  onClick,
  onOpen,
  onRemove,
  onSetCover,
  onSellOptionChange,
}: Props) {
  const selectable = Boolean(onClick);
  const notForSale = !photo.sellDigital || !photo.sellPrint;

  return (
    <div className="group/tile flex flex-col items-center gap-1 min-w-0" data-photo-id={photo.id}>
      <div
        role={selectable ? "checkbox" : undefined}
        aria-checked={selectable ? photo.selected : undefined}
        aria-label={photo.alt}
        tabIndex={0}
        onClick={onClick}
        onDoubleClick={(e) => {
          e.preventDefault();
          onOpen();
        }}
        onKeyDown={(e) => {
          if (e.key === " " && onClick) {
            e.preventDefault();
            onClick(e as unknown as ReactMouseEvent);
          } else if (e.key === "Enter") {
            e.preventDefault();
            onOpen();
          }
        }}
        className={cn(
          "relative w-full aspect-square rounded-lg p-1.5 transition-colors cursor-default",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3d8ee0]/70",
          photo.selected ? "bg-[#c27b3d]/15 ring-2 ring-[#c27b3d]" : "hover:bg-black/[0.05]"
        )}
      >
        <img
          src={photo.src}
          alt={photo.alt}
          loading="lazy"
          decoding="async"
          draggable={false}
          className="w-full h-full object-contain rounded-[3px] !pointer-events-none select-none drop-shadow-[0_1px_2px_rgba(0,0,0,0.18)]"
        />

        {selectable ? (
          <span
            className={cn(
              "absolute top-2.5 left-2.5 w-5 h-5 rounded-full border flex items-center justify-center transition-opacity shadow-sm",
              photo.selected
                ? "bg-[#c27b3d] border-[#c27b3d] text-white opacity-100"
                : "bg-white/85 border-black/25 text-transparent opacity-0 group-hover/tile:opacity-100 [@media(hover:none)]:opacity-100"
            )}
            aria-hidden
          >
            <Check className="w-3 h-3" strokeWidth={3} />
          </span>
        ) : null}

        <div
          className="absolute top-2 right-2 flex items-center rounded-lg bg-black/60 backdrop-blur-sm p-0.5 opacity-0 transition-opacity group-hover/tile:opacity-100 group-has-[:focus-visible]/tile:opacity-100 [@media(hover:none)]:opacity-100"
          onClick={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
        >
          <button type="button" className={iconBtn} onClick={onOpen} title="Ver ampliada (con marca de agua)" aria-label="Ver ampliada">
            <Maximize2 className="w-3.5 h-3.5" aria-hidden />
          </button>
          {onSetCover ? (
            <button
              type="button"
              className={cn(iconBtn, photo.isCover && "text-amber-300")}
              onClick={onSetCover}
              title={photo.isCover ? "Ya es la portada" : "Usar como portada"}
              aria-label={photo.isCover ? "Ya es la portada" : "Usar como portada"}
            >
              <Star className="w-3.5 h-3.5" fill={photo.isCover ? "currentColor" : "none"} aria-hidden />
            </button>
          ) : null}
          {onRemove && photo.canDelete !== false ? (
            <button
              type="button"
              className={cn(iconBtn, "hover:bg-red-500/80")}
              onClick={onRemove}
              title="Eliminar foto"
              aria-label="Eliminar foto"
            >
              <Trash2 className="w-3.5 h-3.5" aria-hidden />
            </button>
          ) : null}
        </div>

        {onSellOptionChange ? (
          <div
            className="absolute bottom-2 inset-x-2 flex justify-center gap-1 opacity-0 transition-opacity group-hover/tile:opacity-100 group-has-[:focus-visible]/tile:opacity-100 [@media(hover:none)]:opacity-100"
            onClick={(e) => e.stopPropagation()}
            onDoubleClick={(e) => e.stopPropagation()}
          >
            {(
              [
                ["sellDigital", "Digital", photo.sellDigital],
                ["sellPrint", "Impresa", photo.sellPrint],
              ] as const
            ).map(([field, label, on]) => (
              <button
                key={field}
                type="button"
                onClick={() => onSellOptionChange(field, !on)}
                className={cn(
                  "h-6 px-2 rounded-md text-[10px] font-semibold shadow-sm backdrop-blur-sm transition-colors",
                  on ? "bg-white/95 text-[#111827]" : "bg-black/55 text-white/70 line-through"
                )}
                title={on ? `Se vende ${label.toLowerCase()} (click para desactivar)` : `No se vende ${label.toLowerCase()} (click para activar)`}
                aria-pressed={on}
              >
                {label}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <span
        className={cn(
          "max-w-full truncate px-1.5 py-px rounded text-[11px] leading-4 tabular-nums",
          photo.selected ? "bg-[#c27b3d] text-white" : "text-[#4b5563]"
        )}
        title={photo.alt}
      >
        {photo.isCover ? <Star className="inline w-3 h-3 -mt-0.5 mr-0.5 text-amber-500" fill="currentColor" aria-label="Portada" /> : null}
        {photo.alt}
        {notForSale ? (
          <span className={cn("ml-1", photo.selected ? "text-white/80" : "text-[#b45309]")}>
            · {!photo.sellDigital && !photo.sellPrint ? "sin venta" : !photo.sellDigital ? "solo impresa" : "solo digital"}
          </span>
        ) : null}
      </span>
    </div>
  );
}
