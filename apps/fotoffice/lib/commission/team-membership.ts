import { prisma } from "@repo/db";
import { isAssignmentActive } from "@/lib/permissions/levels";

/*
  La membresía de equipo que acompaña a los roles.

  Sin una fila de `WorkspaceMembership` el panel no reconoce a la persona como parte del equipo
  y `resolveModuleLevel` le da NONE, por más cargos o roles que tenga asignados. Por eso asignar
  un rol asegura una membresía STAFF, quitar el último la libera, y quien recibió un rol antes de
  tener cuenta la recibe al iniciar sesión con la cuenta vinculada (y quien ya no tiene ninguno
  vigente la pierde ahí mismo).

  A dueño y admin nunca se los toca: ni se crean, ni se cambian, ni se borran desde acá.
*/

const byTarget = (workspaceId: string, userId: number) => ({
  userId_workspaceId: { userId, workspaceId },
});

/** Crea la membresía STAFF si no existe. Si existe (cualquier rol) no se toca. */
export async function ensureStaffMembership(
  workspaceId: string,
  userId: number,
): Promise<"created" | "kept"> {
  const existing = await prisma.workspaceMembership.findUnique({
    where: byTarget(workspaceId, userId),
    select: { role: true },
  });
  if (existing) return "kept";
  // `update: {}`: si otra petición la creó entre medio, no se pisa el rol de nadie.
  await prisma.workspaceMembership.upsert({
    where: byTarget(workspaceId, userId),
    update: {},
    create: { userId, workspaceId, role: "STAFF" },
  });
  return "created";
}

/** Borra la membresía STAFF. Atómico y filtrado por rol: dueño/admin no coinciden nunca, ni siquiera si cambiaron entre medio. */
async function deleteStaffMembership(workspaceId: string, userId: number): Promise<"removed" | "kept"> {
  const { count } = await prisma.workspaceMembership.deleteMany({
    where: { userId, workspaceId, role: "STAFF" },
  });
  return count > 0 ? "removed" : "kept";
}

/** ¿Tiene esta cuenta, en este workspace, alguna asignación vigente HOY (por cuenta o por su ficha de socio)? */
async function hasActiveAssignment(workspaceId: string, userId: number, now: Date): Promise<boolean> {
  const rows = await prisma.workspaceRoleAssignment.findMany({
    where: {
      workspaceId,
      revokedAt: null,
      OR: [{ userId }, { member: { userId, workspaceId } }],
    },
    select: { startsAt: true, endsAt: true, revokedAt: true },
  });
  return rows.some((a) => isAssignmentActive(a, now));
}

/** Borra la membresía STAFF cuando ya no quedan asignaciones vigentes. Dueño/admin: siempre se conserva. */
export async function releaseStaffMembershipIfNoRoles(
  workspaceId: string,
  userId: number,
): Promise<"removed" | "kept"> {
  if (await hasActiveAssignment(workspaceId, userId, new Date())) return "kept";
  return deleteStaffMembership(workspaceId, userId);
}

/**
 * Deja la membresía acorde a los roles de HOY, para alguien que tiene o tuvo roles:
 * con alguno vigente la asegura; si todos son futuros, vencidos o revocados, la libera.
 * Un rol que empieza más adelante no da membresía todavía: la crea el inicio de sesión cuando empiece.
 */
export async function syncStaffMembershipWithRoles(
  workspaceId: string,
  userId: number,
): Promise<"created" | "kept" | "removed"> {
  if (await hasActiveAssignment(workspaceId, userId, new Date())) {
    return ensureStaffMembership(workspaceId, userId);
  }
  return deleteStaffMembership(workspaceId, userId);
}

/**
 * Tras desvincular una ficha de socio de su cuenta: si esa ficha tenía roles en el workspace, la
 * cuenta los perdió con la desvinculación y no tiene que volver a la compatibilidad de STAFF.
 * Si la cuenta conserva otro rol vigente propio, la membresía queda.
 */
export async function releaseAfterMemberUnlink(
  workspaceId: string,
  memberId: string,
  previousUserId: number,
): Promise<"removed" | "kept"> {
  const had = await prisma.workspaceRoleAssignment.findMany({
    where: { workspaceId, memberId },
    select: { id: true },
    take: 1,
  });
  if (had.length === 0) return "kept";
  return releaseStaffMembershipIfNoRoles(workspaceId, previousUserId);
}

/**
 * Al iniciar sesión (o vincular la cuenta): en cada workspace donde esta cuenta tiene o tuvo roles,
 * asegura la membresía STAFF si hay alguno vigente hoy y la libera si ya no queda ninguno (el ex
 * tesorero con el rol vencido no conserva el acceso). Devuelve cuántas creó.
 *
 * Quien nunca tuvo roles no aparece en la consulta y no se toca; a dueño y admin el borrado no los
 * alcanza porque filtra por STAFF.
 */
export async function syncPendingTeamMemberships(userId: number): Promise<number> {
  const rows = await prisma.workspaceRoleAssignment.findMany({
    // Sin filtrar revocadas: hace falta saber quién TUVO roles para liberarle la membresía.
    where: { OR: [{ userId }, { member: { userId } }] },
    select: {
      workspaceId: true,
      userId: true,
      startsAt: true,
      endsAt: true,
      revokedAt: true,
      member: { select: { userId: true, workspaceId: true } },
    },
  });
  const now = new Date();
  const hadRoles = new Set<string>();
  const active = new Set<string>();
  for (const a of rows) {
    // Una fila anclada a una ficha cuenta sólo si la ficha es de ESE workspace y de esta cuenta.
    const mine =
      a.userId === userId ||
      (a.member !== null && a.member.userId === userId && a.member.workspaceId === a.workspaceId);
    if (!mine) continue;
    hadRoles.add(a.workspaceId);
    if (isAssignmentActive(a, now)) active.add(a.workspaceId);
  }

  let created = 0;
  for (const workspaceId of hadRoles) {
    if (active.has(workspaceId)) {
      if ((await ensureStaffMembership(workspaceId, userId)) === "created") created++;
    } else {
      await deleteStaffMembership(workspaceId, userId);
    }
  }
  return created;
}
