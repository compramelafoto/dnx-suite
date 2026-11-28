/**
 * Freno en memoria para el ingreso (probar contraseñas). Mismo mecanismo que `apps/muestras/lib/limite.ts`.
 * Cada instancia lleva su propio conteo (en Vercel el tope real es «N por instancia»): frena el
 * ensayo de claves a mano o con un bucle simple, no es un control fuerte.
 */

type Registro = { count: number; resetAt: number };

const memoria = new Map<string, Registro>();
const MAX_ENTRADAS = 10_000;

export function checkRateLimit(params: {
  key: string;
  limit: number;
  windowMs: number;
  now?: number;
}): { allowed: boolean; resetAt: number } {
  const ahora = params.now ?? Date.now();
  const registro = memoria.get(params.key);
  if (!registro || registro.resetAt <= ahora) {
    memoria.delete(params.key);
    // Tope duro: si el mapa está lleno se va la clave más vieja (la primera en el orden de alta).
    while (memoria.size >= MAX_ENTRADAS) {
      const primera = memoria.keys().next();
      if (primera.done) break;
      memoria.delete(primera.value);
    }
    const nuevo = { count: 1, resetAt: ahora + params.windowMs };
    memoria.set(params.key, nuevo);
    return { allowed: true, resetAt: nuevo.resetAt };
  }
  if (registro.count >= params.limit) return { allowed: false, resetAt: registro.resetAt };
  registro.count += 1;
  return { allowed: true, resetAt: registro.resetAt };
}
