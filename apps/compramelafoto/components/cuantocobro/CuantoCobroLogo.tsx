import Image from "next/image";
import Link from "next/link";
import { CC_LOGO_ALT, CC_LOGO_SRC } from "@/lib/cuantocobro/brand";

export type CuantoCobroLogoVariant = "header" | "hero";

export interface CuantoCobroLogoProps {
  variant?: CuantoCobroLogoVariant;
  href?: string;
  className?: string;
}

const SIZES: Record<CuantoCobroLogoVariant, { width: number; height: number; sizes: string }> = {
  header: {
    width: 168,
    height: 168,
    sizes: "(max-width: 640px) 120px, 168px",
  },
  hero: {
    width: 280,
    height: 280,
    sizes: "(max-width: 640px) 200px, 280px",
  },
};

export default function CuantoCobroLogo({
  variant = "header",
  href,
  className = "",
}: CuantoCobroLogoProps) {
  const { width, height, sizes } = SIZES[variant];
  const isHero = variant === "hero";

  const image = (
    <Image
      src={CC_LOGO_SRC}
      alt={CC_LOGO_ALT}
      width={width}
      height={height}
      className={`cc-brand-logo cc-brand-logo--${variant}${className ? ` ${className}` : ""}`}
      priority={isHero}
      sizes={sizes}
    />
  );

  if (href) {
    return (
      <Link href={href} className="cc-brand-logo__link inline-flex shrink-0" aria-label={CC_LOGO_ALT}>
        {image}
      </Link>
    );
  }

  return image;
}
