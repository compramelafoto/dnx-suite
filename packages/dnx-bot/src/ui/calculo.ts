/**
 * Tarjeta «cálculo» (evento SSE `calculo`): filas etiqueta/valor que arma EL SERVIDOR con los
 * números del motor (FOTOFFICE, ¿Cuánto Cobro?). La burbuja sólo la valida y la pinta: así, aunque
 * el modelo se equivoque en una cifra al escribir, los números que valen están acá.
 */
export type TarjetaCalculo = { titulo: string; filas: { etiqueta: string; valor: string }[]; avisos: string[] };

const MAX_FILAS = 12;
const MAX_AVISOS = 6;
const corto = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.slice(0, max) : null);

export function parseTarjetaCalculo(d: unknown): TarjetaCalculo | null {
  if (!d || typeof d !== "object") return null;
  const t = d as Record<string, unknown>;
  const titulo = corto(t.titulo, 80);
  if (!titulo || !Array.isArray(t.filas)) return null;
  const filas = t.filas
    .map((f) => {
      const x = (f ?? {}) as Record<string, unknown>;
      const etiqueta = corto(x.etiqueta, 60);
      const valor = corto(x.valor, 60);
      return etiqueta && valor ? { etiqueta, valor } : null;
    })
    .filter((f): f is { etiqueta: string; valor: string } => f !== null)
    .slice(0, MAX_FILAS);
  if (filas.length === 0) return null;
  const avisos = (Array.isArray(t.avisos) ? t.avisos : [])
    .map((a) => corto(a, 300))
    .filter((a): a is string => a !== null)
    .slice(0, MAX_AVISOS);
  return { titulo, filas, avisos };
}
