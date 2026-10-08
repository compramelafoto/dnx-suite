/**
 * Saca del documento los bloques que no tienen qué dibujar.
 *
 * - Una imagen o un QR sin dato: el módulo de diseño los trata como error y no emitiría la
 *   pieza. Un ganador sin logo de organizador tiene que recibir su imagen igual.
 * - Un texto cuyos marcadores están **todos** vacíos: "por la obra «»" en el diploma de un
 *   jurado se ve como un error. Si el texto tiene al menos un dato, queda.
 *
 * Mismo criterio que las placas de FOTOFFICE (`apps/fotoffice/lib/placas/prune.ts`), más la
 * regla de los textos. Puro: devuelve un documento nuevo sin tocar el original.
 */

const MARCADOR = /\{\{\s*([A-Za-z0-9_.]+)\s*\}\}/g;

function vacio(values: Record<string, unknown>, key: unknown): boolean {
  if (typeof key !== "string") return false;
  const v = values[key];
  return v === null || v === undefined || (typeof v === "string" && v.trim() === "");
}

function textoSinDatos(content: unknown, values: Record<string, unknown>): boolean {
  if (typeof content !== "string") return false;
  const claves = [...content.matchAll(MARCADOR)].map((m) => m[1]);
  return claves.length > 0 && claves.every((k) => vacio(values, k));
}

export function pruneEmptyBlocks(
  document: unknown,
  values: Record<string, unknown>,
): { document: unknown; removed: string[] } {
  if (!document || typeof document !== "object" || Array.isArray(document)) {
    return { document, removed: [] };
  }
  const doc = document as { sides?: unknown };
  if (!Array.isArray(doc.sides)) return { document, removed: [] };

  const removed: string[] = [];
  const sides = doc.sides.map((cara) => {
    if (!cara || typeof cara !== "object" || !Array.isArray((cara as { blocks?: unknown }).blocks)) {
      return cara;
    }
    const c = cara as { blocks: unknown[] };
    const blocks = c.blocks.filter((b) => {
      if (!b || typeof b !== "object") return true;
      const bloque = b as {
        id?: unknown;
        type?: unknown;
        variableKey?: unknown;
        resourceRef?: unknown;
        content?: unknown;
      };
      const conVariable =
        (bloque.type === "image" && !bloque.resourceRef) || bloque.type === "qrcode";
      const sacar =
        (conVariable && vacio(values, bloque.variableKey)) ||
        (bloque.type === "text" && textoSinDatos(bloque.content, values));
      if (sacar) removed.push(String(bloque.id ?? "?"));
      return !sacar;
    });
    return { ...c, blocks };
  });

  return { document: { ...doc, sides }, removed };
}
