"use client";

import type { CSSProperties, ReactNode } from "react";

export type PartnerLogoMarqueeItem = {
  /** Stable id for React keys (participation id). */
  id: string;
  name: string;
  logoUrl?: string | null;
  href?: string | null;
  alt?: string;
  /** rel attribute when href is set */
  rel?: string;
  /** Visual size token — bounding box only */
  size?: "lg" | "md" | "sm" | "xs";
};

export type PartnerLogoMarqueeDensity = "default" | "featured";

export type PartnerLogoMarqueeProps = {
  items: PartnerLogoMarqueeItem[];
  /** Seconds for one full loop (desktop). Mobile uses a slower variant via CSS. */
  durationSeconds?: number;
  /**
   * Slot scale. `featured` ≈ 3× original (ediciones / strips editoriales).
   * Logo always fills the slide with object-fit: contain.
   */
  density?: PartnerLogoMarqueeDensity;
  className?: string;
  trackClassName?: string;
  itemClassName?: string;
  /** Optional render override for a logo cell */
  renderItem?: (item: PartnerLogoMarqueeItem, visualIndex: number) => ReactNode;
  "aria-label"?: string;
};

/** Fixed slide slot: logo adapts inside (contain). Values are CSS length strings. */
type SlotBox = { height: string; width: string };

const SLOT_BY_DENSITY: Record<
  PartnerLogoMarqueeDensity,
  Record<NonNullable<PartnerLogoMarqueeItem["size"]>, SlotBox>
> = {
  default: {
    lg: { height: "4.5rem", width: "14rem" },
    md: { height: "4rem", width: "12.5rem" },
    sm: { height: "3.5rem", width: "11rem" },
    xs: { height: "3.25rem", width: "10rem" },
  },
  /** ~3× original heights; wider slides so wordmarks stay readable */
  featured: {
    lg: { height: "10.5rem", width: "24rem" },
    md: { height: "9rem", width: "22rem" },
    sm: { height: "7.5rem", width: "20rem" },
    xs: { height: "6.75rem", width: "18rem" },
  },
};

function slotFontSize(
  density: PartnerLogoMarqueeDensity,
  size: NonNullable<PartnerLogoMarqueeItem["size"]>,
): string {
  if (density === "featured") {
    return size === "lg" || size === "md" ? "1.5rem" : "1.25rem";
  }
  return size === "lg" || size === "md" ? "1rem" : "0.9375rem";
}

function DefaultLogoCell({
  item,
  density,
}: {
  item: PartnerLogoMarqueeItem;
  density: PartnerLogoMarqueeDensity;
}) {
  const size = item.size ?? "sm";
  const slot = SLOT_BY_DENSITY[density][size];
  const alt = item.alt ?? `Logo de ${item.name}`;
  const cellStyle: CSSProperties = {
    width: slot.width,
    height: slot.height,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  };

  const inner = item.logoUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={item.logoUrl}
      alt={alt}
      style={{
        width: "100%",
        height: "100%",
        maxWidth: "100%",
        maxHeight: "100%",
        objectFit: "contain",
        objectPosition: "center",
        display: "block",
      }}
    />
  ) : (
    <span
      style={{
        width: "100%",
        height: "100%",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: slotFontSize(density, size),
        fontWeight: 500,
        lineHeight: 1.3,
        textAlign: "center",
        opacity: 0.9,
        paddingInline: "0.5rem",
      }}
    >
      {item.name}
    </span>
  );

  const href = item.href?.trim();
  if (href) {
    const isTracked = href.startsWith("/r/");
    const resolved =
      isTracked || href.startsWith("http") || href.startsWith("/")
        ? href
        : `https://${href}`;
    return (
      <a
        href={resolved}
        target={isTracked ? undefined : "_blank"}
        rel={item.rel ?? "noopener noreferrer"}
        style={{
          ...cellStyle,
          cursor: "pointer",
          textDecoration: "none",
          color: "inherit",
        }}
      >
        {inner}
      </a>
    );
  }

  return (
    <div
      style={{
        ...cellStyle,
        cursor: "default",
      }}
      aria-label={alt}
    >
      {inner}
    </div>
  );
}

/**
 * Continuous horizontal logo marquee (CSS animation).
 * Visual array is duplicated for seamless loop; callers must reuse the same href/tracking key.
 * Honors prefers-reduced-motion (static row + optional overflow scroll).
 */
export function PartnerLogoMarquee({
  items,
  durationSeconds = 55,
  density = "default",
  className,
  trackClassName,
  itemClassName,
  renderItem,
  "aria-label": ariaLabel = "Partners",
}: PartnerLogoMarqueeProps) {
  if (items.length === 0) return null;

  const loop = [...items, ...items];
  const styleScope = "dnx-partner-marquee";
  const featured = density === "featured";

  return (
    <div
      className={[styleScope, featured ? `${styleScope}--featured` : "", className]
        .filter(Boolean)
        .join(" ")}
      role="region"
      aria-label={ariaLabel}
      data-density={density}
    >
      <style>{`
        .${styleScope} {
          position: relative;
          overflow: hidden;
          width: 100%;
          mask-image: linear-gradient(to right, transparent, #000 6%, #000 94%, transparent);
          -webkit-mask-image: linear-gradient(to right, transparent, #000 6%, #000 94%, transparent);
        }
        .${styleScope}__track {
          display: flex;
          width: max-content;
          align-items: center;
          gap: ${featured ? "4.5rem" : "3rem"};
          animation: dnx-partner-marquee-x var(--dnx-partner-marquee-duration, 55s) linear infinite;
        }
        .${styleScope}:hover .${styleScope}__track {
          animation-play-state: paused;
        }
        .${styleScope}__item {
          flex: 0 0 auto;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding-inline: ${featured ? "1rem" : "0.5rem"};
        }
        @keyframes dnx-partner-marquee-x {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        @media (max-width: 767px) {
          .${styleScope}__track {
            gap: ${featured ? "3rem" : "2.25rem"};
            animation-duration: calc(var(--dnx-partner-marquee-duration, 55s) * 1.35);
          }
          .${styleScope}--featured .${styleScope}__item {
            transform: scale(0.85);
            transform-origin: center;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .${styleScope} {
            mask-image: none;
            -webkit-mask-image: none;
            overflow-x: auto;
            -webkit-overflow-scrolling: touch;
          }
          .${styleScope}__track {
            animation: none;
            width: max-content;
            padding-inline: 0.5rem;
          }
          .${styleScope}__track .${styleScope}__item[data-loop-copy="1"] {
            display: none;
          }
        }
      `}</style>

      <div
        className={[`${styleScope}__track`, trackClassName].filter(Boolean).join(" ")}
        style={
          {
            ["--dnx-partner-marquee-duration" as string]: `${durationSeconds}s`,
          } as CSSProperties
        }
        aria-hidden={false}
      >
        {loop.map((item, index) => {
          const isCopy = index >= items.length;
          return (
            <div
              key={`${item.id}-${isCopy ? "copy" : "src"}-${index}`}
              className={[`${styleScope}__item`, itemClassName].filter(Boolean).join(" ")}
              data-loop-copy={isCopy ? "1" : "0"}
              data-partner-id={item.id}
            >
              {renderItem ? (
                renderItem(item, index)
              ) : (
                <DefaultLogoCell item={item} density={density} />
              )}
            </div>
          );
        })}
      </div>

      <ul
        style={{
          position: "absolute",
          width: 1,
          height: 1,
          padding: 0,
          margin: -1,
          overflow: "hidden",
          clip: "rect(0, 0, 0, 0)",
          whiteSpace: "nowrap",
          border: 0,
        }}
      >
        {items.map((item) => (
          <li key={`sr-${item.id}`}>{item.name}</li>
        ))}
      </ul>
    </div>
  );
}
