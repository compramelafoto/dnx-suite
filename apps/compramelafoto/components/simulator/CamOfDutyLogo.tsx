import Image from "next/image";
import Link from "next/link";

const LOGO_SRC = "/camofduty/logo.jpg";
const LOGO_ALT = "Cam Of Duty — Simulador Fotográfico Interactivo";

export type CamOfDutyLogoVariant = "header" | "hero";

export interface CamOfDutyLogoProps {
  variant?: CamOfDutyLogoVariant;
  /** Si se define, el logo es un enlace (p. ej. al inicio de Cam Of Duty). */
  href?: string;
  className?: string;
}

/**
 * Logo oficial de Cam Of Duty.
 */
export default function CamOfDutyLogo({
  variant = "header",
  href,
  className = "",
}: CamOfDutyLogoProps) {
  const isHero = variant === "hero";
  const width = isHero ? 520 : 168;
  const height = isHero ? 420 : 42;

  const image = (
    <Image
      src={LOGO_SRC}
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
