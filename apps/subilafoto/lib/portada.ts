/**
 * La portada de un evento: la foto de la quinceañera, de los novios, del logo de la
 * empresa.
 *
 * Es lo primero que ve el invitado cuando escanea el QR, antes del nombre del evento.
 * Hasta el 2026-10-09 el campo `coverUrl` existía en la base y lo leía la puerta, pero
 * **no había forma de cargarlo**: era una decoración que nadie podía poner.
 *
 * Cuelga de `eventos/` a propósito, al revés que el logo del fotógrafo: la portada es de
 * **este** evento y tiene que desaparecer con él a los 30 días. El logo es del vendedor y
 * sobrevive a los eventos.
 */

/** Cuatro megas. Es una foto buena, no una de fiesta sacada al vuelo. */
export const TAMANO_MAXIMO_PORTADA = 4 * 1024 * 1024;

/**
 * Sólo lo que muestra cualquier navegador tal cual.
 *
 * **Sin SVG**, a diferencia del logo: un SVG puede traer scripts, y esta imagen la ve
 * todo el salón a pantalla completa. Para una foto tampoco tiene sentido.
 *
 * **Sin HEIC**: las fotos del invitado las convertimos al moderar, y ésta no pasa por ahí.
 */
const TIPOS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export type Veredicto = { ok: boolean; motivo?: string };

export function validarPortada(archivo: { tipo: string; bytes: number }): Veredicto {
  const tipo = archivo.tipo.toLowerCase().trim();

  if (!TIPOS[tipo]) {
    return { ok: false, motivo: "La portada tiene que ser JPG, PNG o WEBP." };
  }
  if (archivo.bytes <= 0) {
    return { ok: false, motivo: "El archivo llegó vacío. Probá de nuevo." };
  }
  if (archivo.bytes > TAMANO_MAXIMO_PORTADA) {
    return { ok: false, motivo: "La portada pesa más de 4 MB. Probá con una más liviana." };
  }

  return { ok: true };
}

const saneado = (valor: string) => valor.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64) || "x";

/** La ruta dentro del bucket. Nada de lo que manda el navegador llega crudo. */
export function claveDePortada(codigoDeEvento: string, tipo: string, id: string): string {
  const extension = TIPOS[tipo.toLowerCase().trim()] ?? "bin";
  return `eventos/${saneado(codigoDeEvento)}/portada-${saneado(id)}.${extension}`;
}

/**
 * ¿Este valor es una clave nuestra o una dirección que alguien pegó?
 *
 * Anclado al principio y sin barras dobles ni `..`, por lo mismo que en el logo: sin eso,
 * `https://ajeno.com/eventos/X/portada-y.jpg` nos haría firmar una clave inexistente y
 * `eventos/../../x` apuntaría afuera.
 *
 * El prefijo `portada-` es lo que la distingue de las fotos de los invitados, que cuelgan
 * del mismo evento.
 */
export function esClaveDePortada(valor: string | null | undefined): boolean {
  if (!valor) return false;
  return /^eventos\/[a-zA-Z0-9_-]+\/portada-[a-zA-Z0-9_-]+\.[a-z]+$/.test(valor);
}
