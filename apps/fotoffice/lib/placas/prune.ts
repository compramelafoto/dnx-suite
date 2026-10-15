/**
 * Saca del documento los bloques que no tienen qué dibujar.
 *
 * El módulo de diseño trata una imagen o un QR sin dato como un error y no emite la pieza: para
 * un carnet es lo correcto —uno sin foto no identifica—, para una placa no. Un socio sin foto de
 * perfil, o sin las tres fotos destacadas, tiene que recibir su placa igual; lo que falta,
 * simplemente no aparece. Por eso la poda se hace acá, del lado de las placas, y el módulo de
 * diseño sigue siendo estricto para todos los demás.
 *
 * Puro: recibe el documento y los valores, devuelve un documento nuevo sin tocar el original.
 */
export function pruneEmptyBlocks(
  document: unknown,
  values: Record<string, unknown>,
): { document: unknown; removed: string[] } {
  if (!document || typeof document !== "object" || Array.isArray(document)) {
    return { document, removed: [] };
  }
  const doc = document as { sides?: unknown };
  if (!Array.isArray(doc.sides)) return { document, removed: [] };

  const vacio = (key: unknown) => {
    if (typeof key !== "string") return false;
    const v = values[key];
    return v === null || v === undefined || (typeof v === "string" && v.trim() === "");
  };

  const removed: string[] = [];
  const sides = doc.sides.map((cara) => {
    if (!cara || typeof cara !== "object" || !Array.isArray((cara as { blocks?: unknown }).blocks)) {
      return cara;
    }
    const c = cara as { blocks: unknown[] };
    const blocks = c.blocks.filter((b) => {
      if (!b || typeof b !== "object") return true;
      const bloque = b as { id?: unknown; type?: unknown; variableKey?: unknown; resourceRef?: unknown };
      const conVariable =
        (bloque.type === "image" && !bloque.resourceRef) || bloque.type === "qrcode";
      if (conVariable && vacio(bloque.variableKey)) {
        removed.push(String(bloque.id ?? "?"));
        return false;
      }
      return true;
    });
    return { ...c, blocks };
  });

  return { document: { ...doc, sides }, removed };
}
