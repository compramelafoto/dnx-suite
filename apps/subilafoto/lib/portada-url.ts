import { esClaveDePortada } from "./portada";
import { DURACION, enlaceParaMirar } from "./moderacion/vista";

/**
 * La dirección con la que se muestra la portada de un evento.
 *
 * El bucket es privado: lo que guardamos es la **clave** del archivo y hay que firmarla
 * para que el navegador la pueda pedir. Igual que el logo del fotógrafo.
 *
 * Dura lo que la proyección y no lo que el panel: esta imagen la mira el invitado en la
 * puerta durante toda la noche, no un administrador por treinta segundos.
 */
export async function urlDePortada(valor: string | null): Promise<string | null> {
  if (!valor) return null;
  if (esClaveDePortada(valor)) return enlaceParaMirar(valor, DURACION.proyeccion);
  /*
    El campo nació aceptando direcciones pegadas a mano y puede haber alguna guardada.
    Sólo `https`: una `http` en una página servida por `https` no la carga el navegador,
    y cualquier otro esquema —`javascript:`, `data:`— no tiene nada que hacer en un `src`.
  */
  return valor.startsWith("https://") ? valor : null;
}
