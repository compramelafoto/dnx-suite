/**
 * Texto del historial de Configuración → Numeración. Módulo PURO (sin base ni `server-only`).
 * `before`/`after` son las fotos JSON que guarda `configurarSecuencia`.
 */

type Foto = { prefix?: unknown; withYear?: unknown; digits?: unknown; nextValue?: unknown };

function foto(v: unknown): Foto {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Foto) : {};
}

const prefijo = (v: unknown) => (typeof v === "string" && v.length > 0 ? `"${v}"` : "sin prefijo");
const anio = (v: unknown) => (v === true ? "con año" : "sin año");
const numero = (v: unknown) => (typeof v === "number" ? String(v) : "—");

/** Una línea por dato que cambió: "Prefijo: sin prefijo → "P-"". */
export function describirCambioSecuencia(before: unknown, after: unknown): string[] {
  const a = foto(before);
  const d = foto(after);
  const out: string[] = [];
  if ((a.prefix ?? "") !== (d.prefix ?? "")) out.push(`Prefijo: ${prefijo(a.prefix)} → ${prefijo(d.prefix)}`);
  if (a.withYear !== d.withYear) out.push(`Año: ${anio(a.withYear)} → ${anio(d.withYear)}`);
  if (a.digits !== d.digits) out.push(`Dígitos: ${numero(a.digits)} → ${numero(d.digits)}`);
  if (a.nextValue !== d.nextValue) out.push(`Próximo número: ${numero(a.nextValue)} → ${numero(d.nextValue)}`);
  return out.length > 0 ? out : ["Sin cambios de formato"];
}
