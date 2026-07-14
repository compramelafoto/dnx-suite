import Image from "next/image";
import { siteConfig } from "@/config/site";
import { cn } from "@/lib/cn";

/**
 * Variantes oficiales del logo Clickatón (Manual de Marca).
 * No reinterpretar ni reconstruir tipográficamente el wordmark.
 */
export const brandAssets = {
  principal: "/brand/logo-principal.png",
  vertical: "/brand/logo-vertical.png",
  horizontal: "/brand/logo-horizontal.png",
  horizontalMono: "/brand/logo-horizontal-mono.png",
  mono: "/brand/logo-mono-negro.png",
  isotipo: "/brand/isotipo.png",
  isotipoAmarillo: "/brand/isotipo-amarillo.png",
  isotipoGris: "/brand/isotipo-gris.png",
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
  { src: string; width: number; height: number; className?: string }
> = {
  horizontal: {
    src: brandAssets.horizontal,
    width: 1200,
    height: 291,
  },
  horizontalMono: {
    src: brandAssets.horizontalMono,
    width: 220,
    height: 100,
  },
  vertical: {
    src: brandAssets.vertical,
    width: 230,
    height: 230,
  },
  principal: {
    src: brandAssets.principal,
    width: 395,
    height: 310,
  },
  mono: {
    src: brandAssets.mono,
    width: 230,
    height: 230,
  },
  isotipo: {
    src: brandAssets.isotipo,
    width: 130,
    height: 130,
  },
  isotipoAmarillo: {
    src: brandAssets.isotipoAmarillo,
    width: 130,
    height: 130,
  },
  isotipoGris: {
    src: brandAssets.isotipoGris,
    width: 130,
    height: 130,
  },
};

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
  // Si el caller pasa clases de altura (h-*), no forzar style inline.
  const sizedByClass = Boolean(className && /\bh-/.test(className));

  const imageClassName = cn(
    "w-auto max-w-none object-contain bg-transparent",
    sizedByClass ? null : "h-auto",
    href === null ? className : undefined,
  );

  const imageStyle = sizedByClass ? undefined : { height, width: "auto" as const };

  const image = (
    <Image
      src={meta.src}
      alt={href === null ? siteConfig.nameFull : ""}
      width={width}
      height={height}
      priority={priority}
      className={imageClassName}
      style={imageStyle}
      aria-hidden={href === null ? undefined : true}
    />
  );

  if (href === null) {
    return image;
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
