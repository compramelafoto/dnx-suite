/**
 * Lo que gasta el Periodista en Claude: tokens, búsquedas web y su costo estimado en dólares.
 * Módulo PURO.
 *
 * Precios de Sonnet 5.5 (lista de Anthropic, noviembre 2026). Si cambian, se cambian acá:
 * - entrada: USD 2 por millón de tokens;
 * - salida: USD 10 por millón de tokens;
 * - búsqueda web (herramienta del lado del servidor): USD 0,01 por búsqueda (USD 10 cada 1000).
 * El caché de las instrucciones se cobra aparte de la entrada común: escribirlo cuesta 1,25 veces
 * la entrada y leerlo 0,1 veces (multiplicadores estándar del caché de 5 minutos).
 */

export const USD_POR_MILLON_ENTRADA = 2;
export const USD_POR_MILLON_SALIDA = 10;
export const USD_POR_BUSQUEDA = 0.01;
export const MULTIPLICADOR_CACHE_ESCRITURA = 1.25;
export const MULTIPLICADOR_CACHE_LECTURA = 0.1;

export type UsoClaude = {
  /** Tokens de entrada comunes (sin contar el caché). */
  entrada: number;
  salida: number;
  busquedas: number;
  /** Tokens de entrada que se escribieron en el caché. */
  cacheEscritura?: number;
  /** Tokens de entrada que se leyeron del caché. */
  cacheLectura?: number;
  /** Costo estimado en USD (se recalcula con `conCosto`). */
  costoUsd?: number;
};

export function usoVacio(): UsoClaude {
  return { entrada: 0, salida: 0, busquedas: 0, cacheEscritura: 0, cacheLectura: 0 };
}

const numero = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : 0);

/** Suma al acumulado lo que informa UNA respuesta de la API (`usage`). Muta `uso`. */
export function sumarUso(uso: UsoClaude, usage: unknown): void {
  const u = (usage ?? {}) as Record<string, unknown>;
  uso.entrada += numero(u.input_tokens);
  uso.salida += numero(u.output_tokens);
  uso.cacheEscritura = (uso.cacheEscritura ?? 0) + numero(u.cache_creation_input_tokens);
  uso.cacheLectura = (uso.cacheLectura ?? 0) + numero(u.cache_read_input_tokens);
  const servidor = u.server_tool_use as Record<string, unknown> | null | undefined;
  uso.busquedas += numero(servidor?.web_search_requests);
}

/** El costo estimado en USD de un uso (redondeado a 6 decimales: la suma del mes no pierde lo chico). */
export function costoUsd(uso: Partial<UsoClaude> | null | undefined): number {
  if (!uso) return 0;
  const entrada =
    numero(uso.entrada) +
    numero(uso.cacheEscritura) * MULTIPLICADOR_CACHE_ESCRITURA +
    numero(uso.cacheLectura) * MULTIPLICADOR_CACHE_LECTURA;
  const total =
    (entrada * USD_POR_MILLON_ENTRADA) / 1_000_000 +
    (numero(uso.salida) * USD_POR_MILLON_SALIDA) / 1_000_000 +
    numero(uso.busquedas) * USD_POR_BUSQUEDA;
  return Math.round(total * 1_000_000) / 1_000_000;
}

/** Junta dos usos (p. ej. la nota + la reescritura por copia + una corrección). */
export function juntarUsos(...usos: Array<Partial<UsoClaude> | null | undefined>): UsoClaude {
  const total = usoVacio();
  for (const u of usos) {
    if (!u) continue;
    total.entrada += numero(u.entrada);
    total.salida += numero(u.salida);
    total.busquedas += numero(u.busquedas);
    total.cacheEscritura = (total.cacheEscritura ?? 0) + numero(u.cacheEscritura);
    total.cacheLectura = (total.cacheLectura ?? 0) + numero(u.cacheLectura);
  }
  return conCosto(total);
}

/** El mismo uso con `costoUsd` calculado. */
export function conCosto(uso: UsoClaude): UsoClaude {
  return { ...uso, costoUsd: costoUsd(uso) };
}

/** "USD 0,12" (con coma decimal, como se escribe acá). */
export function textoUsd(valor: number): string {
  const decimales = valor > 0 && valor < 0.01 ? 4 : 2;
  return `USD ${valor.toFixed(decimales).replace(".", ",")}`;
}
