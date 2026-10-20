import { CUANTO_COBRO_ROUTE_FACTOR, straightLineKm } from "@repo/cuanto-cobro-core";

/**
 * Costo del envío a domicilio de un pedido de copias. Módulo puro: lo usa el servidor al cobrar (la cuenta
 * que vale) y el navegador para mostrar el costo mientras el cliente elige la dirección (sólo informativo).
 *
 * km = línea recta del estudio al destino × 1,3 (factor de recorrido de ¿Cuánto cobro?), sólo ida, redondeado
 * a un decimal. Costo = base + km × precio por km, en centavos enteros.
 */

export type Punto = { lat: number; lon: number };
export type CotizacionEnvio = { ok: true; km: number; cents: number } | { ok: false; motivo: "SIN_ESTUDIO" | "SIN_DESTINO" | "FUERA_DE_RADIO" };

/** Latitud y longitud finitas y dentro del mundo. */
export function puntoValido(lat: unknown, lon: unknown): boolean {
  return (
    typeof lat === "number" && typeof lon === "number" && Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180
  );
}

const valido = (p: Punto | null): p is Punto => p !== null && puntoValido(p.lat, p.lon);

export function cotizarEnvio(a: { estudio: Punto | null; destino: Punto | null; baseCents: number; porKmCents: number; maxKm: number | null }): CotizacionEnvio {
  if (!valido(a.estudio)) return { ok: false, motivo: "SIN_ESTUDIO" };
  if (!valido(a.destino)) return { ok: false, motivo: "SIN_DESTINO" };
  const km = Math.round(straightLineKm(a.estudio.lat, a.estudio.lon, a.destino.lat, a.destino.lon) * CUANTO_COBRO_ROUTE_FACTOR * 10) / 10;
  if (a.maxKm !== null && km > a.maxKm) return { ok: false, motivo: "FUERA_DE_RADIO" };
  return { ok: true, km, cents: a.baseCents + Math.round(km * a.porKmCents) };
}

const coord = (v: string | undefined): number | null => {
  if (v === undefined || v.trim() === "") return null;
  const n = Number(v.trim().replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

/** La ubicación del estudio cargada en Configuración → Precios (texto, con coma o punto). null si falta o no vale. */
export function coordenadasDelEstudio(extras: { studioLatitude?: string; studioLongitude?: string } | null): Punto | null {
  if (!extras) return null;
  const lat = coord(extras.studioLatitude);
  const lon = coord(extras.studioLongitude);
  return lat !== null && lon !== null && puntoValido(lat, lon) ? { lat, lon } : null;
}
