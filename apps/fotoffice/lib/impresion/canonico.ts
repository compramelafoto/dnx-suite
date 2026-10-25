/**
 * Módulo PURO: JSON con las claves ordenadas (y sin las claves `undefined`), para comparar recetas
 * en el navegador y para calcular huellas en el servidor (`huella.ts`). La base devuelve el JSON con
 * otro orden de claves, así que comparar el texto común no sirve.
 */
export function canonico(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(canonico).join(",")}]`;
  const o = v as Record<string, unknown>;
  return `{${Object.keys(o).filter((k) => o[k] !== undefined).sort().map((k) => `${JSON.stringify(k)}:${canonico(o[k])}`).join(",")}}`;
}
