/**
 * El freno del proxy de geocodificación.
 *
 * **Por qué no sirve ninguno de los dos limitadores que ya tiene FotOffice.** El de
 * `lib/coverages/rate-limit.ts` cuenta filas de `CoverageRequest`: limita solicitudes guardadas,
 * que es exactamente lo que acá no existe —buscar una dirección no guarda nada—. El de
 * `lib/communications/test-email-rate-limit.ts` cuenta filas de `SentEmailLog` y necesita un
 * usuario con sesión, que acá tampoco hay. Los dos consultan la base: una consulta por tecleo
 * sería más cara que el pedido que se quiere abaratar.
 *
 * Por eso este es de memoria, y es el mismo que usa CompraMeLaFoto en `lib/rate-limit.ts` para
 * su propio proxy. Que sea de memoria tiene una consecuencia que conviene decir en voz alta: en
 * Vercel cada instancia lleva su propio conteo, así que el tope real es "N por instancia". No es
 * un control de seguridad; es lo que evita que una pestaña con un bucle —o un raspador
 * distraído— le apunte a Nominatim con nuestra IP y nos bloqueen por abuso.
 *
 * El tope importa más acá que en CLF: el formulario de coberturas es público y anónimo, ya está
 * recibiendo pedidos reales, y sin freno este endpoint sería un proxy abierto a Nominatim para
 * cualquiera que encuentre la URL.
 */

type Registro = { count: number; resetAt: number };

const memoria = new Map<string, Registro>();

/**
 * Limpieza perezosa: sólo cuando el mapa ya creció, y sólo lo vencido.
 *
 * Sin esto, una instancia de larga vida acumula una entrada por cada IP que pasó alguna vez.
 * Con esto, el costo se paga una vez cada tanto y no en cada pedido.
 */
function limpiar(ahora: number) {
  if (memoria.size < 500) return;
  for (const [clave, registro] of memoria.entries()) {
    if (registro.resetAt <= ahora) memoria.delete(clave);
  }
}

export type DecisionDeFreno = { allowed: boolean; remaining: number; resetAt: number };

export function checkRateLimit(params: {
  key: string;
  limit: number;
  windowMs: number;
}): DecisionDeFreno {
  const { key, limit, windowMs } = params;
  const ahora = Date.now();
  limpiar(ahora);

  const registro = memoria.get(key);
  if (!registro || registro.resetAt <= ahora) {
    const nuevo: Registro = { count: 1, resetAt: ahora + windowMs };
    memoria.set(key, nuevo);
    return { allowed: true, remaining: limit - 1, resetAt: nuevo.resetAt };
  }

  if (registro.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: registro.resetAt };
  }

  registro.count += 1;
  return { allowed: true, remaining: Math.max(0, limit - registro.count), resetAt: registro.resetAt };
}

/** Sólo para los tests: deja el conteo en cero entre casos. */
export function resetRateLimit() {
  memoria.clear();
}

/**
 * De dónde viene el pedido, para agrupar el conteo.
 *
 * No se guarda en ningún lado: vive en memoria mientras dura la ventana. Distinto del
 * `hashOrigen` del formulario, que sí persiste y por eso va con sal.
 */
export function clientIp(headers: Headers): string {
  return (
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headers.get("x-real-ip")?.trim() ||
    "desconocido"
  );
}
