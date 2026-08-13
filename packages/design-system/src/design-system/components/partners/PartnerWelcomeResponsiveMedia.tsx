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
 * Media welcome responsiva: `<picture>` + media query del breakpoint DS (768px)
 * y `prefers-reduced-motion` para GIFs (sin leer window en SSR).
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

function pieceSources(
  media: PartnerWelcomeResponsiveMediaInput,
  device: "desktop" | "mobile",
  simulateError: PartnerWelcomeResponsiveMediaProps["simulateError"],
): { primary: string | null; reduced: string | null; alt: string } {
  const piece = device === "desktop" ? media.desktop : media.mobile;
  const err =
    simulateError === "both" ||
    (device === "desktop" && simulateError === "desktop") ||
    (device === "mobile" && simulateError === "mobile");
  const logo = media.logoFallback?.imageUrl
    ? { url: media.logoFallback.imageUrl, alt: media.logoFallback.alt }
    : null;
  if (err) {
    return { primary: logo?.url ?? null, reduced: logo?.url ?? null, alt: logo?.alt ?? "" };
  }
  if (!piece) {
    if (logo) return { primary: logo.url, reduced: logo.url, alt: logo.alt };
    if (media.imageUrl) {
      return { primary: media.imageUrl, reduced: media.imageUrl, alt: "Contenido patrocinado" };
    }
    return { primary: null, reduced: null, alt: "" };
  }
  const reduced =
    piece.animated
      ? piece.reducedMotionFallbackUrl || logo?.url || null
      : piece.imageUrl;
  return { primary: piece.imageUrl, reduced, alt: piece.alt };
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

  const desktop = pieceSources(media, "desktop", simulateError);
  const mobile = pieceSources(media, "mobile", simulateError);

  const pick = (chosen: { primary: string | null; reduced: string | null; alt: string }) =>
    reducedMotion ? chosen.reduced || chosen.primary : chosen.primary;

  if (forceViewport === "desktop" || forceViewport === "mobile") {
    const chosen = forceViewport === "desktop" ? desktop : mobile;
    const url = failed ? media.logoFallback?.imageUrl ?? null : pick(chosen);
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

  if (failed) {
    const logoUrl = media.logoFallback?.imageUrl ?? null;
    if (!logoUrl) return null;
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        className={className}
        src={logoUrl}
        alt={media.logoFallback?.alt || alt || "Contenido patrocinado"}
        style={baseStyle}
        onError={() => {
          onVisualFailure?.();
        }}
      />
    );
  }

  const desktopPrimary = reducedMotion ? desktop.reduced || desktop.primary : desktop.primary;
  const mobilePrimary = reducedMotion ? mobile.reduced || mobile.primary : mobile.primary;
  const fallbackSrc =
    mobilePrimary || desktopPrimary || media.logoFallback?.imageUrl || media.imageUrl || null;
  if (!fallbackSrc) return null;

  const accessibleAlt =
    mobile.alt || desktop.alt || alt?.trim() || "Contenido patrocinado";

  const desktopRm =
    !reducedMotion && desktop.reduced && desktop.reduced !== desktop.primary ? desktop.reduced : null;
  const mobileRm =
    !reducedMotion && mobile.reduced && mobile.reduced !== mobile.primary ? mobile.reduced : null;

  return (
    <picture className={className}>
      {desktopRm ? (
        <source
          media={`(prefers-reduced-motion: reduce) and (min-width: ${minDesktop}px)`}
          srcSet={desktopRm}
        />
      ) : null}
      {mobileRm ? (
        <source media="(prefers-reduced-motion: reduce)" srcSet={mobileRm} />
      ) : null}
      {desktopPrimary ? (
        <source media={`(min-width: ${minDesktop}px)`} srcSet={desktopPrimary} />
      ) : null}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={mobilePrimary || fallbackSrc}
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
