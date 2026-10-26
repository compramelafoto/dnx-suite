"use client";

import { useEffect, useRef, useState } from "react";
import { ImageUploadField } from "@/components/image-upload-field";
import { GALLERY_MAX_PHOTOS, type GalleryPhoto } from "@/lib/website/blocks";

function newPhotoId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `ph_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

/** Mueve el elemento `from` a la posición `to` sin mutar la lista. */
function reorder<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return list;
  const next = [...list];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

/**
 * Fotos de la galería: se suben de a una con el mismo campo de subida del resto del sitio (al
 * terminar queda vacío para sumar la siguiente), se ordenan arrastrando o con las flechas, y
 * cada una lleva su texto alternativo. Controlado: cada cambio llama a `onChange` con la lista.
 */
export function GalleryPhotosEditor({ photos, onChange }: { photos: GalleryPhoto[]; onChange: (photos: GalleryPhoto[]) => void }) {
  // La subida es asíncrona: la lista vigente se lee de una ref para no sumar sobre una copia vieja.
  const latest = useRef(photos);
  useEffect(() => {
    latest.current = photos;
  }, [photos]);
  const [uploaderKey, setUploaderKey] = useState(0);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const full = photos.length >= GALLERY_MAX_PHOTOS;

  return (
    <div className="space-y-3">
      {full ? (
        <p className="text-xs text-[var(--fo-muted)]">Llegaste al máximo de {GALLERY_MAX_PHOTOS} fotos.</p>
      ) : (
        <ImageUploadField
          key={uploaderKey}
          name="_gallery_photo"
          presetKey="websiteBlockImage"
          label="Agregar foto"
          onUploaded={(url) => {
            if (!url) return;
            onChange([...latest.current, { id: newPhotoId(), url }]);
            setUploaderKey((k) => k + 1);
          }}
        />
      )}
      {photos.length > 0 ? (
        <ul className="space-y-2">
          {photos.map((photo, i) => (
            <li
              key={photo.id}
              draggable
              onDragStart={() => setDragIndex(i)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (dragIndex !== null) onChange(reorder(photos, dragIndex, i));
                setDragIndex(null);
              }}
              onDragEnd={() => setDragIndex(null)}
              className={`flex items-center gap-2 rounded-lg border border-[var(--fo-border)] p-2 ${dragIndex === i ? "opacity-50" : ""}`}
            >
              <span aria-hidden className="cursor-grab select-none text-[var(--fo-muted)]">
                ⠿
              </span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo.url} alt="" className="h-12 w-12 shrink-0 rounded object-cover" />
              <input
                className="fo-input min-w-0 flex-1"
                placeholder="Texto alternativo"
                aria-label={`Texto alternativo de la foto ${i + 1}`}
                value={photo.alt ?? ""}
                onChange={(e) => onChange(photos.map((p) => (p.id === photo.id ? { ...p, alt: e.target.value } : p)))}
              />
              <button type="button" className="px-1 disabled:opacity-30" aria-label="Subir foto" disabled={i === 0} onClick={() => onChange(reorder(photos, i, i - 1))}>
                ↑
              </button>
              <button
                type="button"
                className="px-1 disabled:opacity-30"
                aria-label="Bajar foto"
                disabled={i === photos.length - 1}
                onClick={() => onChange(reorder(photos, i, i + 1))}
              >
                ↓
              </button>
              <button type="button" className="px-1 text-red-600" aria-label="Quitar foto" onClick={() => onChange(photos.filter((p) => p.id !== photo.id))}>
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-[var(--fo-muted)]">Todavía no hay fotos. La sección no aparece en el sitio hasta que subas alguna.</p>
      )}
    </div>
  );
}
