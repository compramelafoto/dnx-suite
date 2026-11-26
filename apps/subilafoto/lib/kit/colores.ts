import { contraste } from "@/lib/contraste";

/**
 * Los colores de las placas y el folleto, a partir del color del fotógrafo.
 *
 * El fondo es su color, porque la pieza es suya. Lo que se calcula es la tinta: blanca o
 * casi negra, la que más contraste haga. Un fotógrafo con un amarillo pastel de marca no
 * puede terminar con letras blancas ilegibles en su historia de Instagram.
 */

export const PURPURA = "#200638";
export const AMARILLO = "#FFD51F";
const BLANCO = "#FFFFFF";
// Negro puro y no un púrpura muy oscuro: con cualquier otro, hay colores medios donde ni
// el blanco ni el negro llegan a 4,5:1.
const NEGRO = "#000000";

export type Paleta = {
  fondo: string;
  tinta: string;
  /** Para el precio y los números: tiene que leerse sobre el fondo. */
  acento: string;
};

function esHex(valor: string | null | undefined): valor is string {
  return Boolean(valor && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(valor.trim()));
}

export function paletaDelVendedor(color: string | null | undefined): Paleta {
  const fondo = esHex(color) ? color.trim() : PURPURA;
  const tinta = contraste(fondo, BLANCO) >= contraste(fondo, NEGRO) ? BLANCO : NEGRO;
  // El amarillo de la marca sólo si se lee; si no, el acento es la misma tinta.
  const acento = contraste(fondo, AMARILLO) >= 4.5 ? AMARILLO : tinta;
  return { fondo, tinta, acento };
}
