import {
  FONT_CATALOG,
  googleFamilyOf,
  isCuratedFontId,
  isGoogleFontId,
  type CuratedFontId,
  type FontId,
  type FontSlot,
  type GoogleFontId,
} from "./catalog";
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
  if (isGoogleFontId(id)) return readGoogleFontBytes(id, slot);
  if (!isCuratedFontId(id)) {
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

/*
 * Tipografías de Google: las mismas familias que carga el editor.
 *
 * Se bajan de Fontsource (el mismo origen que las incrustadas, servido por jsDelivr) y no de
 * la API de Google: los TrueType de Google traen glifos que fontkit no sabe leer, y el PDF
 * salía con letras sueltas (Arimo, el reemplazo de Helvetica, perdía media palabra). Los de
 * Fontsource son estáticos y del juego latino, que cubre acentos, eñe y «º».
 *
 * Una familia sin la variante pedida (las caligráficas no tienen negrita) responde 404; se
 * prueba la variante más cercana, como hace el navegador en pantalla.
 */
const VARIANTE: Record<FontSlot, { estilo: "normal" | "italic"; peso: number }> = {
  normal: { estilo: "normal", peso: 400 },
  bold: { estilo: "normal", peso: 700 },
  italic: { estilo: "italic", peso: 400 },
  boldItalic: { estilo: "italic", peso: 700 },
};

const ALTERNATIVAS: Record<FontSlot, FontSlot[]> = {
  normal: ["normal"],
  bold: ["bold", "normal"],
  italic: ["italic", "normal"],
  boldItalic: ["boldItalic", "bold", "italic", "normal"],
};

const pendientes = new Map<string, Promise<Uint8Array | null>>();

/** La dirección del archivo de una familia y variante en Fontsource. */
export function fontsourceUrl(familia: string, slot: FontSlot): string {
  const { estilo, peso } = VARIANTE[slot];
  const slug = familia.trim().toLowerCase().replace(/\s+/g, "-");
  return `https://cdn.jsdelivr.net/fontsource/fonts/${slug}@latest/latin-${peso}-${estilo}.ttf`;
}

async function bajarVariante(familia: string, slot: FontSlot): Promise<Uint8Array | null> {
  const clave = `google:${familia}:${slot}`;
  const enCache = cache.get(clave);
  if (enCache) return enCache;
  let pendiente = pendientes.get(clave);
  if (!pendiente) {
    pendiente = (async () => {
      const res = await fetch(fontsourceUrl(familia, slot), { signal: AbortSignal.timeout(20_000) });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`respuesta ${res.status}`);
      const bytes = new Uint8Array(await res.arrayBuffer());
      cache.set(clave, bytes);
      return bytes;
    })().finally(() => pendientes.delete(clave));
    pendientes.set(clave, pendiente);
  }
  return pendiente;
}

/**
 * La variante que de verdad se usó. Una familia sin negrita o sin cursiva (las caligráficas)
 * devuelve la normal, y quien dibuja tiene que simularla como el navegador.
 */
export type FuenteLeida = { bytes: Uint8Array; slot: FontSlot };

const variantesUsadas = new Map<string, FontSlot>();

/** La variante real detrás de `readFontBytes`, una vez leída. */
export function varianteLeida(id: FontId, slot: FontSlot): FontSlot {
  return variantesUsadas.get(`${id}:${slot}`) ?? slot;
}

async function readGoogleFontBytes(id: GoogleFontId, slot: FontSlot): Promise<Uint8Array> {
  const familia = googleFamilyOf(id);
  let ultimoError: unknown = null;
  for (const variante of ALTERNATIVAS[slot]) {
    try {
      const bytes = await bajarVariante(familia, variante);
      if (bytes) {
        variantesUsadas.set(`${id}:${slot}`, variante);
        return bytes;
      }
    } catch (e) {
      ultimoError = e;
    }
  }
  /*
   * Si Fontsource no contesta y la familia está entre las incrustadas, se imprime con esa:
   * puede ser una versión anterior de la misma letra, pero es la misma letra.
   */
  const incrustada = (Object.keys(FONT_CATALOG) as CuratedFontId[]).find(
    (k) => FONT_CATALOG[k].cssFamily.toLowerCase() === familia.toLowerCase(),
  );
  if (incrustada) return readFontBytes(incrustada, slot);
  const detalle = ultimoError instanceof Error ? ` (${ultimoError.message})` : "";
  throw new Error(`No se pudo bajar la tipografía ${familia}${detalle}.`);
}
