import "server-only";
import type { NormalizedPlace } from "@repo/geo";
import { geocodingProvider } from "@/lib/geocode/nominatim";
import { coordenadasLegibles } from "@/lib/geocode/lugar";

/**
 * La dirección de un envío a domicilio, verificada en el servidor (Impresiones y, desde la spec
 * 2026-10-22 E9, el envío de cassettes de Digitalización). Sólo en el servidor: Nominatim se llama
 * desde acá, nunca desde el navegador.
 */

export const MAX_DIRECCION = 300;
const SIN_VERIFICAR = "(sin verificar) ";

export const textoLimpio = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max).trim() : "");

/** El punto elegido, el texto que mostró el navegador y lo que agregó la persona (piso, depto, referencia). */
export type PuntoElegido = { lat: number; lon: number; direccion: string; detalles: string };

/**
 * La dirección que se guarda sale del punto que se cobra (geocodificación inversa en el servidor), no del texto
 * del navegador. Si Nominatim falla o no responde, no se frena la venta: queda el texto elegido (o el punto)
 * marcado «(sin verificar)» para que el estudio lo revise. Piso, depto o referencia van al final. Devuelve
 * también el lugar verificado (null si no se pudo), para quien quiera guardar calle o ciudad por separado.
 */
export async function lugarDelPunto(e: PuntoElegido): Promise<{ direccion: string; lugar: NormalizedPlace | null }> {
  let lugar: NormalizedPlace | null = null;
  let base: string | null = null;
  try {
    lugar = await geocodingProvider().reverse(e.lat, e.lon);
    base = textoLimpio(lugar?.displayName, MAX_DIRECCION) || null;
  } catch {
    console.warn("[impresiones] no se pudo verificar la dirección de envío");
  }
  if (!base) lugar = null;
  const dir = base ?? `${SIN_VERIFICAR}${e.direccion || coordenadasLegibles(e.lat, e.lon)}`;
  return { direccion: e.detalles ? `${dir} · ${e.detalles}` : dir, lugar };
}

/** Sólo el texto de la dirección (lo que guarda Impresiones). */
export async function direccionDelPunto(e: PuntoElegido): Promise<string> {
  return (await lugarDelPunto(e)).direccion;
}
