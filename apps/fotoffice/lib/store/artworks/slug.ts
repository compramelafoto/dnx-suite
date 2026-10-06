/** Dirección pública de una obra. Módulo PURO. */

import { slugify, uniqueSlug } from "../slug";

/** Del título; si no tiene letras ni números, `obra-<número de obra>`. Única contra `taken` y las reservadas. */
export function artworkSlug(title: string, entryNumber: string, taken: ReadonlySet<string>): string {
  const base = slugify(title) || slugify(`obra-${entryNumber}`) || "obra";
  return uniqueSlug(base, taken);
}
