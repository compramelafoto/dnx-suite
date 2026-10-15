import { PORTFOLIO_MAX_PHOTOS } from "./constants";

/**
 * El tope, del lado del servidor.
 *
 * El contador de la pantalla es una cortesía; esto es la regla. Un tope que sólo vive en el botón
 * no es un tope: la ruta de subida se puede llamar sin pasar por la pantalla.
 */
export function canAcceptAnotherPhoto(
  photoCount: number,
): { ok: true } | { ok: false; error: string } {
  if (photoCount >= PORTFOLIO_MAX_PHOTOS) {
    return {
      ok: false,
      error: `Llegaste al máximo de ${PORTFOLIO_MAX_PHOTOS} fotos. Borrá alguna para subir otra.`,
    };
  }
  return { ok: true };
}
