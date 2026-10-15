import "server-only";
import { prisma } from "@repo/db";
import { leerAnotaciones, sumarAnotacion, type Anotacion } from "./borrador";
import { DIAS_DE_RETENCION } from "./limpieza";
import type { ParchePerfil } from "./motor";

/**
 * Dónde vive el borrador del perfil de precios, sin migración: una fila de `BotAction` por persona y
 * workspace, con `toolName = "borrador_perfil_de_precios"`. Por qué esa tabla:
 * - ya separa por `platform` ("FOTOFFICE:<workspaceId>") y `userId`, y guarda JSON (`input`);
 * - la limpieza de 90 días (`limpieza.ts`) ya borra las acciones de FOTOFFICE por `createdAt`: cada
 *   anotación corre `createdAt` a ahora, así el borrador vence a los 90 días sin movimiento, igual
 *   que las conversaciones;
 * - CLF ya usa filas EXECUTED como registro (`registrarAccionComprador`).
 * Nace EXECUTED y sin `decidedAt`: «Confirmar» sólo toma PENDING y «Deshacer» pide `decidedAt` y una
 * herramienta de escritura con ese nombre (no existe), así que nadie la puede ejecutar ni deshacer.
 */
export const TOOL_BORRADOR = "borrador_perfil_de_precios";
const RETENCION_MS = DIAS_DE_RETENCION * 24 * 60 * 60 * 1000;

export type RefBorrador = { plataforma: string; userId: number };

const donde = (r: RefBorrador) => ({ platform: r.plataforma, userId: r.userId, toolName: TOOL_BORRADOR });

export async function leerBorrador(r: RefBorrador): Promise<Anotacion[]> {
  const fila = await prisma.botAction.findFirst({ where: donde(r), orderBy: { createdAt: "desc" }, select: { input: true } });
  return leerAnotaciones(fila?.input ?? null);
}

/** Suma una anotación. Serializado por persona y workspace (dos turnos a la vez no se pisan). */
export async function anotarEnBorrador(r: RefBorrador, parche: ParchePerfil, ahora: Date = new Date()): Promise<Anotacion[]> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${TOOL_BORRADOR}:${r.plataforma}:${r.userId}`}))`;
    const fila = await tx.botAction.findFirst({ where: donde(r), orderBy: { createdAt: "desc" }, select: { id: true, input: true } });
    const anotaciones = sumarAnotacion(leerAnotaciones(fila?.input ?? null), parche, ahora);
    const datos = {
      input: { anotaciones } as object,
      createdAt: ahora,
      expiresAt: new Date(ahora.getTime() + RETENCION_MS),
    };
    if (fila) await tx.botAction.update({ where: { id: fila.id }, data: datos });
    else {
      await tx.botAction.create({
        data: {
          ...datos,
          platform: r.plataforma,
          userId: r.userId,
          toolName: TOOL_BORRADOR,
          summary: "Borrador del perfil de precios (DNX Bot, sin guardar)",
          status: "EXECUTED",
        },
      });
    }
    return anotaciones;
  });
}

/** Tras guardar el perfil: borra lo anotado hasta `hasta` (lo anotado después, si hay, queda). */
export async function limpiarBorrador(r: RefBorrador, hasta: Date): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${TOOL_BORRADOR}:${r.plataforma}:${r.userId}`}))`;
    const fila = await tx.botAction.findFirst({ where: donde(r), orderBy: { createdAt: "desc" }, select: { id: true, input: true } });
    if (!fila) return;
    const quedan = leerAnotaciones(fila.input).filter((a) => Date.parse(a.en) > hasta.getTime());
    if (quedan.length === 0) await tx.botAction.deleteMany({ where: donde(r) });
    else await tx.botAction.update({ where: { id: fila.id }, data: { input: { anotaciones: quedan } as object } });
  });
}
