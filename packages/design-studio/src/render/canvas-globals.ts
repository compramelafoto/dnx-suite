/**
 * Las piezas de navegador que `pdfjs` da por sentadas al rasterizar.
 *
 * `pdfjs` está escrito para el navegador y usa `DOMMatrix` sin comprobar que exista. En Node
 * no existe: la trae `@napi-rs/canvas`, pero sólo como exportación del módulo, no como
 * variable global.
 *
 * Se define **únicamente** `DOMMatrix`. Publicar además `Path2D` o `ImageData` hace que
 * `pdfjs` tome caminos de dibujo que le pasan esos objetos al módulo nativo, que espera los
 * suyos y falla con "Value is non of these types". Menos es más acá.
 *
 * El detalle que lo vuelve traicionero es que sólo algunos caminos de dibujo las usan —los que
 * aplican transformaciones o máscaras—, así que una pieza se convierte sin problema y otra
 * muere con "DOMMatrix is not defined". Eso hace que el fallo aparezca en producción, con
 * material real, y no en la máquina donde se escribió el código.
 */

let preparado: Promise<void> | null = null;

async function definirGlobales(): Promise<void> {
  const canvas = (await import("@napi-rs/canvas")) as unknown as Record<string, unknown>;
  const bag = globalThis as Record<string, unknown>;

  // Nunca se pisa lo que el entorno ya provea: si mañana Node la trae de fábrica, la suya va a
  // estar mejor integrada que la del módulo nativo.
  if (bag.DOMMatrix === undefined && typeof canvas.DOMMatrix === "function") {
    bag.DOMMatrix = canvas.DOMMatrix;
  }
}

/**
 * Idempotente y perezosa: se resuelve una sola vez por proceso y no carga el módulo nativo
 * hasta que alguien va a rasterizar de verdad.
 */
export function ensureCanvasGlobals(): Promise<void> {
  preparado ??= definirGlobales();
  return preparado;
}
