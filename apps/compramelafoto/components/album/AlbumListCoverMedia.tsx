"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

type Props = {
  title: string;
  coverPhotoUrl: string | null | undefined;
  /** Si la primaria falla (p. ej. R2), intentar esta URL (`mode=cover` sin marca). */
  coverPhotoUrlFallback?: string | null;
  photosCount: number;
  /** Variante con logo watermark (listados públicos). */
  variant?: "watermark" | "minimal";
  className?: string;
  imageClassName?: string;
  comingSoonClassName?: string;
};

export default function AlbumListCoverMedia({
  title,
  coverPhotoUrl,
  coverPhotoUrlFallback = null,
  photosCount,
  variant = "watermark",
  className = "w-full h-full",
  imageClassName = "object-cover",
  comingSoonClassName = "w-full h-full flex flex-col items-center justify-center p-4 bg-[#f3f4f6]",
}: Props) {
  const [src, setSrc] = useState(coverPhotoUrl ?? null);
  const [triedFallback, setTriedFallback] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    setSrc(coverPhotoUrl ?? null);
    setTriedFallback(false);
    setLoadFailed(false);
  }, [coverPhotoUrl, coverPhotoUrlFallback]);

  function handleImageError() {
    if (coverPhotoUrlFallback && !triedFallback) {
      setTriedFallback(true);
      setSrc(coverPhotoUrlFallback);
      setLoadFailed(false);
      return;
    }
    setLoadFailed(true);
  }

  // Con portada propia (subida por el fotógrafo) se muestra la imagen aunque el
  // álbum todavía no tenga fotos; el aviso pasa a ser una franja sobre la portada.
  const hasImage = Boolean(src) && !loadFailed;
  const pendingPhotos = photosCount <= 0;

  if (hasImage) {
    return (
      <div className={`relative ${className}`}>
        <Image
          src={src as string}
          alt={title}
          fill
          className={imageClassName}
          sizes="(max-width: 768px) 100vw, 33vw"
          onError={handleImageError}
        />
        {pendingPhotos ? (
          <span className="absolute inset-x-0 bottom-0 bg-black/55 px-2 py-1 text-center text-[11px] leading-tight text-white">
            Fotos próximamente
          </span>
        ) : null}
      </div>
    );
  }

  if (pendingPhotos) {
    return (
      <div className={comingSoonClassName}>
        {variant === "watermark" ? (
          <>
            <Image src="/watermark.png" alt="ComprameLaFoto" width={80} height={80} className="opacity-50" />
            <p className="text-xs text-[#6b7280] mt-2 text-center">Las fotos serán subidas próximamente</p>
          </>
        ) : (
          <p className="text-xs text-[#6b7280] text-center leading-tight">Las fotos serán subidas próximamente</p>
        )}
      </div>
    );
  }

  return (
    <div className={`flex items-center justify-center bg-[#f3f4f6] ${className}`}>
      <span className="text-xs text-[#9ca3af]">Sin vista previa</span>
    </div>
  );
}
