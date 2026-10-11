/**
 * El banner de publicidad del fotógrafo, al pie de la pantalla del invitado.
 *
 * Es del **vendedor** y no del evento: lo pone una vez y aparece en todas sus fiestas.
 * Junto con el logo de arriba, es la publicidad que le paga el servicio: cada invitado
 * que escanea el QR es alguien que podría contratarlo.
 */

/** Dos megas. Es una tira al pie, no una foto de fiesta. */
export const TAMANO_MAXIMO_BANNER = 2 * 1024 * 1024;

const TIPOS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export type Veredicto = { ok: boolean; motivo?: string };

/**
 * La medida que conviene, para decírsela al fotógrafo.
 *
 * El banner se dibuja al ancho de la columna del invitado, que son 384 px de CSS. En un
 * teléfono moderno eso son 2 o 3 píxeles reales por cada uno de CSS, así que **1200 px de
 * ancho** es lo que hace falta para que no se vea borroso. Más que eso es peso de más
 * cargando en el wifi de un salón.
 *
 * 4:1 porque va al pie: es una franja, no un afiche. Más alto le come la pantalla a lo
 * que el invitado vino a hacer, que es subir una foto.
 */
export const MEDIDA_SUGERIDA_BANNER = { ancho: 1200, alto: 300 } as const;

export function validarBanner(archivo: { tipo: string; bytes: number }): Veredicto {
  const tipo = archivo.tipo.toLowerCase().trim();

  if (!TIPOS[tipo]) return { ok: false, motivo: "El banner tiene que ser JPG, PNG o WEBP." };
  if (archivo.bytes <= 0) return { ok: false, motivo: "El archivo llegó vacío." };
  if (archivo.bytes > TAMANO_MAXIMO_BANNER) {
    return { ok: false, motivo: "El banner pesa más de 2 MB. Probá con uno más liviano." };
  }

  return { ok: true };
}

const saneado = (valor: string) => valor.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64) || "x";

/** Fuera de `eventos/`: es del vendedor y no lo alcanza el borrado a los 30 días. */
export function claveDeBanner(perfilId: string, tipo: string, id: string): string {
  const extension = TIPOS[tipo.toLowerCase().trim()] ?? "bin";
  return `banners/${saneado(perfilId)}/${saneado(id)}.${extension}`;
}

export function esClaveDeBanner(valor: string | null | undefined): boolean {
  if (!valor) return false;
  return /^banners\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+\.[a-z]+$/.test(valor);
}

/**
 * A dónde puede llevar el banner al tocarlo.
 *
 * **Sólo `https`.** Esto termina en el `href` de un enlace que tocan los invitados:
 *
 * - Un `javascript:` ahí es código ejecutándose en el teléfono de cada persona de la
 *   fiesta. No hay versión de esto que sea aceptable.
 * - Un `data:` puede traer una página entera disfrazada de enlace.
 * - Un `http` a secas lo bloquea el navegador o avisa que el sitio no es seguro, justo
 *   arriba del banner del fotógrafo.
 *
 * Sin enlace también vale: el banner puede ser sólo una imagen.
 */
export function enlaceDeBannerValido(valor: string | null | undefined): string | null {
  const limpio = (valor ?? "").trim();
  if (!limpio) return null;

  try {
    // `new URL` resuelve el esquema de verdad, en vez de confiar en cómo empieza el texto.
    const url = new URL(limpio);
    return url.protocol === "https:" ? limpio : null;
  } catch {
    return null;
  }
}
