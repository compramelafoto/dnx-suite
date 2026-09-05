/**
 * Cuánto trabajo hace cada corrida del pipeline de análisis (face/OCR).
 *
 * Historia: el runner tomaba un lote fijo de 2 fotos y devolvía. Con el cron cada
 * 10 minutos eso daba un techo de ~288 fotos por día, mientras la función tenía
 * `maxDuration = 800` s y terminaba en ~2 s. Un evento de 500 fotos tardaba días y
 * el reconocimiento facial del álbum respondía "las fotos se están procesando".
 *
 * Ahora no hay tope de fotos por corrida: el runner da vueltas hasta vaciar la cola,
 * y lo único que lo corta es el reloj de la función.
 */

/** Fotos que se reclaman por vuelta. Cada vuelta es una consulta de claim. */
export const DEFAULT_BATCH_SIZE = 12;
export const MAX_BATCH_SIZE = 50;

/**
 * Fotos procesadas en paralelo dentro de una vuelta. El techo real es la memoria:
 * sharp decodifica el original completo. 3 es el valor que viene usando sin problemas
 * el script manual `scripts/process-album-analysis-loop.ts` desde agosto de 2026.
 */
export const DEFAULT_CONCURRENCY = 3;
export const MAX_CONCURRENCY = 12;

/**
 * Presupuesto de pared por corrida. El route declara `maxDuration = 800` s;
 * dejamos margen para cerrar prolijo y liberar el lease.
 */
export const DEFAULT_MAX_RUN_MS = 700_000;
export const MAX_RUN_MS_CEILING = 780_000;
export const MIN_RUN_MS = 10_000;

function clampInt(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Math.floor(value)));
}

function resolveEnvInt(raw: string | undefined, fallback: number, min: number, max: number) {
  if (raw == null || raw.trim() === "") return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return clampInt(n, min, max);
}

export function resolveBatchSize(): number {
  return resolveEnvInt(
    process.env.ANALYSIS_BATCH_SIZE,
    DEFAULT_BATCH_SIZE,
    1,
    MAX_BATCH_SIZE
  );
}

export function resolveConcurrency(): number {
  return resolveEnvInt(
    process.env.ANALYSIS_CONCURRENCY,
    DEFAULT_CONCURRENCY,
    1,
    MAX_CONCURRENCY
  );
}

/** Presupuesto de la corrida, configurable en segundos por entorno. */
export function resolveMaxRunMs(): number {
  const raw = process.env.ANALYSIS_MAX_RUN_SECONDS;
  if (raw == null || raw.trim() === "") return DEFAULT_MAX_RUN_MS;
  const seconds = Number(raw);
  if (!Number.isFinite(seconds)) return DEFAULT_MAX_RUN_MS;
  return clampInt(seconds * 1000, MIN_RUN_MS, MAX_RUN_MS_CEILING);
}

export type RoundDecision = {
  /** Milisegundos transcurridos desde que arrancó la corrida. */
  elapsedMs: number;
  /** Presupuesto total de la corrida. */
  maxRunMs: number;
  /** Jobs que la última vuelta consiguió tomar. 0 = cola vacía. */
  lastRoundLocked: number;
  /** Cuánto tardó la última vuelta, para proyectar si entra otra. */
  lastRoundMs: number;
  /** Sólo informativo: nunca corta por cantidad de fotos. */
  processedSoFar?: number;
};

/**
 * ¿Damos otra vuelta? Sí mientras haya cola y la próxima vuelta entre en el reloj.
 * Deliberadamente no mira `processedSoFar`: no hay tope de fotos por corrida.
 */
export function shouldRunAnotherRound(decision: RoundDecision): boolean {
  const { elapsedMs, maxRunMs, lastRoundLocked, lastRoundMs } = decision;
  if (lastRoundLocked <= 0) return false;
  const projectedEnd = elapsedMs + Math.max(lastRoundMs, 1);
  return projectedEnd < maxRunMs;
}
