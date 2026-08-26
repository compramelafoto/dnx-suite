/**
 * Cómo cobra FotoOffice.
 *
 * `TWO_WAY` es el modelo de MercadoPago de siempre: **la institución es la que cobra**, con
 * sus propias credenciales, y la plataforma retiene su comisión con `marketplace_fee` en la
 * misma operación. Son exactamente dos partes.
 *
 * `SPLIT_1N` reparte a N receptores en una sola orden. Da más flexibilidad, pero MercadoPago
 * lo habilita **por aplicación** y además exige que cada receptor consienta. Queda escrito y
 * probado, esperando esa habilitación.
 *
 * La diferencia que importa acá: en dos vías **el cobrador es el receptor**, así que no hay
 * consentimiento que pedir ni capacidad que verificar.
 */
export type CollectionMode = "TWO_WAY" | "SPLIT_1N";

export const COLLECTION_MODE_ENV = "FOTOFFICE_MP_COLLECTION_MODE" as const;

export const DEFAULT_COLLECTION_MODE: CollectionMode = "TWO_WAY";

/**
 * Un valor que no se entiende cae en dos vías, que es el modo que funciona sin trámites
 * pendientes. Elegir 1:N por error dejaría a la institución sin poder cobrar y con un
 * mensaje sobre un consentimiento que no necesita.
 */
export function readCollectionMode(
  env: Record<string, string | undefined> = process.env,
): CollectionMode {
  const raw = env[COLLECTION_MODE_ENV]?.trim().toUpperCase();
  if (raw === "SPLIT_1N") return "SPLIT_1N";
  return DEFAULT_COLLECTION_MODE;
}

/** En dos vías no hay consentimiento: el que cobra es el que recibe. */
export function requiresSplitConsent(mode: CollectionMode): boolean {
  return mode === "SPLIT_1N";
}
