import Image from "next/image";

/**
 * El logo de FotOffice, en sus dos formas.
 *
 * **Por qué hay dos archivos y no uno.** El logo completo —símbolo más la palabra
 * "FotOffice"— es muy ancho: en el panel lateral hay que achicarlo tanto para que entre
 * que la palabra queda ilegible. El isotipo solo (el círculo con el maletín) se lee bien
 * a cualquier tamaño. Por eso el panel lateral y el encabezado usan el isotipo, y el
 * logo completo queda para las pantallas grandes, donde hay lugar y hace falta decir el
 * nombre.
 *
 * **Los dos tienen fondo transparente**, así que funcionan sobre claro y sobre oscuro.
 * El archivo anterior (`Fotoffice.png`) decía en su comentario que era transparente y no
 * lo era: tenía un fondo gris con degradado, pesaba 2,1 MB, y encima estaba referenciado
 * en minúscula cuando el archivo tenía mayúscula — por eso no se veía en producción.
 * Ver la nota sobre mayúsculas más abajo.
 */

/** Logo completo, recortado a su tinta. 1224x372. */
const LOGO_SRC = "/fotoffice-logo.png";
const LOGO_WIDTH = 1224;
const LOGO_HEIGHT = 372;

/** Sólo el símbolo, sobre lienzo cuadrado para que no se deforme. 388x388. */
const ISOTIPO_SRC = "/fotoffice-isotipo.png";
const ISOTIPO_SIZE = 388;

/**
 * `hero` es el logo completo para pantallas de bienvenida; `compact` e `isotipo` son el
 * símbolo solo, para encabezados y para el panel lateral.
 *
 * `sidebar` se mantiene como sinónimo de `isotipo` para no romper a quien ya lo usa.
 */
export type FotofficeLogoVariant = "hero" | "compact" | "sidebar" | "isotipo";

export function FotofficeLogo({
  variant = "compact",
  className = "",
  priority = false,
}: {
  variant?: FotofficeLogoVariant;
  className?: string;
  priority?: boolean;
}) {
  const usaIsotipo = variant !== "hero";

  const size = usaIsotipo
    ? "h-10 w-10 md:h-11 md:w-11"
    : "h-[4.5rem] md:h-[5.5rem] w-auto max-w-[min(100%,22rem)]";

  const align = variant === "hero" ? "object-center mx-auto" : "object-left";

  return (
    <Image
      src={usaIsotipo ? ISOTIPO_SRC : LOGO_SRC}
      alt="FotOffice"
      width={usaIsotipo ? ISOTIPO_SIZE : LOGO_WIDTH}
      height={usaIsotipo ? ISOTIPO_SIZE : LOGO_HEIGHT}
      priority={priority}
      className={`object-contain ${align} ${size} ${className}`.trim()}
      sizes={usaIsotipo ? "44px" : "(max-width: 768px) 280px, 352px"}
    />
  );
}
