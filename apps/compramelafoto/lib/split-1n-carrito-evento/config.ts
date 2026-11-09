import type { PilotoConfig } from "../split-1n-piloto/config";

/**
 * Carrito de evento: fotos de varios álbumes (varios fotógrafos) de un mismo evento, un solo
 * pago con tarjeta y Mercado Pago reparte en el momento (Split 1:N).
 *
 * Apagado por defecto. Se enciende evento por evento y sólo funciona con el piloto Split 1:N
 * encendido, porque usa su token, su cuenta cobradora y su mapa de receptores. Como el piloto,
 * nunca lanza: una variable mal escrita deja el carrito apagado, que es el lado seguro.
 */
export const CARRITO_FLAG = "DNX_CLF_SPLIT_1N_CARRITO_EVENTO_ENABLED" as const;

/** Receptores por orden contando la plataforma, mientras Mercado Pago no confirme el máximo. */
export const MAX_RECEPTORES_DEFECTO = 10;
/** `MERCADO_PAGO_SPLIT_1N_MAX_PARTNERS` (10 socios) más la plataforma. */
const MAX_RECEPTORES_TECHO = 11;
const MAX_RECEPTORES_PISO = 2;

export type CarritoConfig = {
  enabled: boolean;
  eventIds: Set<number>;
  /** Tope de receptores por orden, contando la plataforma. */
  maxReceptores: number;
};

function enteroPositivo(raw: string): number | null {
  const n = Number(raw.trim());
  return Number.isInteger(n) && n > 0 ? n : null;
}

function leerMaxReceptores(raw: string | undefined): number {
  const n = enteroPositivo(raw ?? "");
  if (n == null) return MAX_RECEPTORES_DEFECTO;
  return Math.min(MAX_RECEPTORES_TECHO, Math.max(MAX_RECEPTORES_PISO, n));
}

export function resolveCarritoConfig(env: NodeJS.ProcessEnv = process.env): CarritoConfig {
  const eventIds = new Set<number>();
  for (const parte of (env.DNX_CLF_SPLIT_1N_CARRITO_EVENTO_IDS ?? "").split(",")) {
    const id = enteroPositivo(parte);
    if (id != null) eventIds.add(id);
  }
  return {
    enabled: env[CARRITO_FLAG]?.trim().toLowerCase() === "true",
    eventIds,
    maxReceptores: leerMaxReceptores(env.DNX_CLF_SPLIT_1N_MAX_RECEPTORES),
  };
}

/** ¿El evento muestra el carrito y cobra por grupo? */
export function carritoActivoParaEvento(
  carrito: CarritoConfig,
  piloto: PilotoConfig,
  eventId: number | null | undefined,
): boolean {
  return carrito.enabled && piloto.enabled && eventId != null && carrito.eventIds.has(eventId);
}
