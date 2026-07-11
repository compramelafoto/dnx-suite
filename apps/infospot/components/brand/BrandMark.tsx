import Image from "next/image";
import Link from "next/link";
import { cx } from "@/components/foundations/cx";

/**
 * Variantes oficiales Info Spot — PNG en `/public/brand/` (fuente de verdad).
 * Lockup: ancho fijo responsive + object-contain (nunca cover / nunca crop).
 * Mobile ~210px · Desktop ~270px (+50% vs baseline editorial).
 *
 * SVG en `/public/infospot-*.svg` son legacy; no usar en UI.
 */
export type BrandMarkVariant =
  | "horizontal"
  | "isotipo"
  | "positive"
  | "negative"
  | "compact";

type VariantConfig = {
  src: string;
  width: number;
  height: number;
  className: string;
};

export const BRAND_MARK_VARIANTS: Record<BrandMarkVariant, VariantConfig> = {
  horizontal: {
    src: "/brand/infospot-logo-horizontal.png",
    width: 942,
    height: 373,
    className: "h-auto w-[210px] sm:w-[228px] md:w-[252px] lg:w-[270px]",
  },
  positive: {
    src: "/brand/infospot-logo-positive.png",
    width: 942,
    height: 373,
    className: "h-auto w-[210px] sm:w-[228px] md:w-[252px] lg:w-[270px]",
  },
  isotipo: {
    src: "/brand/infospot-isotipo.png",
    width: 707,
    height: 789,
    className: "h-[3.375rem] w-auto md:h-[3.75rem]",
  },
  compact: {
    src: "/brand/infospot-isotipo.png",
    width: 707,
    height: 789,
    className: "h-12 w-auto",
  },
  negative: {
    src: "/brand/infospot-logo-negative.png",
    width: 428,
    height: 461,
    className: "h-[3.375rem] w-auto md:h-[3.75rem]",
  },
};

type Props = {
  variant?: BrandMarkVariant;
  href?: string | null;
  priority?: boolean;
  className?: string;
  imgClassName?: string;
};

export function BrandMark({
  variant = "horizontal",
  href = "/",
  priority = false,
  className,
  imgClassName,
}: Props) {
  const config = BRAND_MARK_VARIANTS[variant];
  const isLockup = variant === "horizontal" || variant === "positive";

  const img = (
    <Image
      src={config.src}
      alt="Info Spot"
      width={config.width}
      height={config.height}
      priority={priority}
      quality={95}
      unoptimized={isLockup}
      className={cx(
        "block max-w-none object-contain object-left",
        config.className,
        imgClassName,
      )}
      sizes={
        isLockup
          ? "(max-width: 640px) 210px, (max-width: 768px) 228px, 270px"
          : "60px"
      }
    />
  );

  if (href === null || href === "") {
    return (
      <span
        className={cx(
          "inline-flex shrink-0 items-center overflow-visible leading-none",
          className,
        )}
      >
        {img}
      </span>
    );
  }

  return (
    <Link
      href={href}
      className={cx(
        "inline-flex shrink-0 items-center overflow-visible leading-none focus-visible:outline-none",
        className,
      )}
      aria-label="Info Spot — inicio"
    >
      {img}
    </Link>
  );
}
