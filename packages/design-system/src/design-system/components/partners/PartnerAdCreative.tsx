import type { CSSProperties, ReactNode } from "react";
import {
  PartnerWelcomeResponsiveMedia,
  type PartnerWelcomeResponsiveMediaInput,
} from "./PartnerWelcomeResponsiveMedia";

export type PartnerAdCreativeProps = {
  imageUrl?: string | null;
  /** Snapshot responsivo (prioridad sobre imageUrl). */
  media?: PartnerWelcomeResponsiveMediaInput | null;
  href?: string | null;
  title?: string | null;
  body?: string | null;
  ctaText?: string | null;
  partnerName: string;
  /** banner | card | compact | welcome */
  variant?: "banner" | "card" | "compact" | "welcome";
  className?: string;
  rel?: string;
  /** Forzar pestaña nueva (welcome default true vía caller). */
  openInNewTab?: boolean;
  reducedMotion?: boolean;
  forceViewport?: "desktop" | "mobile" | null;
  simulateMediaError?: "desktop" | "mobile" | "both" | null;
};

/**
 * Presentación minimalista de creative publicitario (sin tracking propio).
 */
export function PartnerAdCreative({
  imageUrl,
  media,
  href,
  title,
  body,
  ctaText,
  partnerName,
  variant = "banner",
  className,
  rel = "noopener noreferrer sponsored",
  openInNewTab,
  reducedMotion = false,
  forceViewport = null,
  simulateMediaError = null,
}: PartnerAdCreativeProps) {
  const alt = title?.trim() || `Publicidad de ${partnerName}`;
  const shell: CSSProperties =
    variant === "welcome"
      ? {
          display: "flex",
          flexDirection: "column",
          gap: "1.25rem",
          alignItems: "center",
          textAlign: "center",
        }
      : variant === "card"
        ? {
            display: "flex",
            flexDirection: "column",
            gap: "0.75rem",
            maxWidth: "22rem",
          }
        : {
            display: "flex",
            flexDirection: variant === "compact" ? "row" : "column",
            gap: "0.75rem",
            alignItems: variant === "compact" ? "center" : "stretch",
            width: "100%",
          };

  const imgStyle: CSSProperties =
    variant === "welcome"
      ? { width: "100%", maxWidth: "40rem", maxHeight: "min(52vh, 28rem)", objectFit: "contain" }
      : variant === "card"
        ? { width: "100%", aspectRatio: "1 / 1", objectFit: "cover", borderRadius: "0.5rem" }
        : variant === "compact"
          ? { height: "3.5rem", width: "auto", maxWidth: "12rem", objectFit: "contain" }
          : { width: "100%", maxHeight: "7.5rem", objectFit: "contain" };

  const visual =
    variant === "welcome" ? (
      <PartnerWelcomeResponsiveMedia
        media={media}
        imageUrl={imageUrl}
        alt={alt}
        reducedMotion={reducedMotion}
        forceViewport={forceViewport}
        simulateError={simulateMediaError}
        imgStyle={imgStyle}
      />
    ) : imageUrl ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={imageUrl} alt={alt} style={imgStyle} />
    ) : (
      <span style={{ fontSize: "0.875rem", opacity: 0.8 }}>{partnerName}</span>
    );

  const inner: ReactNode = (
    <div style={shell} className={className}>
      {visual ?? <span style={{ fontSize: "0.875rem", opacity: 0.8 }}>{partnerName}</span>}
      {(title || body || ctaText) && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {title ? (
            <p style={{ margin: 0, fontWeight: 600, fontSize: "1rem" }}>{title}</p>
          ) : null}
          {body ? (
            <p style={{ margin: 0, fontSize: "0.875rem", lineHeight: 1.5, opacity: 0.85 }}>
              {body}
            </p>
          ) : null}
          {ctaText ? (
            <span
              style={{
                display: "inline-flex",
                marginTop: "0.25rem",
                fontSize: "0.875rem",
                fontWeight: 600,
                textDecoration: "underline",
              }}
            >
              {ctaText}
            </span>
          ) : null}
        </div>
      )}
    </div>
  );

  const link = href?.trim();
  if (!link) return <aside aria-label={alt}>{inner}</aside>;

  const isTracked = link.startsWith("/r/");
  const resolved =
    isTracked || link.startsWith("http") || link.startsWith("/")
      ? link
      : `https://${link}`;

  const useBlank = openInNewTab ?? (variant === "welcome" || !isTracked);

  return (
    <aside aria-label={alt}>
      <a
        href={resolved}
        target={useBlank ? "_blank" : undefined}
        rel={useBlank ? "noopener noreferrer sponsored" : rel}
        style={{ color: "inherit", textDecoration: "none", display: "block", cursor: "pointer" }}
      >
        {inner}
      </a>
    </aside>
  );
}
