/**
 * Acceso a datos del dominio Member/MemberCategory (módulo institucional
 * `members` de FotoOffice).
 *
 * Toda función acá exige `workspaceId` como primer parámetro. Las lecturas
 * puntuales (`getMember`, `getMemberCategory`) usan `findFirst({ id, workspaceId })`
 * en vez de `findUnique({ id })` a propósito: aunque alguien tenga un id de
 * otro workspace (por bug o por manipular una URL), sin el `workspaceId`
 * correcto no hay fila. Las escrituras puntuales (`updateMember`,
 * `updateMemberCategory`) usan `updateMany({ where: { id, workspaceId } })`
 * por el mismo motivo: es atómico y nunca puede tocar una fila de otro
 * workspace, a diferencia de `update({ where: { id } })`.
 * No es un framework — son funciones mínimas para no repetir el
 * `where: { workspaceId }` suelto por toda la aplicación.
 */
import { prisma } from "./client";
import type { Member, MemberCategory, MemberStatus, Prisma } from "@prisma/client";
import {
  AUDITED_MEMBER_FIELDS,
  buildMemberAuditData,
  diffMemberFields,
  hasChanges,
  type AuditedMemberField,
  type MemberAuditActor,
  type MemberChangeSet,
} from "./fotoffice-member-audit";
import {
  memberAccessWhere,
  type MemberAccessFilter,
} from "./fotoffice-member-access-filter";

/**
 * Se lanza cuando el socio cambió entre que el administrador abrió la ficha y confirmó. La
 * transacción se aborta entera: no se pisa el cambio ajeno NI se crea auditoría de algo que
 * no ocurrió. El caller la traduce a un mensaje para el usuario.
 */
export class MemberConcurrencyError extends Error {
  constructor() {
    super("MEMBER_STALE");
    this.name = "MemberConcurrencyError";
  }
}

export type CreateMemberInput = {
  memberNumber: string;
  categoryId?: string | null;
  firstName: string;
  lastName: string;
  documentType?: string | null;
  documentNumber?: string | null;
  email?: string | null;
  phone?: string | null;
  avatarUrl?: string | null;
  birthDate?: Date | null;
  address?: string | null;
  city?: string | null;
  province?: string | null;
  postalCode?: string | null;
  joinedAt?: Date;
  status?: MemberStatus;
  notes?: string | null;
  /** Vínculo opcional a una cuenta DNX ya existente. */
  userId?: number | null;
};

export type UpdateMemberInput = Partial<CreateMemberInput> & {
  leftAt?: Date | null;
};

export type MemberWithCategory = Member & { category: MemberCategory | null };

export type MemberSearchFilters = {
  search?: string;
  categoryId?: string;
  status?: MemberStatus;
  /** Estado de acceso al portal. Se resuelve en SQL para no romper la paginación. */
  access?: MemberAccessFilter;
  page?: number;
  pageSize?: number;
};

export type MemberSearchResult = {
  items: MemberWithCategory[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
};

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

export async function searchMembers(
  workspaceId: string,
  filters: MemberSearchFilters = {},
): Promise<MemberSearchResult> {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, filters.pageSize ?? DEFAULT_PAGE_SIZE));
  const search = filters.search?.trim();

  const where: Prisma.MemberWhereInput = {
    workspaceId,
    status: filters.status,
    categoryId: filters.categoryId,
    ...(search
      ? {
          OR: [
            { firstName: { contains: search, mode: "insensitive" } },
            { lastName: { contains: search, mode: "insensitive" } },
            { memberNumber: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } },
            { documentNumber: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
    ...memberAccessWhere(filters.access),
  };

  const [items, total] = await Promise.all([
    prisma.member.findMany({
      where,
      include: { category: true },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.member.count({ where }),
  ]);

  return { items, total, page, pageSize, pageCount: Math.max(1, Math.ceil(total / pageSize)) };
}

/** Tope duro de filas por exportación: evita que un workspace enorme tumbe el proceso. */
export const MEMBER_EXPORT_MAX_ROWS = 5000;

/**
 * Padrón completo (o filtrado) para exportar. Sin paginar, a diferencia de `searchMembers`,
 * que tope a 100 filas por página — una exportación de 152 socios no puede venir cortada.
 *
 * Reusa EXACTAMENTE el mismo `where` que la búsqueda de pantalla, incluido el `workspaceId`
 * obligatorio: lo que el administrador ve filtrado en la lista es lo que se lleva en el CSV,
 * y nunca puede alcanzar filas de otro workspace.
 */
export function listMembersForExport(
  workspaceId: string,
  filters: Omit<MemberSearchFilters, "page" | "pageSize"> = {},
): Promise<MemberWithCategory[]> {
  const search = filters.search?.trim();
  const where: Prisma.MemberWhereInput = {
    workspaceId,
    status: filters.status,
    categoryId: filters.categoryId,
    ...(search
      ? {
          OR: [
            { firstName: { contains: search, mode: "insensitive" } },
            { lastName: { contains: search, mode: "insensitive" } },
            { memberNumber: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } },
            { documentNumber: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
    ...memberAccessWhere(filters.access),
  };

  return prisma.member.findMany({
    where,
    include: { category: true },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    take: MEMBER_EXPORT_MAX_ROWS,
  });
}

export type MemberStatusCounts = { total: number; ACTIVE: number; SUSPENDED: number; INACTIVE: number };

export async function countMembersByStatus(workspaceId: string): Promise<MemberStatusCounts> {
  const rows = await prisma.member.groupBy({
    by: ["status"],
    where: { workspaceId },
    _count: { _all: true },
  });
  const counts: MemberStatusCounts = { total: 0, ACTIVE: 0, SUSPENDED: 0, INACTIVE: 0 };
  for (const row of rows) {
    counts[row.status] = row._count._all;
    counts.total += row._count._all;
  }
  return counts;
}

/** `findFirst`, no `findUnique`: un memberId de otro workspace nunca matchea. */
export function getMember(workspaceId: string, memberId: string): Promise<MemberWithCategory | null> {
  return prisma.member.findFirst({ where: { id: memberId, workspaceId }, include: { category: true } });
}

/**
 * Alta manual. El socio y su auditoría `CREATED` se confirman en la MISMA transacción: nunca
 * puede quedar un socio sin su evento de creación.
 */
export function createMember(
  workspaceId: string,
  input: CreateMemberInput,
  actor: MemberAuditActor,
): Promise<Member> {
  return prisma.$transaction(async (tx) => {
    const member = await tx.member.create({ data: { workspaceId, ...input } });
    await tx.memberAudit.create({
      data: buildMemberAuditData(workspaceId, member.id, {
        action: "CREATED",
        source: "MANUAL",
        actor,
        // En un alta no hay "before": el estado inicial se registra como after de cada campo.
        changes: initialChangeSet(member),
      }),
    });
    return member;
  });
}

/** Estado inicial del socio como `{ before: null, after: valor }`, solo con los campos que tienen valor. */
function initialChangeSet(member: Member): MemberChangeSet {
  const changes: MemberChangeSet = {};
  for (const field of AUDITED_MEMBER_FIELDS) {
    const value = member[field as AuditedMemberField];
    if (value === null || value === undefined || value === "") continue;
    changes[field as AuditedMemberField] = {
      before: null,
      after: value instanceof Date ? value.toISOString() : value,
    };
  }
  return changes;
}

/**
 * Import masivo: TODO o NADA. `$transaction` con un array de operaciones es
 * atómico — si cualquier `create` falla (ej. una constraint unique que
 * escapó a la validación previa por una carrera entre la validación y la
 * confirmación), Postgres revierte el batch completo, no quedan filas
 * parciales. No usar el modo callback acá: no hace falta lógica entre
 * pasos, y el modo array es más simple de razonar para "todo o nada".
 */
export function bulkCreateMembers(
  workspaceId: string,
  inputs: CreateMemberInput[],
  options: {
    actor: MemberAuditActor;
    /** Agrupa todas las auditorías de este lote. Un id por importación. */
    batchId: string;
    /** Fila del CSV que originó cada input, en el mismo orden. */
    sourceRows?: (number | null)[];
  },
): Promise<Member[]> {
  // Modo callback (no el array): hace falta el id de cada socio recién creado para su
  // auditoría. Sigue siendo TODO o NADA — si algo falla, Postgres revierte socios Y
  // auditorías juntos, nunca queda un lote a medias ni una auditoría huérfana.
  return prisma.$transaction(async (tx) => {
    const created: Member[] = [];
    for (const [index, input] of inputs.entries()) {
      const member = await tx.member.create({ data: { workspaceId, ...input } });
      await tx.memberAudit.create({
        data: buildMemberAuditData(workspaceId, member.id, {
          action: "IMPORTED",
          source: "CSV_IMPORT",
          actor: options.actor,
          changes: initialChangeSet(member),
          batchId: options.batchId,
          sourceRow: options.sourceRows?.[index] ?? null,
        }),
      });
      created.push(member);
    }
    return created;
  });
}

/** Se lanza cuando el vínculo pedido chocaría con una regla de unicidad o de estado. */
export class MemberLinkError extends Error {
  constructor(
    readonly reason:
      | "ALREADY_LINKED"
      | "USER_TAKEN"
      | "NOT_FOUND"
      | "INVITATION_INVALID"
      /** El socio no está ACTIVE: no se le emite ni se le acepta una invitación. */
      | "MEMBER_NOT_ACTIVE",
  ) {
    super(reason);
    this.name = "MemberLinkError";
  }
}

/**
 * Vincula un socio con un usuario existente. Todo en una transacción, con las mismas garantías
 * que `updateMember`: control optimista por `updatedAt` y auditoría atómica.
 *
 * La unicidad real la sostiene `@@unique([workspaceId, userId])` en la base: aunque dos
 * administradores confirmen a la vez, Postgres deja pasar solo uno.
 */
export async function linkMemberToUser(
  workspaceId: string,
  memberId: string,
  userId: number,
  options: { actor: MemberAuditActor; reason?: string | null; expectedUpdatedAt?: Date | null },
): Promise<MemberWithCategory> {
  return prisma.$transaction(async (tx) => {
    const before = await tx.member.findFirst({ where: { id: memberId, workspaceId } });
    if (!before) throw new MemberLinkError("NOT_FOUND");
    if (before.userId !== null) throw new MemberLinkError("ALREADY_LINKED");

    // Un mismo User no puede ser dos socios del MISMO workspace (sí de otros).
    const taken = await tx.member.findFirst({
      where: { workspaceId, userId },
      select: { id: true },
    });
    if (taken) throw new MemberLinkError("USER_TAKEN");

    const result = await tx.member.updateMany({
      where: { id: memberId, workspaceId, userId: null, updatedAt: options.expectedUpdatedAt ?? before.updatedAt },
      data: { userId },
    });
    if (result.count !== 1) throw new MemberConcurrencyError();

    await tx.memberAudit.create({
      data: buildMemberAuditData(workspaceId, memberId, {
        action: "USER_LINKED",
        source: "MANUAL",
        actor: options.actor,
        changes: { userId: { before: null, after: userId } },
        reason: options.reason ?? null,
      }),
    });

    const fresh = await getMemberTx(tx, workspaceId, memberId);
    if (!fresh) throw new MemberLinkError("NOT_FOUND");
    return fresh;
  });
}

/**
 * Desvincula. Conserva el `User`, su `WorkspaceMembership` y todo su historial: desvincular es
 * quitarle el acceso a ESTE socio, no borrar a la persona. Revoca de paso las invitaciones
 * pendientes, para que un enlace viejo no vuelva a vincularlo por la ventana de atrás.
 */
export async function unlinkMemberFromUser(
  workspaceId: string,
  memberId: string,
  options: { actor: MemberAuditActor; reason: string; expectedUpdatedAt?: Date | null },
): Promise<MemberWithCategory> {
  return prisma.$transaction(async (tx) => {
    const before = await tx.member.findFirst({ where: { id: memberId, workspaceId } });
    if (!before) throw new MemberLinkError("NOT_FOUND");
    if (before.userId === null) throw new MemberLinkError("NOT_FOUND");

    const previousUserId = before.userId;
    const result = await tx.member.updateMany({
      where: { id: memberId, workspaceId, updatedAt: options.expectedUpdatedAt ?? before.updatedAt },
      data: { userId: null },
    });
    if (result.count !== 1) throw new MemberConcurrencyError();

    await tx.memberInvitation.updateMany({
      where: { workspaceId, memberId, acceptedAt: null, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    await tx.memberAudit.create({
      data: buildMemberAuditData(workspaceId, memberId, {
        action: "USER_UNLINKED",
        source: "MANUAL",
        actor: options.actor,
        changes: { userId: { before: previousUserId, after: null } },
        reason: options.reason,
      }),
    });

    const fresh = await getMemberTx(tx, workspaceId, memberId);
    if (!fresh) throw new MemberLinkError("NOT_FOUND");
    return fresh;
  });
}

export type MemberInvitationRecord = {
  id: string;
  email: string;
  expiresAt: Date;
  acceptedAt: Date | null;
  revokedAt: Date | null;
  sentAt: Date | null;
  sendFailedAt: Date | null;
  createdAt: Date;
  invitedByUserId: number | null;
  acceptedByUserId: number | null;
};

/**
 * Crea una invitación. Revoca antes cualquier otra pendiente del mismo socio: una sola
 * invitación activa por socio, para que no queden dos enlaces válidos dando vueltas.
 */
export async function createMemberInvitation(
  workspaceId: string,
  memberId: string,
  input: {
    email: string;
    tokenHash: string;
    expiresAt: Date;
    invitedByUserId: number | null;
    actor: MemberAuditActor;
  },
): Promise<{ invitation: MemberInvitationRecord; resend: boolean }> {
  return prisma.$transaction(async (tx) => {
    const member = await tx.member.findFirst({ where: { id: memberId, workspaceId } });
    if (!member) throw new MemberLinkError("NOT_FOUND");
    if (member.userId !== null) throw new MemberLinkError("ALREADY_LINKED");
    // El estado se revalida dentro de la transacción: pudo cambiar entre la pantalla y el clic.
    if (member.status !== "ACTIVE") throw new MemberLinkError("MEMBER_NOT_ACTIVE");

    // Revocar las pendientes es lo que hace que "Reenviar" invalide el enlace anterior:
    // queda una sola invitación activa por socio, con un token nuevo.
    const superseded = await tx.memberInvitation.updateMany({
      where: { workspaceId, memberId, acceptedAt: null, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    const resend = superseded.count > 0;

    const invitation = await tx.memberInvitation.create({
      data: {
        workspaceId,
        memberId,
        email: input.email.trim().toLowerCase(),
        tokenHash: input.tokenHash,
        expiresAt: input.expiresAt,
        invitedByUserId: input.invitedByUserId,
      },
      select: {
        id: true, email: true, expiresAt: true, acceptedAt: true,
        revokedAt: true, sentAt: true, sendFailedAt: true,
        createdAt: true, invitedByUserId: true, acceptedByUserId: true,
      },
    });

    // La creación se audita en ESTA transacción; el envío se audita después del commit,
    // porque son dos momentos distintos y una sola acción no podría representar ambos.
    await tx.memberAudit.create({
      data: buildMemberAuditData(workspaceId, memberId, {
        action: "INVITE_CREATED",
        source: "MANUAL",
        actor: input.actor,
        reason: resend
          ? "Nueva invitación emitida; la anterior quedó sin efecto"
          : "Invitación de acceso emitida",
      }),
    });

    return { invitation, resend };
  });
}

export async function revokeMemberInvitation(
  workspaceId: string,
  memberId: string,
  invitationId: string,
  actor?: MemberAuditActor,
): Promise<{ count: number }> {
  return prisma.$transaction(async (tx) => {
    const result = await tx.memberInvitation.updateMany({
      where: { id: invitationId, workspaceId, memberId, acceptedAt: null, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    // Solo se audita una revocación que efectivamente ocurrió: revocar algo que ya no estaba
    // pendiente no es un evento, es un clic tardío.
    if (result.count === 1 && actor) {
      await tx.memberAudit.create({
        data: buildMemberAuditData(workspaceId, memberId, {
          action: "INVITE_REVOKED",
          source: "MANUAL",
          actor,
          reason: "Invitación revocada por el administrador",
        }),
      });
    }
    return result;
  });
}

/**
 * Marca el desenlace del envío, que ocurre DESPUÉS del commit de la creación.
 *
 * Separado a propósito: una invitación creada no es una invitación enviada. Mientras `sentAt`
 * sea nulo la UI no puede decir "enviada", y `sendFailedAt` habilita el reintento.
 */
export async function markMemberInvitationDelivery(
  workspaceId: string,
  memberId: string,
  invitationId: string,
  outcome: { sent: boolean; resend: boolean; detail?: string | null },
  actor: MemberAuditActor,
): Promise<void> {
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.memberInvitation.updateMany({
      where: { id: invitationId, workspaceId, memberId },
      data: outcome.sent ? { sentAt: now, sendFailedAt: null } : { sendFailedAt: now },
    });
    await tx.memberAudit.create({
      data: buildMemberAuditData(workspaceId, memberId, {
        action: outcome.sent
          ? outcome.resend
            ? "INVITE_RESENT"
            : "INVITE_SENT"
          : "INVITE_SEND_FAILED",
        source: "SYSTEM",
        actor,
        // El detalle ya viene depurado del transporte. Nunca el token ni el cuerpo del proveedor.
        reason: outcome.sent ? null : (outcome.detail ?? "No se pudo enviar el email"),
      }),
    });
  });
}

export function listMemberInvitations(
  workspaceId: string,
  memberId: string,
): Promise<MemberInvitationRecord[]> {
  return prisma.memberInvitation.findMany({
    where: { workspaceId, memberId },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true, email: true, expiresAt: true, acceptedAt: true,
      revokedAt: true, sentAt: true, sendFailedAt: true,
      createdAt: true, invitedByUserId: true, acceptedByUserId: true,
    },
  });
}

export type MemberAuditRecord = {
  id: string;
  action: string;
  source: string;
  actorUserId: number | null;
  actorLabel: string | null;
  changesJson: Prisma.JsonValue | null;
  reason: string | null;
  batchId: string | null;
  sourceRow: number | null;
  createdAt: Date;
};

/**
 * Historial de un socio, más reciente primero. Filtrado por `workspaceId` además de
 * `memberId`: un memberId de otro workspace devuelve lista vacía, nunca el historial ajeno.
 */
export function listMemberAudits(
  workspaceId: string,
  memberId: string,
  options: { take?: number } = {},
): Promise<MemberAuditRecord[]> {
  return prisma.memberAudit.findMany({
    where: { workspaceId, memberId },
    orderBy: { createdAt: "desc" },
    take: Math.min(200, Math.max(1, options.take ?? 50)),
    select: {
      id: true,
      action: true,
      source: true,
      actorUserId: true,
      actorLabel: true,
      changesJson: true,
      reason: true,
      batchId: true,
      sourceRow: true,
      createdAt: true,
    },
  });
}

/**
 * `updateMany` con `{ id, workspaceId }`: si `memberId` pertenece a otro
 * workspace, matchea 0 filas y no toca nada — nunca `update({ where: { id } })`.
 * Devuelve `null` si no matcheó (no encontrado O de otro workspace, misma respuesta).
 */
export type UpdateMemberOptions = {
  actor: MemberAuditActor;
  /** `STATUS_CHANGED` para transiciones de estado, `UPDATED` para el resto. */
  action?: "UPDATED" | "STATUS_CHANGED";
  /** Obligatorio para suspensión y baja — lo exige la capa de acciones, no esta función. */
  reason?: string | null;
  /**
   * `updatedAt` del socio tal como lo vio el administrador al abrir la pantalla. Si se pasa y
   * ya no coincide, la transacción se aborta con `MemberConcurrencyError`.
   */
  expectedUpdatedAt?: Date | null;
};

/**
 * Edición con control de concurrencia OPTIMISTA y auditoría atómica.
 *
 * El `where` del update lleva `{ id, workspaceId, updatedAt: <el leído en esta transacción> }`:
 * - `workspaceId` mantiene el aislamiento (un id de otro workspace matchea 0 filas);
 * - `updatedAt` es el testigo de concurrencia. Si otro administrador guardó primero, su
 *   escritura ya movió `updatedAt` (Prisma lo actualiza en cada write por `@updatedAt`), el
 *   update matchea 0 filas y se aborta TODO — no se pisa su cambio ni se escribe auditoría.
 *
 * Se prefirió esto a una transacción `Serializable`: no necesita reintentos, no cambia el nivel
 * de aislamiento global del proyecto, y es el MISMO patrón ya probado en el builder del sitio
 * web (`saveDraftFields` en app/actions/website.ts). Tampoco hace falta un lock SQL crudo: el
 * update condicional ya es atómico en Postgres.
 *
 * Devuelve `null` si el socio no existe o es de otro workspace (misma respuesta a propósito).
 * Lanza `MemberConcurrencyError` si existe pero cambió mientras tanto — son casos distintos y
 * el usuario necesita mensajes distintos.
 */
export async function updateMember(
  workspaceId: string,
  memberId: string,
  data: UpdateMemberInput,
  options: UpdateMemberOptions,
): Promise<MemberWithCategory | null> {
  return prisma.$transaction(async (tx) => {
    const before = await tx.member.findFirst({ where: { id: memberId, workspaceId } });
    if (!before) return null;

    const changes = diffMemberFields(before, data as Partial<Record<AuditedMemberField, unknown>>);
    // Nada cambió realmente: no se escribe, y sobre todo no se inventa un evento en el historial.
    if (!hasChanges(changes)) return getMemberTx(tx, workspaceId, memberId);

    const result = await tx.member.updateMany({
      where: {
        id: memberId,
        workspaceId,
        updatedAt: options.expectedUpdatedAt ?? before.updatedAt,
      },
      data,
    });
    // Exactamente una fila: 0 = alguien más guardó primero entre el findFirst y el update.
    if (result.count !== 1) throw new MemberConcurrencyError();

    await tx.memberAudit.create({
      data: buildMemberAuditData(workspaceId, memberId, {
        action: options.action ?? "UPDATED",
        source: "MANUAL",
        actor: options.actor,
        changes,
        reason: options.reason ?? null,
      }),
    });

    return getMemberTx(tx, workspaceId, memberId);
  });
}

/** Igual que `getMember`, pero dentro de una transacción en curso. */
function getMemberTx(
  tx: Prisma.TransactionClient,
  workspaceId: string,
  memberId: string,
): Promise<MemberWithCategory | null> {
  return tx.member.findFirst({ where: { id: memberId, workspaceId }, include: { category: true } });
}

/**
 * Solo lo mínimo para chequear duplicados antes de un import masivo — nunca
 * trae filas completas (ni datos personales) para esto.
 */
export async function listMemberIdentifiersForWorkspace(
  workspaceId: string,
): Promise<{
  memberNumbers: string[];
  documents: { documentType: string; documentNumber: string }[];
  emails: string[];
}> {
  const rows = await prisma.member.findMany({
    where: { workspaceId },
    select: { memberNumber: true, documentType: true, documentNumber: true, email: true },
  });
  return {
    memberNumbers: rows.map((r) => r.memberNumber),
    documents: rows
      .filter((r): r is typeof r & { documentType: string; documentNumber: string } =>
        Boolean(r.documentType && r.documentNumber),
      )
      .map((r) => ({ documentType: r.documentType, documentNumber: r.documentNumber })),
    /// `email` viaja en la MISMA consulta que ya se hacía: un socio con email choca
    /// contra `@@unique([workspaceId, email])` al insertar, así que el import necesita
    /// conocerlos para avisarlo en el preview y no abortar el lote entero al final.
    emails: rows
      .map((r) => r.email)
      .filter((e): e is string => Boolean(e && e.trim())),
  };
}

export function listMemberCategories(
  workspaceId: string,
  options: { onlyActive?: boolean } = {},
): Promise<MemberCategory[]> {
  return prisma.memberCategory.findMany({
    where: { workspaceId, isActive: options.onlyActive ? true : undefined },
    orderBy: { order: "asc" },
  });
}

export function getMemberCategory(workspaceId: string, categoryId: string): Promise<MemberCategory | null> {
  return prisma.memberCategory.findFirst({ where: { id: categoryId, workspaceId } });
}

export function createMemberCategory(
  workspaceId: string,
  input: { name: string; description?: string | null; order?: number },
): Promise<MemberCategory> {
  return prisma.memberCategory.create({
    data: {
      workspaceId,
      name: input.name,
      description: input.description ?? null,
      order: input.order ?? 0,
    },
  });
}

export type UpdateMemberCategoryInput = {
  name?: string;
  description?: string | null;
  order?: number;
  isActive?: boolean;
};

export async function updateMemberCategory(
  workspaceId: string,
  categoryId: string,
  data: UpdateMemberCategoryInput,
): Promise<MemberCategory | null> {
  const result = await prisma.memberCategory.updateMany({ where: { id: categoryId, workspaceId }, data });
  if (result.count === 0) return null;
  return getMemberCategory(workspaceId, categoryId);
}
