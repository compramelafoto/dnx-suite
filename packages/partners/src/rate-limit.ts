/**
 * Límite de uso por ventana fija, en memoria.
 *
 * Existe para las pantallas públicas: un endpoint abierto que sube archivos y
 * compone imágenes gasta CPU real por pedido, y sin tope cualquiera puede
 * dejarlo de rodillas sin proponérselo.
 *
 * **Es por proceso.** En serverless cada instancia lleva su propia cuenta, así
 * que el tope efectivo es mayor que el configurado. Sirve para frenar el abuso
 * de un cliente insistente, no para repartir cupo con precisión; para eso haría
 * falta un almacén compartido.
 *
 * `now` se inyecta para que las pruebas no dependan del reloj.
 */

export type RateLimitOptions = {
  /** Cuántos pedidos entran en la ventana. */
  limit: number;
  /** Largo de la ventana, en milisegundos. */
  windowMs: number;
  now?: number;
};

export type RateLimitResult = {
  allowed: boolean;
  /** Cuántos quedan en esta ventana. Cero cuando ya se frenó. */
  remaining: number;
  /** Segundos hasta que la ventana se reinicia. */
  retryAfterSeconds: number;
};

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

/** Cada cuánto se limpian las ventanas vencidas. */
const SWEEP_EVERY_MS = 1_000;
let lastSweepAt = 0;

function sweep(now: number): void {
  if (now - lastSweepAt < SWEEP_EVERY_MS) return;
  lastSweepAt = now;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

/**
 * Cuenta un pedido y dice si pasa.
 *
 * La ventana es fija: arranca con el primer pedido y se reinicia al vencer.
 */
export function consumeRateLimit(key: string, options: RateLimitOptions): RateLimitResult {
  const now = options.now ?? Date.now();
  sweep(now);

  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + options.windowMs });
    return {
      allowed: true,
      remaining: Math.max(0, options.limit - 1),
      retryAfterSeconds: Math.ceil(options.windowMs / 1000),
    };
  }

  bucket.count += 1;
  const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));

  if (bucket.count > options.limit) {
    return { allowed: false, remaining: 0, retryAfterSeconds };
  }
  return {
    allowed: true,
    remaining: Math.max(0, options.limit - bucket.count),
    retryAfterSeconds,
  };
}

/** Cuántas ventanas hay vivas. Para pruebas y diagnóstico. */
export function rateLimitSize(): number {
  return buckets.size;
}

/** Borra todo. Solo para pruebas. */
export function resetRateLimits(): void {
  buckets.clear();
  lastSweepAt = 0;
}
