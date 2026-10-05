/**
 * La dirección pública de un producto en la tienda (`/w/<negocio>/tienda/<slug>`). Módulo PURO.
 *
 * Es un compromiso público: una vez que alguien compartió el enlace, cambiarlo lo rompe. Por
 * eso se arma una sola vez a partir del nombre (al guardar la ficha por primera vez) y
 * después sólo cambia si la persona lo cambia a mano.
 */

import { STORE_RESERVED_SLUGS } from "./constants";

export const MAX_SLUG_LENGTH = 80;

/** Una dirección reservada por la tienda (ver `STORE_RESERVED_SLUGS`). */
export function isReservedSlug(slug: string): boolean {
  return STORE_RESERVED_SLUGS.includes(slug);
}

/** Lo que se usa cuando el nombre no tiene ni una letra ni un número. */
const SLUG_DE_RESPALDO = "producto";

/** Minúsculas, sin acentos, todo lo demás un guion; máximo 80 y sin guiones en las puntas. */
export function slugify(name: string): string {
  const base = name
    .normalize("NFD")
    // Las marcas diacríticas que separa NFD: "ñ" queda "n", "ú" queda "u".
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return recortar(base, MAX_SLUG_LENGTH);
}

/**
 * `remera`, y si ya existe `remera-2`, `remera-3`, … sin pasar nunca de 80. Las direcciones
 * reservadas por la tienda cuentan como tomadas: un producto "Carrito" queda en `carrito-2`.
 */
export function uniqueSlug(base: string, taken: ReadonlySet<string>): string {
  const raiz = base === "" ? SLUG_DE_RESPALDO : base;
  const ocupado = (s: string) => taken.has(s) || isReservedSlug(s);
  if (!ocupado(raiz)) return raiz;
  for (let n = 2; ; n++) {
    const sufijo = `-${n}`;
    const candidato = `${recortar(raiz, MAX_SLUG_LENGTH - sufijo.length)}${sufijo}`;
    if (!ocupado(candidato)) return candidato;
  }
}

function recortar(slug: string, max: number): string {
  return slug.slice(0, max).replace(/-+$/, "");
}
