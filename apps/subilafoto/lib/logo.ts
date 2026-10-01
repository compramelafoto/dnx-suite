/**
 * El logo del fotógrafo.
 *
 * Es la pieza central de la marca blanca: aparece en su vitrina, en la puerta del evento y
 * en la ficha que completan sus proveedores. Hasta ahora había que pegar una dirección, lo
 * que obligaba a tener el archivo publicado en otro lado.
 *
 * Se guarda en el mismo bucket que las fotos pero **fuera de `eventos/`**, porque no es de
 * ningún evento: es del vendedor, y no lo alcanza el borrado a los 30 días.
 */

/** Dos megas. Es un logo, no una foto de fiesta. */
export const TAMANO_MAXIMO_LOGO = 2 * 1024 * 1024;

/**
 * Sólo lo que muestra cualquier navegador **tal cual**.
 *
 * A diferencia de las fotos de los invitados, acá no se acepta HEIC: esas las convertimos
 * al moderar, y un logo se sirve como llegó.
 */
const TIPOS: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
  "image/svg+xml": "svg",
};

export type Veredicto = { ok: boolean; motivo?: string };

export function validarLogo(archivo: { tipo: string; bytes: number }): Veredicto {
  const tipo = archivo.tipo.toLowerCase().trim();

  if (!TIPOS[tipo]) {
    return { ok: false, motivo: "El logo tiene que ser PNG, JPG, WEBP o SVG." };
  }
  if (archivo.bytes <= 0) {
    return { ok: false, motivo: "El archivo llegó vacío. Probá de nuevo." };
  }
  if (archivo.bytes > TAMANO_MAXIMO_LOGO) {
    return { ok: false, motivo: "El logo pesa más de 2 MB. Probá con uno más liviano." };
  }

  return { ok: true };
}

const saneado = (valor: string) => valor.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64) || "x";

/**
 * La ruta dentro del bucket.
 *
 * La extensión sale del tipo declarado y el resto se sanea: nada de lo que manda el
 * navegador llega crudo a una ruta.
 */
export function claveDeLogo(perfilId: string, tipo: string, id: string): string {
  const extension = TIPOS[tipo.toLowerCase().trim()] ?? "bin";
  return `logos/${saneado(perfilId)}/${saneado(id)}.${extension}`;
}

/**
 * ¿Este valor es una clave nuestra o una dirección que alguien pegó?
 *
 * El campo guarda las dos cosas, así que hay que poder distinguirlas. La comprobación es
 * **al principio de la cadena y sin barras dobles**: sin eso, guardar
 * `https://x.com/logos/y.png` nos haría firmar una clave que no existe, y `../logos/y`
 * apuntaría afuera.
 */
export function esClaveDeLogo(valor: string | null | undefined): boolean {
  if (!valor) return false;
  return /^logos\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+\.[a-z]+$/.test(valor);
}
