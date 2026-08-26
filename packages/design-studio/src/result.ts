/**
 * Resultado explícito. El módulo nunca devuelve un valor por defecto cuando algo falla:
 * un diseño que se emite mal en silencio es peor que uno que no se emite.
 */
export type Result<T> = { ok: true; value: T } | { ok: false; errors: string[] };

export function ok<T>(value: T): Result<T> {
  return { ok: true, value };
}

export function fail<T>(...errors: string[]): Result<T> {
  return { ok: false, errors };
}

export function isOk<T>(r: Result<T>): r is { ok: true; value: T } {
  return r.ok;
}
