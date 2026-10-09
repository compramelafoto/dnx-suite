/**
 * Freno en memoria para lo que cualquier cuenta de Google puede disparar: buscar direcciones,
 * subir imágenes, crear borradores y enviarlos a revisión.
 *
 * Es el mismo limitador que usa CompraMeLaFoto en `lib/rate-limit.ts`. Que sea de memoria tiene
 * una consecuencia que conviene decir en voz alta: en Vercel cada instancia lleva su propio
 * conteo, así que el tope real es "N por instancia". No es un control de seguridad fuerte; es lo
 * que evita que una pestaña con un bucle —o alguien con una cuenta descartable— llene el bucket
 * de imágenes, la base de borradores o la bandeja de revisión, o nos haga bloquear en Nominatim.
 */

type Registro = { count: number; resetAt: number };

const memoria = new Map<string, Registro>();

/**
 * Limpieza perezosa: sólo cuando el mapa ya creció, y sólo lo vencido.
 *
 * Sin esto, una instancia de larga vida acumula una entrada por cada persona que pasó alguna vez.
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


/** Los topes de cada cosa, todos por persona con sesión. */
export const LIMITES = {
  geocode: { limit: 60, windowMs: 60_000 },
  imagenes: { limit: 60, windowMs: 10 * 60_000 },
  crearBorrador: { limit: 20, windowMs: 60 * 60_000 },
  guardarPerfil: { limit: 30, windowMs: 60 * 60_000 },
  buscarPerfiles: { limit: 60, windowMs: 60_000 },
  // Una muestra llena son 40 obras (MAX_WORKS): bajar la ficha de cada una más el PDF completo en
  // dos tamaños entra holgado. Contar sólo el PDF completo dejaría sin tope las fichas sueltas,
  // que también arman un PDF en el servidor.
  fichas: { limit: 100, windowMs: 10 * 60_000 },
  enviarARevision: { limit: 10, windowMs: 60 * 60_000 },
} as const;

/**
 * Los topes de lo que se puede hacer sin sesión, contados por IP. Hoy, sólo "Buscá muestras
 * cerca tuyo" de la portada: cada búsqueda es un pedido a Nominatim con nuestro nombre, y su
 * política pide no pasar de uno por segundo. 10 por minuto alcanza para buscar, corregir y
 * volver a buscar; un bucle se frena enseguida.
 */
export const LIMITES_PUBLICOS = {
  buscarCerca: { limit: 10, windowMs: 60_000 },
} as const;

export type QueSeLimitaSinSesion = keyof typeof LIMITES_PUBLICOS;

/**
 * La IP de quien pide, según los encabezados del proxy (en Vercel, `x-forwarded-for` lo pone la
 * plataforma y el primer valor es el cliente). Sin encabezados, todos comparten un mismo balde:
 * peor para ellos, nunca un pase libre.
 */
export function ipDeLaPeticion(h: { get(nombre: string): string | null }): string {
  const reenviada = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = reenviada || h.get("x-real-ip")?.trim() || "";
  return /^[0-9a-fA-F:.]{3,45}$/.test(ip) ? ip : "sin-ip";
}

/** Cuenta un uso de `que` para esa IP y dice si todavía está dentro del tope. */
export function frenarPorIp(que: QueSeLimitaSinSesion, ip: string): DecisionDeFreno {
  return checkRateLimit({ key: `ip:${que}:${ip}`, ...LIMITES_PUBLICOS[que] });
}

export type QueSeLimita = keyof typeof LIMITES;

/** Cuenta un uso de `que` para la persona y dice si todavía está dentro del tope. */
export function frenarPorUsuario(que: QueSeLimita, userId: number): DecisionDeFreno {
  return checkRateLimit({ key: `${que}:${userId}`, ...LIMITES[que] });
}
