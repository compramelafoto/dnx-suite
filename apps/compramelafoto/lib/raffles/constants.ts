/**
 * Sorteos de CompraMeLaFoto entre los fotógrafos que vendieron.
 *
 * Es el motor verificable de FOTOFFICE (`apps/fotoffice/lib/raffles`) copiado y adaptado: la
 * extracción (`draw.ts`) y la lectura de drand (`drand.ts`) son las mismas; lo que cambia es
 * quién entra. Allá, socios con la cuota al día; acá, fotógrafos con ventas pagadas en el
 * período del sorteo.
 *
 * Se copió en vez de compartir un paquete para no tocar el módulo de FOTOFFICE, que está en
 * producción con sorteos reales y cuya verificación no se puede romper.
 */

export const RAFFLES_TIME_ZONE = "America/Argentina/Buenos_Aires";

/** quicknet: cadena *unchained* de drand, un valor cada 3 segundos. */
export const DRAND_DEFAULT_CHAIN_HASH =
  "52db9ba70e0cc0f6eaf7803dd07447a1f5477735fd3f661792ba94600c84e971";

/** Se consultan DOS y tienen que coincidir: un solo servidor sería un punto único de confianza. */
export const DRAND_MIRRORS = [
  "https://drand.cloudflare.com",
  "https://api.drand.sh",
  "https://api2.drand.sh",
  "https://api3.drand.sh",
] as const;

export const DRAND_TIMEOUT_MS = 8_000;

export const RAFFLE_STATUSES = [
  "BORRADOR",
  "ANUNCIADO",
  "PADRON_SELLADO",
  "SORTEADO",
  "CERRADO",
  "CANCELADO",
] as const;
export type RaffleStatus = (typeof RAFFLE_STATUSES)[number];

export const RAFFLE_PRIZE_STATUSES = [
  "GANADO",
  "NOTIFICADO",
  "ENTREGADO",
  "NO_RETIRADO",
  "ANULADO",
] as const;
export type RafflePrizeStatus = (typeof RAFFLE_PRIZE_STATUSES)[number];

export const RAFFLE_KINDS = ["MENSUAL", "MANUAL"] as const;
export type RaffleKind = (typeof RAFFLE_KINDS)[number];

/** Mínimo entre el cierre del padrón y el acto: la huella tiene que estar publicada antes. */
export const MIN_HOURS_BETWEEN_CLOSE_AND_DRAW = 24;

export const STATUS_LABELS: Record<RaffleStatus, string> = {
  BORRADOR: "Borrador",
  ANUNCIADO: "Anunciado",
  PADRON_SELLADO: "Padrón cerrado",
  SORTEADO: "Sorteado",
  CERRADO: "Cerrado",
  CANCELADO: "Cancelado",
};

export const PRIZE_STATUS_LABELS: Record<RafflePrizeStatus, string> = {
  GANADO: "Ganado",
  NOTIFICADO: "Avisado",
  ENTREGADO: "Entregado",
  NO_RETIRADO: "No retirado",
  ANULADO: "Anulado",
};
