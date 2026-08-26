import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { FONT_CATALOG, isFontId, type FontId, type FontSlot } from "./catalog";

/**
 * Resolución por `createRequire` y no por `process.cwd()`: con pnpm los paquetes están
 * enlazados y el directorio de trabajo es el de la aplicación, no el de este paquete.
 */
const require = createRequire(import.meta.url);

const cache = new Map<string, Uint8Array>();

/** Solo servidor. Lee el WOFF que empaqueta @fontsource. */
export async function readFontBytes(id: FontId, slot: FontSlot): Promise<Uint8Array> {
  if (!isFontId(id)) {
    throw new Error(`La tipografía "${String(id)}" no está en el catálogo del módulo de diseño.`);
  }
  const clave = `${id}:${slot}`;
  const enCache = cache.get(clave);
  if (enCache) return enCache;

  const def = FONT_CATALOG[id];
  const archivo = def.files[slot];
  let ruta: string;
  try {
    ruta = require.resolve(`${def.pkg}/files/${archivo}`);
  } catch {
    throw new Error(
      `No se encontró el archivo de la tipografía ${def.label} (${def.pkg}/files/${archivo}). Falta instalar la dependencia.`,
    );
  }
  const bytes = new Uint8Array(await readFile(ruta));
  cache.set(clave, bytes);
  return bytes;
}
