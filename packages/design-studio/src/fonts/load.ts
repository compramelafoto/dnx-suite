import { FONT_CATALOG, isFontId, type FontId, type FontSlot } from "./catalog";
import { FUENTES_INCRUSTADAS } from "./embedded";

/**
 * Las tipografías vienen incrustadas en el paquete, no se leen del disco.
 *
 * Antes se resolvían con `require.resolve("@fontsource/…")` en tiempo de ejecución. Andaba en
 * una computadora y fallaba en el servidor, con un mensaje que además mentía —"falta instalar
 * la dependencia"— cuando la dependencia estaba instalada.
 *
 * El motivo: con pnpm el enlace a `@fontsource` existe solo dentro de `packages/design-studio`.
 * Al empaquetar la aplicación, este código termina en otro lado del árbol y la búsqueda hacia
 * arriba nunca llega a ese enlace. Copiar los archivos al servidor no alcanzaba: el problema no
 * era que faltaran, era que Node no sabía dónde buscarlos.
 *
 * Incrustarlas cuesta unos 880 KB de módulos y elimina la clase entera de problema: no hay
 * sistema de archivos, ni resolución, ni diferencia entre una computadora y un servidor. Se
 * cargan por familia y bajo demanda, así que una pieza que usa una sola no paga por las seis.
 *
 * Se regeneran con `pnpm --filter @repo/design-studio fuentes`.
 */

const cache = new Map<string, Uint8Array>();

export async function readFontBytes(id: FontId, slot: FontSlot): Promise<Uint8Array> {
  if (!isFontId(id)) {
    throw new Error(`La tipografía "${String(id)}" no está en el catálogo del módulo de diseño.`);
  }
  const clave = `${id}:${slot}`;
  const enCache = cache.get(clave);
  if (enCache) return enCache;

  const cargar = FUENTES_INCRUSTADAS[id];
  if (!cargar) {
    throw new Error(
      `La tipografía ${FONT_CATALOG[id].label} no está incrustada. Regenerá con "pnpm --filter @repo/design-studio fuentes".`,
    );
  }
  const familia = await cargar();
  const base64 = familia[slot];
  if (!base64) {
    throw new Error(
      `Falta la variante "${slot}" de ${FONT_CATALOG[id].label} entre las tipografías incrustadas.`,
    );
  }

  const bytes = Uint8Array.from(Buffer.from(base64, "base64"));
  cache.set(clave, bytes);
  return bytes;
}
