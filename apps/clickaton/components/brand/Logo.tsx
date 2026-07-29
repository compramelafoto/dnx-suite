import Image from "next/image";
import { brandAssetPaths } from "@/config/brand-assets";
import { siteConfig } from "@/config/site";
import { cn } from "@/lib/cn";

/** @deprecated Prefer `brandAssetPaths` from `@/config/brand-assets`. */
export const brandAssets = {
  principal: brandAssetPaths.principal,
  vertical: brandAssetPaths.vertical,
  horizontal: brandAssetPaths.horizontal,
  horizontalWeb: brandAssetPaths.horizontalWeb,
  horizontalMono: brandAssetPaths.horizontalMono,
  mono: brandAssetPaths.mono,
  isotipo: brandAssetPaths.isotipo,
  isotipoAmarillo: brandAssetPaths.isotipoAmarillo,
  isotipoGris: brandAssetPaths.isotipoGris,
} as const;

export type LogoVariant =
  | "horizontal"
  | "horizontalWeb"
  | "horizontalMono"
  | "vertical"
  | "principal"
  | "mono"
  | "isotipo"
  | "isotipoAmarillo"
  | "isotipoGris";

type LogoProps = {
  variant?: LogoVariant;
  /** Altura de visualización aproximada en px (ancho se adapta). */
  height?: number;
  className?: string;
  href?: string | null;
  priority?: boolean;
};

/** Dimensiones intrínsecas del archivo fuente (no el tamaño en pantalla). */
const variantMeta: Record<
  LogoVariant,
  { src: string; width: number; height: number }
> = {
  horizontal: {
    src: brandAssetPaths.horizontal,
    width: 850,
    height: 228,
  },
  horizontalWeb: {
    src: brandAssetPaths.horizontalWeb,
    width: 850,
    height: 228,
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
    width: 1024,
    height: 485,
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
 * Se sirve el PNG original sin optimizador Next (`unoptimized`) para evitar
 * pixelado en tipografía e isotipo — especialmente en pantallas retina.
 */
export function Logo({
  variant = "principal",
  height = 40,
  className,
  href = "/",
  priority = false,
}: LogoProps) {
  const meta = variantMeta[variant];
  const displayWidth = Math.round((meta.width / meta.height) * height);
  const sizedByClass = Boolean(className && /\bh-/.test(className));

  const image = (
    <Image
      src={meta.src}
      alt={href === null ? siteConfig.nameFull : ""}
      width={meta.width}
      height={meta.height}
      priority={priority}
      unoptimized
      sizes={`${displayWidth}px`}
      className={cn(
        "w-auto max-w-none object-contain bg-transparent",
        sizedByClass ? (href === null ? className : "h-full") : "h-auto",
        href === null && !sizedByClass ? className : undefined,
      )}
      style={sizedByClass ? undefined : { height, width: "auto" }}
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
      {image}
    </a>
  );
}
