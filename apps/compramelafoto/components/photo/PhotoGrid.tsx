"use client";

import PhotoCard from "./PhotoCard";

interface Photo {
  id: string;
  src: string;
  alt: string;
  selected?: boolean;
  isCover?: boolean;
  canDelete?: boolean;
  statusBadge?: string | null;
  sellDigital?: boolean;
  sellPrint?: boolean;
}

interface PhotoGridProps {
  photos: Photo[];
  onPhotoSelect?: (id: string) => void;
  onPhotoRemove?: (id: string) => void;
  onPhotoSetCover?: (id: string) => void;
  onPhotoRequestRemoval?: (id: string) => void;
  onPhotoOpenSlide?: (id: string) => void;
  onPhotoSellOptionChange?: (photoId: string, field: "sellDigital" | "sellPrint", value: boolean) => void;
  noDrag?: boolean;
}

export default function PhotoGrid({ photos, onPhotoSelect, onPhotoRemove, onPhotoSetCover, onPhotoRequestRemoval, onPhotoOpenSlide, onPhotoSellOptionChange, noDrag }: PhotoGridProps) {
  if (photos.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-[#6b7280]">No hay fotos seleccionadas</p>
      </div>
    );
  }

  return (
    <div
      className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6 select-none album-photo-container"
      data-protected="true"
      onContextMenu={noDrag ? (e) => e.preventDefault() : undefined}
      onDragOver={noDrag ? (e) => e.preventDefault() : undefined}
      onDrop={noDrag ? (e) => e.preventDefault() : undefined}
    >
      {photos.map((photo) => (
        <PhotoCard
          key={photo.id}
          src={photo.src}
          alt={photo.alt}
          selected={photo.selected}
          isCover={photo.isCover}
          statusBadge={photo.statusBadge}
          sellDigital={photo.sellDigital}
          sellPrint={photo.sellPrint}
          onSelect={() => onPhotoSelect?.(photo.id)}
          onRemove={photo.canDelete !== false && onPhotoRemove ? () => onPhotoRemove(photo.id) : undefined}
          onSetCover={onPhotoSetCover ? () => onPhotoSetCover(photo.id) : undefined}
          onRequestRemoval={onPhotoRequestRemoval ? () => onPhotoRequestRemoval(photo.id) : undefined}
          onOpenSlide={onPhotoOpenSlide ? () => onPhotoOpenSlide(photo.id) : undefined}
          onSellDigitalChange={onPhotoSellOptionChange ? (v) => onPhotoSellOptionChange(photo.id, "sellDigital", v) : undefined}
          onSellPrintChange={onPhotoSellOptionChange ? (v) => onPhotoSellOptionChange(photo.id, "sellPrint", v) : undefined}
          noDrag={noDrag}
        />
      ))}
    </div>
  );
}
