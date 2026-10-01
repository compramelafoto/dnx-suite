import type { Etiqueta, ResultadoDeAnalisis } from "./reglas";

/**
 * El contrato con el servicio de moderación, sea cual sea.
 *
 * Existe para que cambiar de Amazon a otro proveedor —o agregar un segundo—
 * sea escribir un archivo nuevo y no tocar el flujo de subida, la cola ni el
 * panel. El resto del código no sabe que existe Rekognition.
 */
export interface ProveedorDeModeracion {
  /** Queda guardado en cada decisión, para saber quién la tomó. */
  readonly nombre: string;
  /** Analiza una imagen ya descargada. Nunca lanza: los errores vuelven en el resultado. */
  analizar(imagen: Uint8Array): Promise<AnalisisDelProveedor>;
}

export type AnalisisDelProveedor = ResultadoDeAnalisis & {
  /** Versión del modelo que respondió, si el proveedor la informa. */
  modelo?: string | null;
  latenciaMs: number;
};

/**
 * Sólo se piden etiquetas con esta confianza o más.
 *
 * Por debajo, el ruido supera a la señal y llenaría la cola de revisión de
 * fotos perfectamente normales. Los umbrales finos los pone `reglas.ts`.
 */
export const CONFIANZA_MINIMA = 25;

/** Convierte el error de cualquier proveedor en un código corto y estable. */
export function codigoDeError(error: unknown): string {
  if (typeof error === "object" && error !== null) {
    const e = error as { name?: unknown; code?: unknown };
    if (typeof e.name === "string" && e.name) return e.name;
    if (typeof e.code === "string" && e.code) return e.code;
  }
  return "ErrorDesconocido";
}

/**
 * Normaliza lo que devuelve el proveedor a la forma que entienden las reglas.
 *
 * Rekognition devuelve la categoría y sus subcategorías, todas juntas y con la
 * misma confianza. Se conserva el nivel de cada una porque las reglas tratan
 * distinto a una categoría desconocida de primer nivel —que va a revisión— que
 * a una subcategoría desconocida, que se ignora porque su madre ya vino.
 */
export type EtiquetaCruda = {
  Name?: string;
  Confidence?: number;
  TaxonomyLevel?: number;
  ParentName?: string;
};

export function normalizarEtiquetas(crudas: readonly EtiquetaCruda[] | undefined): Etiqueta[] {
  if (!crudas) return [];

  const salida: Etiqueta[] = [];
  for (const cruda of crudas) {
    // Sin nombre o sin confianza no se puede decidir nada, y ponerle un valor
    // sería inventarlo. Se descarta y se sigue con el resto.
    if (typeof cruda.Name !== "string" || typeof cruda.Confidence !== "number") continue;

    salida.push({
      nombre: cruda.Name,
      confianza: cruda.Confidence,
      // Dos señales, porque no todas las respuestas traen las dos: el nivel
      // explícito y, si no está, tener madre significa no ser de primer nivel.
      esDePrimerNivel:
        typeof cruda.TaxonomyLevel === "number" ? cruda.TaxonomyLevel === 1 : !cruda.ParentName,
    });
  }
  return salida;
}
