/**
 * Qué pidió quien dispara la corrida respecto de la lectura de texto.
 *
 * `true` la fuerza, `false` la apaga y `null` —lo normal— deja que decida el tipo de
 * álbum, en `should-run-ocr`.
 *
 * Antes esto devolvía un booleano y por defecto era **sí** siempre que hubiera un
 * proveedor configurado. Como el cron además pasaba `?ocr=1`, el resultado era que se
 * leía el texto de todas las fotos de la plataforma: la mitad de la factura de Amazon.
 */
export function resolveOcrRequestedFromRequest(url: URL): boolean | null {
  const param = url.searchParams.get("ocr");
  if (param === "0" || param === "false") return false;
  if (param === "1" || param === "true") return true;
  return null;
}
