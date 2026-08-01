import Image from "next/image";
import type { ReactNode } from "react";
import { CoordinateGrid } from "@/components/brand/CoordinateGrid";
import { FocusMark } from "@/components/ui/FocusMark";
import {
  formatPhotoCredit,
  photoVariantPresets,
  type PhotoOverlayStrength,
  type PhotoVariant,
} from "@/lib/photography";
import { cn } from "@/lib/cn";

/** Clases completas en este archivo para que Tailwind las detecte. */
const variantAspectClass: Record<PhotoVariant, string> = {
  hero: "aspect-[4/5] sm:aspect-[3/4] lg:aspect-[4/5]",
  editorial: "aspect-[3/2]",
  /** Alineado a portada horizontal de edición 1920×1080 (16:9). */
  card: "aspect-video",
  gallery: "aspect-[4/3]",
  portrait: "aspect-[3/4]",
  jury: "aspect-square",
  "sponsor-feature": "aspect-[16/9]",
  background: "min-h-[18rem] sm:min-h-[22rem] w-full",
  thumbnail: "aspect-square",
};

export type PhotoFrameProps = {
  variant?: PhotoVariant;
  src?: string | null;
  /**
   * Portada vertical (9:16). En smartphone se muestra en lugar de `src`.
   * Desktop sigue usando `src` (horizontal).
   */
  srcVertical?: string | null;
  alt: string;
  width?: number;
  height?: number;
  fill?: boolean;
  priority?: boolean;
  sizes?: string;
  /** Intensidad del overlay oscuro. `true` = preset de la variante. */
  overlay?: boolean | PhotoOverlayStrength;
  caption?: string;
  credit?: string;
  eyebrow?: string;
  objectPosition?: string;
  /** Imagen puramente decorativa → alt vacío forzado. */
  decorative?: boolean;
  className?: string;
  /** Contenido sobre la imagen (zona segura). */
  children?: ReactNode;
  /**
   * Solo showroom/interno: muestra microcopy en el fallback.
   * En páginas públicas permanece silencioso (composición abstracta).
   */
  revealFallbackLabel?: boolean;
};

const overlayClass: Record<Exclude<PhotoOverlayStrength, "none">, string> = {
  soft: "ck-photo-overlay-soft",
  medium: "ck-photo-overlay-medium",
  strong: "ck-photo-overlay-strong",
};

const radiusClass = {
  none: "rounded-none",
  card: "rounded-[var(--ck-photo-radius)]",
  control: "rounded-[var(--ck-radius-control)]",
} as const;

function resolveOverlay(
  overlay: boolean | PhotoOverlayStrength | undefined,
  fallback: PhotoOverlayStrength,
): PhotoOverlayStrength {
  if (overlay === false || overlay === "none") return "none";
  if (overlay === true || overlay === undefined) return fallback;
  return overlay;
}

/**
 * Marco fotográfico del sistema V2.
 * Server Component. Sin librerías. Sin URLs remotas.
 */
export function PhotoFrame({
  variant = "editorial",
  src,
  srcVertical = null,
  alt,
  width,
  height,
  fill = true,
  priority = false,
  sizes,
  overlay,
  caption,
  credit,
  eyebrow,
  objectPosition = "center",
  decorative = false,
  className,
  children,
  revealFallbackLabel = false,
}: PhotoFrameProps) {
  const preset = photoVariantPresets[variant];
  const overlayStrength = resolveOverlay(overlay, preset.defaultOverlay);
  const resolvedAlt = decorative ? "" : alt;
  const creditLabel = credit ? formatPhotoCredit(credit) : null;
  const hasMeta = Boolean(eyebrow || caption || creditLabel || children);
  const desktopSrc = src || srcVertical || null;
  const mobileSrc = srcVertical || src || null;
  const hasArtDirection = Boolean(src && srcVertical && src !== srcVertical);
  const aspectClass = hasArtDirection
    ? variant === "card"
      ? "aspect-[3/4] md:aspect-video"
      : variant === "hero"
        ? "aspect-[9/16] max-h-[min(78vh,40rem)] md:max-h-none md:aspect-[4/5]"
        : variantAspectClass[variant]
    : variantAspectClass[variant];

  const imageClass = cn(
    "h-full w-full transition-[transform,filter] duration-[var(--ck-duration-base)] ease-[var(--ck-easing-standard)]",
    preset.objectFit === "cover" ? "object-cover" : "object-contain",
    preset.hoverScale && "group-hover:scale-[1.02]",
    fill ? "absolute inset-0" : null,
  );

  return (
    <figure
      className={cn(
        "group relative isolate w-full overflow-hidden bg-ck-surface shadow-[var(--ck-photo-shadow)]",
        aspectClass,
        radiusClass[preset.radius],
        preset.bordered && "border border-[var(--ck-photo-border)]",
        overlayStrength !== "none" && overlayClass[overlayStrength],
        className,
      )}
    >
      {desktopSrc ? (
        <>
          <Image
            src={desktopSrc}
            alt={resolvedAlt}
            fill={fill}
            {...(!fill
              ? {
                  width: width ?? 1200,
                  height: height ?? 800,
                }
              : {})}
            sizes={sizes ?? preset.defaultSizes}
            priority={priority}
            className={cn(imageClass, hasArtDirection ? "hidden md:block" : null)}
            style={{ objectPosition }}
          />
          {hasArtDirection && mobileSrc ? (
            <Image
              src={mobileSrc}
              alt={resolvedAlt}
              fill={fill}
              {...(!fill
                ? {
                    width: width ?? 1080,
                    height: height ?? 1920,
                  }
                : {})}
              sizes={sizes ?? "(max-width: 767px) 100vw, 0px"}
              priority={priority}
              className={cn(imageClass, "md:hidden")}
              style={{ objectPosition }}
            />
          ) : null}
        </>
      ) : (
        <div
          className="ck-photo-fallback absolute inset-0"
          aria-hidden={decorative || !resolvedAlt ? true : undefined}
          role={decorative || !resolvedAlt ? undefined : "img"}
          aria-label={decorative || !resolvedAlt ? undefined : resolvedAlt}
        >
          <CoordinateGrid className="opacity-[0.06]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_20%,rgb(255_196_0_/_0.06),transparent_55%)]" />
          <FocusMark
            className="absolute bottom-5 right-5 text-ck-yellow/35"
            size="sm"
          />
          {revealFallbackLabel ? (
            <span className="ck-mono absolute left-4 top-4 text-ck-text-muted">
              Media slot
            </span>
          ) : null}
        </div>
      )}

      {hasMeta ? (
        <figcaption className="pointer-events-none absolute inset-x-0 bottom-0 z-[2] space-y-1 bg-[var(--ck-photo-caption-bg)] p-4 sm:p-5">
          {eyebrow ? <p className="ck-overline text-ck-yellow">{eyebrow}</p> : null}
          {caption ? (
            <p className="ck-body-sm text-ck-text">{caption}</p>
          ) : null}
          {creditLabel ? (
            <p className="ck-caption text-ck-text-muted">{creditLabel}</p>
          ) : null}
          {children ? <div className="pointer-events-auto pt-1">{children}</div> : null}
        </figcaption>
      ) : null}
    </figure>
  );
}
