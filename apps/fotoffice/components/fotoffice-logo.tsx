import Image from "next/image";

/**
 * El logotipo, recortado a su contenido real.
 *
 * El asset original (`public/Fotoffice.png`, 1536×1024) tiene el logo metido adentro de un
 * lienzo enorme: el dibujo ocupa sólo del píxel 310 al 681 de alto, un 36% de la imagen. Todo
 * lo demás es transparente. Como la altura del `<img>` se aplica al lienzo y no al dibujo, un
 * logo de 56 px de alto se veía de 20: por eso parecía diminuto al lado de cualquier texto.
 *
 * `public/fotoffice-logo.png` es ese mismo archivo recortado a (138, 298)-(1374, 693). Con el
 * recorte, la altura que se pide es la que se ve, y de paso el archivo pasó de 2,1 MB a 0,7 MB.
 *
 * El nombre en minúsculas tampoco es casual: el componente pedía `/fotoffice.png` y el archivo
 * se llamaba `Fotoffice.png`. En macOS da igual —el sistema de archivos no distingue mayúsculas—
 * pero el servidor de Vercel corre sobre Linux, donde eso es un 404 y el logo no aparece.
 */
const LOGO_SRC = "/fotoffice-logo.png";
const LOGO_WIDTH = 1236;
const LOGO_HEIGHT = 395;

export type FotofficeLogoVariant = "landing" | "hero" | "compact" | "sidebar";

/**
 * Las alturas son las del dibujo, no las del lienzo.
 *
 * `compact` y `sidebar` quedan cerca de lo que ya se veía en el panel; `landing` es el grande
 * de la portada pública, donde el logo compite con un titular de 60 px y tiene que sostenerlo.
 */
const ALTURAS: Record<FotofficeLogoVariant, string> = {
  landing: "h-14 md:h-[4.5rem] w-auto max-w-[min(100%,20rem)]",
  hero: "h-12 md:h-16 w-auto max-w-[min(100%,18rem)]",
  compact: "h-8 md:h-9 w-auto max-w-[min(100%,14rem)]",
  sidebar: "h-10 md:h-11 w-auto max-w-full",
};

const TAMANOS: Record<FotofficeLogoVariant, string> = {
  landing: "(max-width: 768px) 176px, 226px",
  hero: "(max-width: 768px) 150px, 200px",
  compact: "(max-width: 768px) 100px, 113px",
  sidebar: "(max-width: 768px) 125px, 138px",
};

export function FotofficeLogo({
  variant = "compact",
  className = "",
  priority = false,
}: {
  variant?: FotofficeLogoVariant;
  className?: string;
  priority?: boolean;
}) {
  const align = variant === "sidebar" ? "object-left" : "object-center";

  return (
    <Image
      src={LOGO_SRC}
      alt="FotOffice"
      width={LOGO_WIDTH}
      height={LOGO_HEIGHT}
      priority={priority}
      className={`object-contain ${align} ${ALTURAS[variant]} ${className}`.trim()}
      sizes={TAMANOS[variant]}
    />
  );
}
