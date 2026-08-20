/**
 * Historial inmutable de operaciones sobre socios.
 *
 * Este módulo NO expone update ni delete a propósito: una fila de `MemberAudit` se escribe
 * una vez y no se toca nunca más. Tampoco expone un `create` suelto — las auditorías se
 * crean SIEMPRE desde `fotoffice-members.ts`, dentro de la misma transacción que la
 * operación que las origina, para que no pueda existir una sin la otra.
 */
import type { Member, MemberAuditAction, MemberAuditSource, Prisma } from "@prisma/client";

/** Campos del socio que se auditan. Deliberadamente NO incluye id/workspaceId/createdAt/updatedAt: son técnicos. */
export const AUDITED_MEMBER_FIELDS = [
  "memberNumber",
  "categoryId",
  "firstName",
  "lastName",
  "documentType",
  "documentNumber",
  "email",
  "phone",
  "avatarUrl",
  "birthDate",
  "address",
  "city",
  "province",
  "postalCode",
  "joinedAt",
  "leftAt",
  "status",
  "notes",
  "userId",
] as const;

export type AuditedMemberField = (typeof AUDITED_MEMBER_FIELDS)[number];

export type MemberFieldChange = { before: unknown; after: unknown };
export type MemberChangeSet = Partial<Record<AuditedMemberField, MemberFieldChange>>;

/**
 * Normaliza SOLO para comparar — nunca para guardar. Sin esto, el historial se llenaría de
 * "cambios" que no cambian nada real: `null` vs `""`, un espacio de más, un email escrito en
 * mayúsculas, o una fecha que es el mismo instante en otro objeto Date.
 */
function normalizeForCompare(field: AuditedMemberField, value: unknown): unknown {
  if (value === undefined || value === null) return null;
  if (value instanceof Date) return value.getTime();
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "") return null; // "" y null son lo mismo: ausencia de dato
    // El email se compara sin distinguir mayúsculas, igual criterio que el import CSV.
    return field === "email" ? trimmed.toLowerCase() : trimmed;
  }
  return value;
}

/**
 * Devuelve SOLO los campos con una diferencia real. Si no hay ninguno, devuelve un objeto
 * vacío y el caller no debe crear auditoría: una operación que no cambió nada no es un evento.
 */
export function diffMemberFields(
  before: Pick<Member, AuditedMemberField>,
  after: Partial<Record<AuditedMemberField, unknown>>,
): MemberChangeSet {
  const changes: MemberChangeSet = {};
  for (const field of AUDITED_MEMBER_FIELDS) {
    // Un campo que el caller no mandó no se toca — no es "cambió a null".
    if (!(field in after)) continue;
    const beforeRaw = before[field];
    const afterRaw = after[field];
    if (normalizeForCompare(field, beforeRaw) === normalizeForCompare(field, afterRaw)) continue;
    changes[field] = {
      before: serializeForAudit(beforeRaw),
      after: serializeForAudit(afterRaw),
    };
  }
  return changes;
}

/** Las fechas se guardan como ISO para que el JSON del historial sea legible y estable. */
function serializeForAudit(value: unknown): unknown {
  if (value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  return value;
}

export function hasChanges(changes: MemberChangeSet): boolean {
  return Object.keys(changes).length > 0;
}

/**
 * Datos del actor que ejecuta la operación. `label` es un snapshot legible tomado en el
 * momento: el historial tiene que seguir entendiéndose aunque después ese usuario cambie de
 * nombre, se desactive o se elimine (la FK queda en null, el label sobrevive).
 */
export type MemberAuditActor = {
  userId: number | null;
  label: string | null;
};

export type MemberAuditEntry = {
  action: MemberAuditAction;
  source: MemberAuditSource;
  actor: MemberAuditActor;
  changes?: MemberChangeSet;
  reason?: string | null;
  batchId?: string | null;
  sourceRow?: number | null;
};

/** Arma el `data` de una fila de auditoría. No escribe: el caller lo hace dentro de su transacción. */
export function buildMemberAuditData(
  workspaceId: string,
  memberId: string,
  entry: MemberAuditEntry,
): Prisma.MemberAuditUncheckedCreateInput {
  return {
    workspaceId,
    memberId,
    action: entry.action,
    source: entry.source,
    actorUserId: entry.actor.userId,
    actorLabel: entry.actor.label,
    changesJson: entry.changes && hasChanges(entry.changes) ? (entry.changes as Prisma.InputJsonValue) : undefined,
    reason: entry.reason ?? null,
    batchId: entry.batchId ?? null,
    sourceRow: entry.sourceRow ?? null,
  };
}
