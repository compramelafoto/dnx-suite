import { isInArgentina } from "@repo/muestras";

/**
 * De los resultados de Nominatim, el primero que es un lugar donde vive gente (ciudad, barrio,
 * calle, edificio). Sin esto, "Paraná" da el río y "Salado" un arroyo: quedan lejos de cualquier
 * sala. Se descartan ríos, accidentes naturales, usos del suelo y lo que cae fuera de Argentina.
 */
const NO_HABITABLES = new Set(["waterway", "natural", "landuse", "water", "geological", "mountain_pass"]);

type Resultado = { latitude: number; longitude: number; city: string | null; raw?: unknown };

export function elegirLugar<R extends Resultado>(resultados: readonly R[]): R | null {
  for (const r of resultados) {
    if (!isInArgentina(r)) continue;
    const clase = (r.raw as { class?: unknown } | undefined)?.class;
    if (typeof clase === "string" && NO_HABITABLES.has(clase)) continue;
    return r;
  }
  return null;
}
