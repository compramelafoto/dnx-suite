/**
 * Confirmación del ensayo completo.
 *
 * Antes se pedía escribir el nombre exacto de la edición. Resultó intipeable:
 * la edición real de 2026 se llama "Clickatón  - Día del Fotógrafo Primavera
 * 2026 - 1º Edición", con dos espacios seguidos que en pantalla no se ven.
 * Nadie podía correr el ensayo.
 *
 * Una palabra fija cumple el mismo propósito —que nadie lo dispare sin querer—
 * y además se puede tipear.
 */

export const PALABRA_DE_CONFIRMACION = "ENSAYO";

export function confirmacionValida(escrito: string): boolean {
  return escrito.trim().toUpperCase() === PALABRA_DE_CONFIRMACION;
}
