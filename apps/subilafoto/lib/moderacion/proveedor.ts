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

/** Normaliza lo que devuelve el proveedor a la forma que entienden las reglas. */
export function normalizarEtiquetas(
  crudas: readonly { Name?: string; Confidence?: number }[] | undefined,
): Etiqueta[] {
  if (!crudas) return [];
  return crudas
    .filter((e): e is { Name: string; Confidence: number } =>
      typeof e.Name === "string" && typeof e.Confidence === "number",
    )
    .map((e) => ({ nombre: e.Name, confianza: e.Confidence }));
}
