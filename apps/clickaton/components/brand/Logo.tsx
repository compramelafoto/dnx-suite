import Image from "next/image";
import { brandAssetPaths } from "@/config/brand-assets";
import { siteConfig } from "@/config/site";
import { cn } from "@/lib/cn";

/** @deprecated Prefer `brandAssetPaths` from `@/config/brand-assets`. */
export const brandAssets = {
  principal: brandAssetPaths.principal,
  vertical: brandAssetPaths.vertical,
  horizontal: brandAssetPaths.horizontal,
  horizontalMono: brandAssetPaths.horizontalMono,
  mono: brandAssetPaths.mono,
  isotipo: brandAssetPaths.isotipo,
  isotipoAmarillo: brandAssetPaths.isotipoAmarillo,
  isotipoGris: brandAssetPaths.isotipoGris,
} as const;

export type LogoVariant =
  | "horizontal"
  | "horizontalMono"
  | "vertical"
  | "principal"
  | "mono"
  | "isotipo"
  | "isotipoAmarillo"
  | "isotipoGris";

type LogoProps = {
  variant?: LogoVariant;
  /** Altura aproximada en px (ancho se adapta). */
  height?: number;
  className?: string;
  href?: string | null;
  priority?: boolean;
};

const variantMeta: Record<
  LogoVariant,
  { src: string; width: number; height: number }
> = {
  horizontal: {
    src: brandAssetPaths.horizontal,
    width: 1200,
    height: 291,
  },
  horizontalMono: {
    src: brandAssetPaths.horizontalMono,
    width: 220,
    height: 100,
  },
  vertical: {
    src: brandAssetPaths.vertical,
    width: 230,
    height: 230,
  },
  principal: {
    src: brandAssetPaths.principal,
    width: 395,
    height: 310,
  },
  mono: {
    src: brandAssetPaths.mono,
    width: 230,
    height: 230,
  },
  isotipo: {
    src: brandAssetPaths.isotipo,
    width: 130,
    height: 130,
  },
  isotipoAmarillo: {
    src: brandAssetPaths.isotipoAmarillo,
    width: 130,
    height: 130,
  },
  isotipoGris: {
    src: brandAssetPaths.isotipoGris,
    width: 130,
    height: 130,
  },
};

/**
 * Variantes oficiales del logo Clickatón (Manual de Marca).
 * No reinterpretar ni reconstruir tipográficamente el wordmark.
 */
export function Logo({
  variant = "horizontal",
  height = 40,
  className,
  href = "/",
  priority = false,
}: LogoProps) {
  const meta = variantMeta[variant];
  const scale = height / meta.height;
  const width = Math.round(meta.width * scale);
  const sizedByClass = Boolean(className && /\bh-/.test(className));

  const imageClassName = cn(
    "w-auto max-w-none object-contain bg-transparent",
    sizedByClass ? null : "h-auto",
    href === null ? className : undefined,
  );

  const imageStyle = sizedByClass ? undefined : { height, width: "auto" as const };

  if (href === null) {
    return (
      <Image
        src={meta.src}
        alt={siteConfig.nameFull}
        width={width}
        height={height}
        priority={priority}
        className={imageClassName}
        style={imageStyle}
      />
    );
  }

  return (
    <a
      href={href}
      className={cn("inline-flex items-center bg-transparent", className)}
      aria-label={`${siteConfig.name} — inicio`}
    >
      <Image
        src={meta.src}
        alt=""
        width={width}
        height={height}
        priority={priority}
        className={cn(
          "w-auto max-w-none object-contain bg-transparent",
          sizedByClass ? "h-full" : "h-auto",
        )}
        style={imageStyle}
        aria-hidden
      />
    </a>
  );
}
