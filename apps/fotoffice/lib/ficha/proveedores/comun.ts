import "server-only";

/** Cuántas filas lee un proveedor: lo que pide el motor, con tope por las dudas. */
export function filas(take: number): number {
  return Math.min(Math.max(1, Math.floor(take)), 101);
}

export { tamanoLegible } from "../formato";

/** `{ campo: { before, after } }` guardado en JSON → pares legibles. */
export function leerCambios(raw: unknown): [string, { before?: unknown; after?: unknown }][] {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return [];
  return Object.entries(raw as Record<string, { before?: unknown; after?: unknown }>).filter(
    ([, v]) => v !== null && typeof v === "object",
  );
}

/** Texto de un JSON de detalle, o null si no es texto. */
export function texto(detalle: unknown, clave: string): string | null {
  if (detalle === null || typeof detalle !== "object" || Array.isArray(detalle)) return null;
  const v = (detalle as Record<string, unknown>)[clave];
  return typeof v === "string" && v.trim() !== "" ? v : null;
}
