"use client";

import { useId, useState } from "react";
import { FocusMark } from "@/components/ui/FocusMark";
import { cn } from "@/lib/cn";
import type { PublicStoreImage } from "@/lib/public-store/types";

type StoreProductGalleryProps = {
  images: PublicStoreImage[];
  productName: string;
  className?: string;
};

/**
 * Galería pública de producto (cliente mínimo para selección).
 * Usa &lt;img&gt; por URLs R2 /api/media sin remotePatterns de next/image.
 */
export function StoreProductGallery({
  images,
  productName,
  className,
}: StoreProductGalleryProps) {
  const baseId = useId();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const safeIndex =
    images.length === 0 ? 0 : Math.min(selectedIndex, images.length - 1);
  const selected = images[safeIndex] ?? null;

  if (!selected) {
    return (
      <div
        className={cn(
          "flex aspect-[4/5] w-full flex-col items-center justify-center gap-3 border border-ck-border bg-ck-bg-alt text-ck-text-muted",
          className,
        )}
        role="img"
        aria-label={`Sin imagen de ${productName}`}
      >
        <FocusMark size="lg" className="text-ck-yellow/40" />
        <span className="ck-label">Imagen próximamente</span>
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      <div className="relative aspect-[4/5] w-full overflow-hidden border border-ck-border bg-ck-bg-alt">
        {/* eslint-disable-next-line @next/next/no-img-element -- deuda: next/image sin remotePatterns R2 */}
        <img
          src={selected.url}
          alt={selected.alt || productName}
          className="h-full w-full object-cover"
          decoding="async"
          // Primera imagen: eager; cambios posteriores no fuerzan prioridad.
          loading={safeIndex === 0 ? "eager" : "lazy"}
        />
      </div>

      {images.length > 1 ? (
        <ul
          className="flex flex-wrap gap-3"
          role="listbox"
          aria-label={`Miniaturas de ${productName}`}
          aria-activedescendant={`${baseId}-thumb-${safeIndex}`}
        >
          {images.map((image, index) => {
            const selectedThumb = index === safeIndex;
            return (
              <li key={image.id} role="option" aria-selected={selectedThumb}>
                <button
                  type="button"
                  id={`${baseId}-thumb-${index}`}
                  className={cn(
                    "relative block size-16 overflow-hidden border-2 bg-ck-bg-alt transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ck-yellow focus-visible:ring-offset-2 focus-visible:ring-offset-ck-bg sm:size-20",
                    selectedThumb
                      ? "border-ck-yellow"
                      : "border-ck-border hover:border-ck-yellow/50",
                  )}
                  onClick={() => setSelectedIndex(index)}
                  aria-label={`Ver imagen ${index + 1} de ${images.length}: ${image.alt || productName}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={image.url}
                    alt=""
                    className="h-full w-full object-cover"
                    loading="lazy"
                    decoding="async"
                  />
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
