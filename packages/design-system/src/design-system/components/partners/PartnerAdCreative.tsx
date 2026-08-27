import type { CSSProperties, ReactNode } from "react";

export type PartnerAdCreativeProps = {
  imageUrl?: string | null;
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
};

/**
 * Presentación minimalista de creative publicitario (sin tracking propio).
 */
export function PartnerAdCreative({
  imageUrl,
  href,
  title,
  body,
  ctaText,
  partnerName,
  variant = "banner",
  className,
  rel = "noopener noreferrer sponsored",
  openInNewTab,
}: PartnerAdCreativeProps) {
  const alt = title?.trim() || `Publicidad de ${partnerName}`;
  const shell: CSSProperties =
    variant === "welcome"
      ? {
          display: "flex",
          flexDirection: "column",
          gap: "1.75rem",
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
      ? { width: "100%", maxWidth: "40rem", maxHeight: "70vh", objectFit: "contain" }
      : variant === "card"
        ? { width: "100%", aspectRatio: "1 / 1", objectFit: "cover", borderRadius: "0.5rem" }
        : variant === "compact"
          ? { height: "3.5rem", width: "auto", maxWidth: "12rem", objectFit: "contain" }
          : { width: "100%", maxHeight: "7.5rem", objectFit: "contain" };

  const isWelcome = variant === "welcome";
  const copyGap = isWelcome ? "0.75rem" : "0.5rem";
  const titleSize = isWelcome ? "1.5rem" : "1rem";
  const bodySize = isWelcome ? "1.125rem" : "0.875rem";
  const ctaSize = isWelcome ? "1.125rem" : "0.875rem";

  const inner: ReactNode = (
    <div style={shell} className={className}>
      {imageUrl ? (
        // Imagen externa de creative; next/image no aplica en DS compartido.
        <img src={imageUrl} alt={alt} style={imgStyle} />
      ) : (
        <span style={{ fontSize: isWelcome ? "1.125rem" : "0.875rem", opacity: 0.8 }}>
          {partnerName}
        </span>
      )}
      {(title || body || ctaText) && (
        <div style={{ display: "flex", flexDirection: "column", gap: copyGap }}>
          {title ? (
            <p style={{ margin: 0, fontWeight: 600, fontSize: titleSize }}>{title}</p>
          ) : null}
          {body ? (
            <p style={{ margin: 0, fontSize: bodySize, lineHeight: 1.55, opacity: 0.85 }}>
              {body}
            </p>
          ) : null}
          {ctaText ? (
            <span
              style={{
                display: "inline-flex",
                marginTop: "0.35rem",
                fontSize: ctaSize,
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
