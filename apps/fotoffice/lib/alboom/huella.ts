import { createHash } from "node:crypto";

/**
 * JSON canónico: claves de los objetos ordenadas, sin espacios. Dos respuestas con los mismos datos en otro orden
 * dan la misma huella, así "Volver a extraer" no reescribe lo que no cambió.
 */
export function jsonCanonico(valor: unknown): string {
  if (valor === null || typeof valor !== "object") {
    // `undefined` y funciones no existen en JSON: como en `JSON.stringify` dentro de un arreglo, valen null.
    const s = JSON.stringify(valor);
    return s === undefined ? "null" : s;
  }
  if (Array.isArray(valor)) return `[${valor.map(jsonCanonico).join(",")}]`;
  const obj = valor as Record<string, unknown>;
  const partes = Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${jsonCanonico(obj[k])}`);
  return `{${partes.join(",")}}`;
}

/** sha256 en hexadecimal (64 caracteres) del JSON canónico. */
export function huella(valor: unknown): string {
  return createHash("sha256").update(jsonCanonico(valor)).digest("hex");
}
