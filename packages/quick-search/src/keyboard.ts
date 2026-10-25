/**
 * La selección se mueve con las flechas y se frena en los extremos.
 *
 * No da la vuelta a propósito: en una lista corta, saltar del último al primero se siente como
 * un error, no como una comodidad.
 */
export function moveSelection(actual: number, total: number, direccion: 1 | -1): number {
  if (total <= 0) return 0;
  const siguiente = actual + direccion;
  if (siguiente < 0) return 0;
  if (siguiente > total - 1) return total - 1;
  return siguiente;
}

/** Los elementos donde alguien está escribiendo y el atajo no tiene que robarle la tecla. */
const CAMPOS_DE_TEXTO = new Set(["INPUT", "TEXTAREA", "SELECT"]);

/**
 * Si el atajo global tiene que quedarse quieto.
 *
 * Alguien tipeando el nombre de un socio no quiere que se le abra un buscador encima. Recibe el
 * nombre de la etiqueta en vez del elemento para poder probarse sin navegador.
 */
export function shouldIgnoreShortcut(
  tagName: string | undefined,
  isContentEditable = false,
): boolean {
  if (isContentEditable) return true;
  if (!tagName) return false;
  return CAMPOS_DE_TEXTO.has(tagName.toUpperCase());
}
