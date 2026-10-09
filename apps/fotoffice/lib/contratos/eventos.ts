import "server-only";
import { prisma, type Prisma } from "@repo/db";
import type { TipoEventoContrato } from "./constantes";

/**
 * Bitácora del contrato (`FotofficeContratoEvento`). Guarda sólo códigos y números: nunca nombres,
 * correos, textos ni códigos de verificación (el `data` es JSON chico y plano).
 */
type Cliente = Pick<Prisma.TransactionClient, "fotofficeContratoEvento">;

export type DatosEvento = Record<string, string | number | boolean | null>;

export async function registrarEvento(
  cliente: Cliente,
  e: { workspaceId: string; contratoId: string; tipo: TipoEventoContrato; actorUserId?: number | null; firmanteId?: string | null; data?: DatosEvento },
): Promise<void> {
  await cliente.fotofficeContratoEvento.create({
    data: {
      workspaceId: e.workspaceId,
      contratoId: e.contratoId,
      type: e.tipo,
      firmanteId: e.firmanteId ?? null,
      actorUserId: e.actorUserId ?? null,
      ...(e.data ? { data: e.data as Prisma.InputJsonValue } : {}),
    },
    select: { id: true },
  });
}

/** Los eventos de un contrato, del más viejo al más nuevo (sin permisos: lo llama código ya autorizado). */
export async function listarEventos(workspaceId: string, contratoId: string, limite = 200) {
  return prisma.fotofficeContratoEvento.findMany({
    where: { workspaceId, contratoId },
    orderBy: [{ createdAt: "asc" }],
    take: limite,
    select: { id: true, type: true, firmanteId: true, actorUserId: true, data: true, createdAt: true },
  });
}
