import "server-only";
import { Prisma, prisma } from "@repo/db";

/**
 * El historial del módulo.
 *
 * `actorLabel` se guarda aparte de la FK a propósito, igual que en `MemberAudit`: el historial
 * tiene que seguir entendiéndose dentro de dos años, aunque quien hizo el cambio se haya
 * cambiado el nombre o su usuario se haya eliminado. Nunca guarda tokens ni credenciales.
 *
 * Acepta una transacción porque casi siempre el evento y el cambio que describe tienen que
 * ocurrir juntos: un estado que cambió sin su fila de historial es una laguna que después no
 * se puede reconstruir.
 */
export type CoverageEntityType =
  | "REQUEST"
  | "COVERAGE"
  | "CALL"
  | "APPLICATION"
  | "ASSIGNMENT"
  | "DELIVERABLE";

/**
 * `ENLACE_REEMITIDO` registra que se emitió un enlace de seguimiento nuevo, y **no** que el
 * correo llegó: el evento se escribe dentro de la transacción que rota el token, y el envío
 * ocurre después y afuera. Si se usara `EMAIL_ENVIADO`, un correo que falla dejaría el historial
 * afirmando algo que no pasó. El desenlace del envío vive en `SentEmailLog`, como el del resto
 * de los correos del módulo.
 *
 * Nunca guarda el token crudo: el enlace no entra en la nota del evento.
 */
export type CoverageEventType =
  | "CREADA"
  | "ESTADO_CAMBIADO"
  | "NOTA"
  | "INFO_PEDIDA"
  | "INFO_RESPONDIDA"
  | "EMAIL_ENVIADO"
  | "ENLACE_REEMITIDO";

export async function recordEvent(
  tx: Prisma.TransactionClient | typeof prisma,
  input: {
    workspaceId: string;
    entityType: CoverageEntityType;
    entityId: string;
    type: CoverageEventType;
    fromStatus?: string | null;
    toStatus?: string | null;
    actorUserId?: number | null;
    /** Cómo se llamaba quien lo hizo EN ESE MOMENTO. `null` para el sistema. */
    actorLabel?: string | null;
    note?: string | null;
  },
): Promise<void> {
  await tx.coverageEvent.create({
    data: {
      workspaceId: input.workspaceId,
      entityType: input.entityType,
      entityId: input.entityId,
      type: input.type,
      fromStatus: input.fromStatus ?? null,
      toStatus: input.toStatus ?? null,
      actorUserId: input.actorUserId ?? null,
      actorLabel: input.actorLabel ?? null,
      note: input.note ?? null,
    },
  });
}

/** El historial de una entidad, lo más reciente primero. */
export async function listEvents(input: {
  workspaceId: string;
  entityType: CoverageEntityType;
  entityId: string;
}) {
  return prisma.coverageEvent.findMany({
    where: {
      workspaceId: input.workspaceId,
      entityType: input.entityType,
      entityId: input.entityId,
    },
    orderBy: { createdAt: "desc" },
  });
}
