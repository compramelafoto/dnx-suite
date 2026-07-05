"use client";

import { useState } from "react";
import Image from "next/image";
import type { TemplateCoverFallback } from "@/lib/catalog-templates/template-covers";
import { isLocalCatalogTemplateAsset } from "@/lib/catalog-templates/template-covers";

type CatalogTemplateCoverProps = {
  coverUrl: string | null;
  fallback: TemplateCoverFallback;
  alt: string;
  priority?: boolean;
  className?: string;
};

export default function CatalogTemplateCover({
  coverUrl,
  fallback,
  alt,
  priority = false,
  className = "",
}: CatalogTemplateCoverProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  const showFallback = !coverUrl || imageError;
  const showImage = coverUrl && !imageError;

  return (
    <div
      className={`relative ds-catalog-cover-frame aspect-square w-full min-w-0 overflow-hidden bg-[#f3f4f6] ${className}`}
    >
      {/* Fallback base — siempre presente para evitar CLS */}
      <div
        className={`absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br ${fallback.gradient} transition-opacity duration-300 ${
          showImage && imageLoaded ? "opacity-0" : "opacity-100"
        }`}
        aria-hidden={showImage && imageLoaded ? true : undefined}
      >
        <span className="text-3xl sm:text-4xl text-[#9ca3af]/80 font-light leading-none mb-3">
          {fallback.icon}
        </span>
        <span className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#374151]/70">
          {fallback.initials}
        </span>
        <span className="mt-2 text-xs font-medium uppercase tracking-wider text-[#6b7280]/80">
          {fallback.categoryLabel}
        </span>
      </div>

      {showImage ? (
        <>
          {!imageLoaded ? (
            <div className="absolute inset-0 animate-pulse bg-[#e5e7eb]" aria-hidden />
          ) : null}
          {isLocalCatalogTemplateAsset(coverUrl) ? (
            <Image
              src={coverUrl}
              alt={alt}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              className={`object-cover transition-opacity duration-300 ${
                imageLoaded ? "opacity-100" : "opacity-0"
              }`}
              priority={priority}
              onLoad={() => setImageLoaded(true)}
              onError={() => setImageError(true)}
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={coverUrl}
              alt={alt}
              loading={priority ? "eager" : "lazy"}
              decoding="async"
              className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${
                imageLoaded ? "opacity-100" : "opacity-0"
              }`}
              onLoad={() => setImageLoaded(true)}
              onError={() => setImageError(true)}
            />
          )}
        </>
      ) : null}
    </div>
  );
}
