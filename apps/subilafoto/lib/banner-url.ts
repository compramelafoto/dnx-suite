import { esClaveDeBanner } from "./banner";
import { DURACION, enlaceParaMirar } from "./moderacion/vista";

/**
 * La dirección con la que se muestra el banner del fotógrafo.
 *
 * El bucket es privado: lo guardado es la clave y hay que firmarla. Dura lo que la
 * proyección y no lo que el panel: el invitado mira esta pantalla durante toda la noche,
 * no un administrador por treinta segundos.
 */
export async function urlDelBanner(valor: string | null): Promise<string | null> {
  if (!valor) return null;
  if (esClaveDeBanner(valor)) return enlaceParaMirar(valor, DURACION.proyeccion);
  return valor.startsWith("https://") ? valor : null;
}
