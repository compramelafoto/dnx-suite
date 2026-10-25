import Image from "next/image";
import Link from "next/link";

const LOGO_SRC = "/camofduty/logo.jpg";
/** El mismo logo sin el fondo negro de la foto, para apoyarlo sobre cualquier color. */
const LOGO_TRANSPARENT_SRC = "/camofduty/logo-transparente.png";
const LOGO_ALT = "Cam Of Duty — Simulador Fotográfico Interactivo";

export type CamOfDutyLogoVariant = "header" | "hero";

export interface CamOfDutyLogoProps {
  variant?: CamOfDutyLogoVariant;
  /** Si se define, el logo es un enlace (p. ej. al inicio de Cam Of Duty). */
  href?: string;
  className?: string;
  /** Sin fondo (PNG transparente) en lugar de la foto con fondo negro. */
  transparent?: boolean;
}

/**
 * Logo oficial de Cam Of Duty.
 */
export default function CamOfDutyLogo({
  variant = "header",
  href,
  className = "",
  transparent = false,
}: CamOfDutyLogoProps) {
  const isHero = variant === "hero";
  const width = isHero ? 520 : 168;
  const height = isHero ? 420 : 42;

  const image = (
    <Image
      src={transparent ? LOGO_TRANSPARENT_SRC : LOGO_SRC}
      alt={LOGO_ALT}
      width={width}
      height={height}
      className={`cod-brand-logo cod-brand-logo--${variant}${className ? ` ${className}` : ""}`}
      priority={isHero}
      sizes={isHero ? "(max-width: 640px) 88vw, 520px" : "(max-width: 640px) 140px, 168px"}
    />
  );

  if (href) {
    return (
      <Link href={href} className="cod-brand-logo__link" aria-label={LOGO_ALT}>
        {image}
      </Link>
    );
  }

  return image;
}
