import "server-only";
import { prisma, Prisma } from "@repo/db";
import type { ProjectEventType } from "./constants";

/**
 * El historial del proyecto (diseño §12). Nada se borra: toda acción deja una fila.
 *
 * `actorLabel` es una instantánea del nombre, como en Sorteos: el historial tiene que leerse igual
 * aunque esa persona cambie de nombre o su usuario se elimine. Acepta un cliente de transacción
 * para que el evento y el cambio que describe entren o salgan juntos.
 */

type ClienteEscritura = Prisma.TransactionClient | typeof prisma;

export async function recordProjectEvent(
  cliente: ClienteEscritura,
  input: {
    projectId: string;
    type: ProjectEventType;
    actorUserId: number | null;
    actorLabel: string;
    data?: Record<string, unknown> | null;
    taskId?: string | null;
  },
): Promise<void> {
  await cliente.govProjectEvent.create({
    data: {
      projectId: input.projectId,
      type: input.type,
      actorUserId: input.actorUserId,
      actorLabel: input.actorLabel,
      data: (input.data ?? undefined) as Prisma.InputJsonValue | undefined,
      taskId: input.taskId ?? null,
    },
  });
}
