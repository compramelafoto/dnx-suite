import { prisma } from "@/lib/prisma";

/** Fila de `SystemSettings` que dice en qué álbumes aparece DNX Bot para compradores. */
export const BUYERS_PILOT_KEY = "dnx_bot_buyers_pilot";
/** Mensajes por día: visitante sin verificar, verificado (código o sesión) y por IP. */
export const LIMITES_COMPRADOR = { visitantePorDia: 20, verificadoPorDia: 40, ipPorDia: 60 } as const;
/** El bot de compradores se corta solo al llegar a este porcentaje del tope mensual compartido. */
export const PORCENTAJE_TOPE_COMPRADORES = 80;
export const MAX_ITERACIONES_COMPRADOR = 5;

export type BuyerBotConfig = { enabled: boolean; effort: "low"; maxIterations: number };

/** Encendido sólo con los dos interruptores: el general del bot y el de compradores. */
export function readBuyerBotConfig(): BuyerBotConfig {
  return {
    enabled: process.env.CLF_BOT_ENABLED?.trim() === "1" && process.env.CLF_BOT_BUYERS_ENABLED?.trim() === "1",
    effort: "low",
    maxIterations: MAX_ITERACIONES_COMPRADOR,
  };
}

/** `null` = apagado en todos lados. */
export type AlcanceCompradores = { todos: true } | { todos: false; albumIds: number[] } | null;

/** No mira los interruptores de entorno: eso lo decide quien llama. */
export async function leerPilotoCompradores(): Promise<AlcanceCompradores> {
  let row;
  try {
    row = await prisma.systemSettings.findUnique({ where: { key: BUYERS_PILOT_KEY } });
  } catch (e) {
    console.error("[bot comprador] no se pudo leer el piloto; bot apagado", e);
    return null;
  }
  if (!row || !row.isActive) return null;
  try {
    const p = JSON.parse(row.value) as { soloPiloto?: boolean; albumIds?: unknown };
    if (p.soloPiloto === false) return { todos: true };
    if (!Array.isArray(p.albumIds)) return null;
    return { todos: false, albumIds: p.albumIds.filter((n): n is number => Number.isInteger(n)) };
  } catch {
    return null;
  }
}

/** Las páginas sin álbum (`albumId` null) sólo tienen bot cuando está para todos. */
export function compradorHabilitado(alcance: AlcanceCompradores, albumId: number | null): boolean {
  if (!alcance) return false;
  if (alcance.todos) return true;
  return albumId !== null && alcance.albumIds.includes(albumId);
}
