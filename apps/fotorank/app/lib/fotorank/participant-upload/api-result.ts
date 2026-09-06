/**
 * Lectura tolerante de respuestas del API de carga.
 *
 * Contexto (incidente de producción, 2026-09-06): el wizard hacía
 * `await res.json()` directo sobre la respuesta del upload. Cuando la
 * plataforma rechazaba el pedido por peso devolvía `413` con cuerpo de texto
 * plano (`FUNCTION_PAYLOAD_TOO_LARGE`), `res.json()` lanzaba SyntaxError, y el
 * `catch` genérico mostraba "Error de red al subir" — un rechazo por tamaño
 * disfrazado de problema de conexión. El participante reintentaba con el mismo
 * archivo y volvía a fallar, sin ninguna pista de la causa real.
 *
 * Reglas de este módulo:
 *  - nunca lanzar por cuerpo no-JSON: se clasifica por status HTTP;
 *  - nunca devolver el cuerpo crudo hacia la UI. Un error de plataforma puede
 *    traer HTML, hosts internos o IDs de request; sólo se propaga un código
 *    estable, que `translateUploadError` convierte en texto para el
 *    participante. Este contrato lo fija `participant-upload.recovery.selfcheck.ts`.
 */

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: string; status: number };

/** Status HTTP → código estable, para respuestas que no traen JSON propio. */
export function classifyHttpStatus(status: number): string {
  if (status === 413) return "PAYLOAD_TOO_LARGE";
  if (status === 401) return "UNAUTHENTICATED";
  if (status === 403) return "FORBIDDEN";
  if (status === 404) return "ENTRY_NOT_FOUND";
  if (status === 408) return "SERVER_TIMEOUT";
  if (status === 429) return "TOO_MANY_REQUESTS";
  if (status === 502 || status === 503) return "SERVER_UNAVAILABLE";
  if (status === 504) return "SERVER_TIMEOUT";
  if (status >= 500) return "SERVER_ERROR";
  return "UNEXPECTED_RESPONSE";
}

/**
 * Lee una respuesta esperando JSON, sin confiar en que lo sea.
 * `res.ok` con cuerpo ilegible también es fallo: significa que el contrato se
 * rompió, y seguir adelante dejaría al wizard en un estado inventado.
 */
export async function readApiResult<T>(res: Response): Promise<ApiResult<T>> {
  let raw = "";
  try {
    raw = await res.text();
  } catch {
    // Conexión cortada mientras se leía el cuerpo.
    return { ok: false, code: res.ok ? "UNEXPECTED_RESPONSE" : classifyHttpStatus(res.status), status: res.status };
  }

  let parsed: unknown = null;
  try {
    parsed = raw ? JSON.parse(raw) : null;
  } catch {
    parsed = null;
  }

  if (parsed && typeof parsed === "object") {
    const body = parsed as { ok?: boolean; error?: { code?: string } };
    if (res.ok && body.ok !== false) return { ok: true, data: parsed as T };
    // El backend contestó su propio código: tiene prioridad sobre el status.
    const code = body.error?.code?.trim();
    return { ok: false, code: code || classifyHttpStatus(res.status), status: res.status };
  }

  return { ok: false, code: classifyHttpStatus(res.status), status: res.status };
}

/**
 * Clasifica una excepción de transporte (el `fetch` ni siquiera completó).
 * `AbortError` es nuestro propio timeout; el resto es red del participante.
 */
export function classifyTransportError(err: unknown): string {
  if (err instanceof Error && err.name === "AbortError") return "ABORTED";
  if (typeof navigator !== "undefined" && navigator.onLine === false) return "NETWORK_OFFLINE";
  return "NETWORK_FAILED";
}

/**
 * Tope de cuerpo por pedido de la plataforma (Vercel): 4,5 MB. No es un valor
 * nuestro y no se puede subir por configuración — de ahí la subida directa al
 * bucket. Se deja con margen para cabeceras y el sobre multipart, que también
 * cuentan contra el límite.
 */
export const PLATFORM_REQUEST_LIMIT_BYTES = 4 * 1024 * 1024;

/** Llamadas al API de la app: responden rápido o algo anda mal. */
export const API_TIMEOUT_MS = 55_000;

/** Confirmación: la ruta declara `maxDuration = 30`, no tiene sentido esperar más. */
export const CONFIRM_TIMEOUT_MS = 30_000;

/**
 * Subida del original al bucket. Es tráfico del participante, no cómputo del
 * servidor: 25 MB por una red móvil lenta tardan minutos legítimamente. Con el
 * presupuesto de 55 s de las llamadas de API, esos envíos se cortarían solos.
 */
export const DIRECT_UPLOAD_TIMEOUT_MS = 600_000;

/**
 * `fetch` con timeout propio. Cada paso del envío tiene su presupuesto, y el
 * `AbortController` se descarta al terminar para que un paso no herede el
 * tiempo ya consumido por el anterior.
 */
export async function fetchWithTimeout(
  input: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}
