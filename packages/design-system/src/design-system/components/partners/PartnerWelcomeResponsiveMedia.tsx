"use client";

import { useEffect, useState, type CSSProperties } from "react";

/** Contrato presentacional alineado a WelcomeResponsiveMediaSnapshot (@repo/partners). */
export type PartnerWelcomeMediaPiece = {
  imageUrl: string;
  mimeType?: string | null;
  width?: number | null;
  height?: number | null;
  alt: string;
  animated: boolean;
  reducedMotionFallbackUrl?: string | null;
  source?: string;
};

export type PartnerWelcomeResponsiveMediaInput = {
  imageUrl?: string | null;
  desktop?: PartnerWelcomeMediaPiece | null;
  mobile?: PartnerWelcomeMediaPiece | null;
  logoFallback?: PartnerWelcomeMediaPiece | null;
  /** Breakpoint canónico DS / Tailwind md */
  mediaMinDesktopPx?: number;
};

/**
 * Media welcome responsiva: `<picture>` + media query del breakpoint DS (768px).
 * Evita hydration mismatch (sin leer window en SSR).
 * Una sola imagen accesible.
 */
export type PartnerWelcomeResponsiveMediaProps = {
  media?: PartnerWelcomeResponsiveMediaInput | null;
  /** Compat legacy */
  imageUrl?: string | null;
  alt?: string;
  reducedMotion?: boolean;
  /** Preview: forzar viewport */
  forceViewport?: "desktop" | "mobile" | null;
  /** Preview: simular error de carga por device */
  simulateError?: "desktop" | "mobile" | "both" | null;
  className?: string;
  imgStyle?: CSSProperties;
  onVisualFailure?: () => void;
};

function pieceUrl(
  media: PartnerWelcomeResponsiveMediaInput,
  device: "desktop" | "mobile",
  reducedMotion: boolean,
  simulateError: PartnerWelcomeResponsiveMediaProps["simulateError"],
): { url: string | null; alt: string } {
  const piece = device === "desktop" ? media.desktop : media.mobile;
  const err =
    simulateError === "both" ||
    (device === "desktop" && simulateError === "desktop") ||
    (device === "mobile" && simulateError === "mobile");
  if (err) {
    if (media.logoFallback?.imageUrl) {
      return { url: media.logoFallback.imageUrl, alt: media.logoFallback.alt };
    }
    return { url: null, alt: "" };
  }
  if (!piece) {
    if (media.logoFallback?.imageUrl) {
      return { url: media.logoFallback.imageUrl, alt: media.logoFallback.alt };
    }
    if (media.imageUrl) return { url: media.imageUrl, alt: "Contenido patrocinado" };
    return { url: null, alt: "" };
  }
  if (reducedMotion && piece.animated) {
    if (piece.reducedMotionFallbackUrl) {
      return { url: piece.reducedMotionFallbackUrl, alt: piece.alt };
    }
    if (media.logoFallback?.imageUrl) {
      return { url: media.logoFallback.imageUrl, alt: media.logoFallback.alt };
    }
    return { url: null, alt: piece.alt };
  }
  return { url: piece.imageUrl, alt: piece.alt };
}

export function PartnerWelcomeResponsiveMedia({
  media,
  imageUrl,
  alt,
  reducedMotion = false,
  forceViewport = null,
  simulateError = null,
  className,
  imgStyle,
  onVisualFailure,
}: PartnerWelcomeResponsiveMediaProps) {
  const [failed, setFailed] = useState(false);
  const minDesktop = media?.mediaMinDesktopPx ?? 768;

  useEffect(() => {
    setFailed(false);
  }, [media, imageUrl, forceViewport, simulateError, reducedMotion]);

  const baseStyle: CSSProperties = {
    width: "100%",
    maxWidth: "40rem",
    maxHeight: "min(52vh, 28rem)",
    objectFit: "contain",
    objectPosition: "center",
    display: "block",
    ...imgStyle,
  };

  if (!media) {
    const url = imageUrl?.trim() || null;
    if (!url || failed) return null;
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        className={className}
        src={url}
        alt={alt?.trim() || "Contenido patrocinado"}
        style={baseStyle}
        onError={() => {
          setFailed(true);
          onVisualFailure?.();
        }}
      />
    );
  }

  const desktop = pieceUrl(media, "desktop", reducedMotion, simulateError);
  const mobile = pieceUrl(media, "mobile", reducedMotion, simulateError);

  if (forceViewport === "desktop" || forceViewport === "mobile") {
    const chosen = forceViewport === "desktop" ? desktop : mobile;
    const url = failed ? media.logoFallback?.imageUrl ?? null : chosen.url;
    if (!url) return null;
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        className={className}
        src={url}
        alt={chosen.alt || alt || "Contenido patrocinado"}
        style={baseStyle}
        onError={() => {
          setFailed(true);
          onVisualFailure?.();
        }}
      />
    );
  }

  const desktopSrc = failed ? media.logoFallback?.imageUrl ?? null : desktop.url;
  const mobileSrc = failed ? media.logoFallback?.imageUrl ?? null : mobile.url;
  const fallbackSrc =
    mobileSrc || desktopSrc || media.logoFallback?.imageUrl || media.imageUrl || null;
  if (!fallbackSrc) return null;

  const accessibleAlt =
    mobile.alt || desktop.alt || alt?.trim() || "Contenido patrocinado";

  return (
    <picture className={className}>
      {desktopSrc ? (
        <source media={`(min-width: ${minDesktop}px)`} srcSet={desktopSrc} />
      ) : null}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={mobileSrc || fallbackSrc}
        alt={accessibleAlt}
        style={baseStyle}
        onError={() => {
          setFailed(true);
          onVisualFailure?.();
        }}
      />
    </picture>
  );
}
