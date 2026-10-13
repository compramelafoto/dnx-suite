import "server-only";
import { prisma } from "@repo/db";
import { PREFIJO_PLATAFORMA } from "./config";

/**
 * Retención de DNX Bot en FOTOFFICE (spec §7): las conversaciones guardan lo que escribe el
 * fotógrafo (incluidos sus gastos personales). Se borran a los 90 días sin movimiento, con sus
 * mensajes (en cascada) y las acciones de esa época (que guardan la entrada de cada propuesta).
 * Sólo `platform` "FOTOFFICE:…": las de CLF no se tocan. El uso diario y los incidentes quedan
 * (no tienen texto de nadie).
 */
export const DIAS_DE_RETENCION = 90;
const DIA_MS = 24 * 60 * 60 * 1000;

export async function borrarConversacionesViejas(ahora: Date = new Date()): Promise<{ conversaciones: number; acciones: number }> {
  const corte = new Date(ahora.getTime() - DIAS_DE_RETENCION * DIA_MS);
  const deFotoffice = { startsWith: PREFIJO_PLATAFORMA };
  const conversaciones = await prisma.botConversation.deleteMany({ where: { platform: deFotoffice, updatedAt: { lt: corte } } });
  const acciones = await prisma.botAction.deleteMany({ where: { platform: deFotoffice, createdAt: { lt: corte } } });
  return { conversaciones: conversaciones.count, acciones: acciones.count };
}
