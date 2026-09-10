/**
 * Las constantes del módulo de sorteos.
 *
 * La clave `raffles` ya estaba reservada como `PLANNED` en `lib/modules/registry.ts` desde
 * antes de que existiera una línea de código, igual que pasó con reservas.
 */

export const RAFFLES_MODULE_KEY = "raffles";

/** Todo lo que se le muestra al socio se lee en esta zona. */
export const RAFFLES_TIME_ZONE = "America/Argentina/Buenos_Aires";

/**
 * La cadena de drand que usamos: quicknet.
 *
 * Es *unchained* —cada valor es independiente del anterior— y sale cada 3 segundos. Se guarda
 * en cada sorteo, no se asume: si algún día se cambiara de cadena, los sorteos viejos siguen
 * verificando con la suya.
 */
export const DRAND_DEFAULT_CHAIN_HASH =
  "52db9ba70e0cc0f6eaf7803dd07447a1f5477735fd3f661792ba94600c84e971";

/**
 * Espejos públicos del mismo servicio.
 *
 * Se consultan DOS y tienen que devolver exactamente lo mismo. Un solo servidor que responde
 * lo que quiere sería un punto único de confianza, que es justo lo que este módulo evita.
 *
 * El orden importa poco pero no es casual: medido el 2026-09-08, el de Cloudflare contestó en
 * 0,7 s y los de drand.sh entre 2 y 6 s, y uno de ellos directamente no contestó. Que alguno
 * se caiga es normal y por eso hay cuatro.
 */
export const DRAND_MIRRORS = [
  "https://drand.cloudflare.com",
  "https://api.drand.sh",
  "https://api2.drand.sh",
  "https://api3.drand.sh",
] as const;

/**
 * Cuánto se espera a cada espejo.
 *
 * Sin tope, un espejo colgado se lleva puesto el pedido entero. Con cuatro espejos y ocho
 * segundos cada uno, el peor caso sigue entrando cómodo en el minuto que Vercel le da a una
 * página, y de sobra en los cinco de la tarea programada.
 */
export const DRAND_TIMEOUT_MS = 8_000;

/**
 * Los estados del sorteo.
 *
 * Se guardan como texto y no como enum de Prisma a propósito: las cinco aplicaciones de la
 * suite comparten `schema.prisma`, y un enum nuevo que no exista en alguna de las cinco bases
 * rompe las escrituras de esa aplicación. Mismo criterio que `Booking.status`.
 */
export const RAFFLE_STATUSES = [
  "BORRADOR",
  "ANUNCIADO",
  "PADRON_SELLADO",
  "SORTEADO",
  "CERRADO",
  "CANCELADO",
] as const;

export type RaffleStatus = (typeof RAFFLE_STATUSES)[number];

/** Los estados de cada premio. */
export const RAFFLE_PRIZE_STATUSES = [
  "GANADO",
  "NOTIFICADO",
  "RETIRADO",
  "NO_RETIRADO",
  "ANULADO",
] as const;

export type RafflePrizeStatus = (typeof RAFFLE_PRIZE_STATUSES)[number];

/** Cuánto antes del acto se cierra el padrón, por omisión. */
export const DEFAULT_ENTRIES_CLOSE_HOURS = 24;
