import { distanceKm } from "@repo/geo";
import type { ActivityType } from "./constants";
import { temporalStatus } from "./dates";

type Coords = { latitude: number; longitude: number };

export function withDistance<A extends { latitude: number | null; longitude: number | null }>(
  origin: Coords,
  items: A[],
): (A & { distanceKm: number | null })[] {
  return items
    .map((a) => ({
      ...a,
      distanceKm:
        a.latitude == null || a.longitude == null
          ? null
          : Math.round(distanceKm(origin, { latitude: a.latitude, longitude: a.longitude }) * 10) / 10,
    }))
    .sort((x, y) => (x.distanceKm ?? Infinity) - (y.distanceKm ?? Infinity));
}

export type PublicFilter = { province?: string; type?: ActivityType; openNow?: boolean; includeClosed?: boolean };

const fold = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();

export function applyFilter<A extends { province: string | null; type: string; startsAt: Date; endsAt: Date }>(
  items: A[],
  f: PublicFilter,
  now: Date,
): A[] {
  return items.filter((a) => {
    const t = temporalStatus(a, now);
    if (!f.includeClosed && t === "CLOSED") return false;
    if (f.openNow && t !== "OPEN") return false;
    if (f.type && a.type !== f.type) return false;
    if (f.province && fold(a.province ?? "") !== fold(f.province)) return false;
    return true;
  });
}

/* ---------------------------------------------------------------------------------------------
 * "Cerca de" en la portada: `/?cerca=<lat>,<lng>&lugar=<texto>#muestras`.
 *
 * Los dos parámetros vienen de la URL, así que cualquiera puede escribirlos a mano. `cerca` se
 * valida estricto (dos números con punto decimal y dentro de Argentina) y `lugar` es texto plano
 * acotado: sólo se muestra, nunca se interpreta.
 * ------------------------------------------------------------------------------------------- */

/** Argentina con margen: de La Quiaca a Ushuaia y de la cordillera al mar (con Malvinas). */
export const ARGENTINA_BOUNDS = { minLat: -56, maxLat: -21, minLng: -74, maxLng: -53 } as const;
/** Tope del texto de `lugar`: alcanza para "San Carlos de Bariloche" y corta lo que no es un lugar. */
export const MAX_PLACE_LABEL = 60;

const COORD = /^-?\d{1,3}(?:\.\d{1,12})?$/;

const first = (raw: unknown): unknown => (Array.isArray(raw) ? raw[0] : raw);

export function isInArgentina(c: { latitude: number; longitude: number }): boolean {
  const { minLat, maxLat, minLng, maxLng } = ARGENTINA_BOUNDS;
  return Number.isFinite(c.latitude) && Number.isFinite(c.longitude)
    && c.latitude >= minLat && c.latitude <= maxLat && c.longitude >= minLng && c.longitude <= maxLng;
}

/** `"-32.95,-60.65"` → coordenadas; cualquier otra cosa (o fuera de Argentina) → null. */
export function parseNearParam(raw: unknown): Coords | null {
  const v = first(raw);
  if (typeof v !== "string" || v.length > 40) return null;
  const parts = v.split(",");
  if (parts.length !== 2) return null;
  const [a, b] = parts.map((p) => p.trim()) as [string, string];
  if (!COORD.test(a) || !COORD.test(b)) return null;
  const c = { latitude: Number(a), longitude: Number(b) };
  return isInArgentina(c) ? c : null;
}

/** Cuatro decimales son unos 10 m: de sobra para "cerca de" y no deja la casa exacta en la URL. */
export function formatNearParam(c: Coords): string {
  return `${c.latitude.toFixed(4)},${c.longitude.toFixed(4)}`;
}

/** Texto de `lugar` limpio: sin caracteres de control, espacios colapsados y acotado. Vacío → null. */
export function cleanPlaceLabel(raw: unknown): string | null {
  const v = first(raw);
  if (typeof v !== "string") return null;
  // eslint-disable-next-line no-control-regex
  const limpio = v.replace(/[\u0000-\u001f\u007f-\u009f]/g, " ").replace(/\s+/g, " ").trim().slice(0, MAX_PLACE_LABEL).trim();
  return limpio === "" ? null : limpio;
}

/** El enlace a la portada ordenada por cercanía, con el listado a la vista. */
export function nearHref(c: Coords, label: string | null): string {
  const q = new URLSearchParams({ cerca: formatNearParam(c) });
  const lugar = cleanPlaceLabel(label);
  if (lugar) q.set("lugar", lugar);
  return `/?${q.toString()}#muestras`;
}

const KM = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });

/** "a 12 km", "a menos de 1 km"; sin distancia (sin punto en el mapa) → null. */
export function distanceLabel(km: number | null): string | null {
  if (km == null || !Number.isFinite(km)) return null;
  if (km < 1) return "a menos de 1 km";
  return `a ${KM.format(Math.round(km))} km`;
}
