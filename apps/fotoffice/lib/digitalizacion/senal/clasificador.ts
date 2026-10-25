import { correlacion, diferenciaMedia, distanciaHuella, type Rasgos } from "./rasgos";

/** QUIETA no es "sin señal" por sí sola: lo decide `corte.ts` si dura 60 s o más. */
export type ClaseCuadro = "IMAGEN" | "QUIETA" | "SIN_SENAL_CALIBRADA" | "NEGRO" | "AZUL" | "NIEVE";
export const CLASES_SIN_SENAL: ReadonlySet<ClaseCuadro> = new Set(["SIN_SENAL_CALIBRADA", "NEGRO", "AZUL", "NIEVE"]);

/** Umbrales iniciales; se ajustan con el equipo real en la prueba de la Tarea 13. */
export const UMBRALES = {
  huella: 12,
  negroBrillo: 20,
  negroDesvio: 8,
  azulMin: 100,
  azulSobreRojo: 50,
  azulSobreVerde: 30,
  azulDesvio: 15,
  nieveDesvio: 35,
  nieveSaturacion: 0.12,
  nieveCorrelacion: 0.3,
  quietaDiferencia: 0.5,
} as const;

export function clasificar(
  actual: Rasgos,
  anterior: Rasgos | null,
  huella: readonly number[] | null,
  u: typeof UMBRALES = UMBRALES,
): ClaseCuadro {
  if (huella && distanciaHuella(actual.huella, huella) < u.huella) return "SIN_SENAL_CALIBRADA";
  if (actual.brillo < u.negroBrillo && actual.desvio < u.negroDesvio) return "NEGRO";
  if (actual.b >= u.azulMin && actual.b - actual.r >= u.azulSobreRojo && actual.b - actual.g >= u.azulSobreVerde && actual.desvio <= u.azulDesvio) {
    return "AZUL";
  }
  if (anterior) {
    if (actual.desvio > u.nieveDesvio && actual.saturacion < u.nieveSaturacion && Math.abs(correlacion(actual.luma, anterior.luma)) < u.nieveCorrelacion) {
      return "NIEVE";
    }
    if (diferenciaMedia(actual.luma, anterior.luma) < u.quietaDiferencia) return "QUIETA";
  }
  return "IMAGEN";
}
