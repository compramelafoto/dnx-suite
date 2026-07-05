"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

type DnxImageSlotProps = {
  src: string;
  alt: string;
  className?: string;
  label: string;
  aspectRatio?: string;
  priority?: boolean;
  fit?: "cover" | "contain";
  objectPosition?: string;
  gallery?: Array<{ src: string; alt: string }>;
  currentIndex?: number;
};

function getFileNameFromSrc(src: string) {
  const parts = src.split("/");
  return parts[parts.length - 1] || src;
}

export default function DnxImageSlot({
  src,
  alt,
  className = "",
  label,
  aspectRatio,
  priority = false,
  fit = "contain",
  objectPosition = "center",
  gallery,
  currentIndex,
}: DnxImageSlotProps) {
  const [hasError, setHasError] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [detectedAspectRatio, setDetectedAspectRatio] = useState<string | undefined>(aspectRatio);
  const fileName = useMemo(() => getFileNameFromSrc(src), [src]);
  const galleryItems = useMemo(() => (gallery && gallery.length > 0 ? gallery : [{ src, alt }]), [gallery, src, alt]);
  const activePreviewItem = galleryItems[previewIndex] ?? { src, alt };
  const hasGalleryNavigation = galleryItems.length > 1;

  function resolveInitialPreviewIndex() {
    if (!gallery || gallery.length === 0) return 0;
    if (typeof currentIndex === "number" && currentIndex >= 0 && currentIndex < gallery.length) return currentIndex;
    const indexFromSrc = gallery.findIndex((item) => item.src === src);
    return indexFromSrc >= 0 ? indexFromSrc : 0;
  }

  function openPreview() {
    setPreviewIndex(resolveInitialPreviewIndex());
    setIsPreviewOpen(true);
  }

  function showNextImage() {
    setPreviewIndex((prev) => (prev + 1) % galleryItems.length);
  }

  function showPreviousImage() {
    setPreviewIndex((prev) => (prev - 1 + galleryItems.length) % galleryItems.length);
  }

  useEffect(() => {
    if (!isPreviewOpen) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsPreviewOpen(false);
        return;
      }
      if (event.key === "ArrowRight" && hasGalleryNavigation) {
        showNextImage();
        return;
      }
      if (event.key === "ArrowLeft" && hasGalleryNavigation) {
        showPreviousImage();
      }
    };

    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, [hasGalleryNavigation, isPreviewOpen]);

  return (
    <div
      className={`relative overflow-hidden rounded-[28px] bg-zinc-100 ${className}`}
      style={detectedAspectRatio ? { aspectRatio: detectedAspectRatio } : undefined}
    >
      {!hasError && (
        <button
          type="button"
          onClick={openPreview}
          className="absolute inset-0 cursor-zoom-in rounded-[28px]"
          aria-label={`Ver ${alt} en tamaño completo`}
        >
          <Image
            src={src}
            alt={alt}
            fill
            sizes="(max-width: 768px) 100vw, 50vw"
            className={fit === "contain" ? "rounded-[28px] object-contain" : "rounded-[28px] object-cover"}
            style={{ objectPosition }}
            priority={priority}
            onLoad={(event) => {
              const imageElement = event.currentTarget;
              if (imageElement.naturalWidth > 0 && imageElement.naturalHeight > 0) {
                setDetectedAspectRatio(`${imageElement.naturalWidth} / ${imageElement.naturalHeight}`);
              }
            }}
            onError={() => setHasError(true)}
          />
        </button>
      )}

      {hasError && (
        <div className="absolute inset-0 flex h-full w-full flex-col items-center justify-center rounded-[28px] bg-gradient-to-br from-zinc-100 via-zinc-200 to-zinc-100 p-6 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-zinc-300 bg-white text-zinc-500">
            <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true">
              <path
                d="M8 7a2 2 0 0 1 2-2h4l1.2 1.6a2 2 0 0 0 1.6.8H18a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3v-6a3 3 0 0 1 3-3h2z"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              />
              <circle
                cx="12"
                cy="13"
                r="3.25"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              />
            </svg>
          </div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">{label}</p>
          <p className="mt-2 text-sm text-zinc-700">Reemplazar por: {fileName}</p>
        </div>
      )}

      {isPreviewOpen && !hasError && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
          onClick={() => setIsPreviewOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label={`Vista ampliada: ${activePreviewItem.alt}`}
        >
          {hasGalleryNavigation && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                showPreviousImage();
              }}
              className="absolute left-4 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/55 px-4 py-3 text-2xl text-white transition hover:bg-black/75"
              aria-label="Ver foto anterior"
            >
              ‹
            </button>
          )}
          <div className="relative h-[90vh] w-full max-w-6xl overflow-hidden rounded-3xl">
            <Image src={activePreviewItem.src} alt={activePreviewItem.alt} fill className="object-contain" sizes="100vw" priority />
          </div>
          {hasGalleryNavigation && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                showNextImage();
              }}
              className="absolute right-4 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/55 px-4 py-3 text-2xl text-white transition hover:bg-black/75"
              aria-label="Ver foto siguiente"
            >
              ›
            </button>
          )}
          {hasGalleryNavigation && (
            <div className="pointer-events-none absolute bottom-5 left-1/2 -translate-x-1/2 rounded-full bg-black/55 px-3 py-1 text-xs text-white">
              {previewIndex + 1} / {galleryItems.length}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
