import { prisma } from "@repo/db";
import { isAssignmentActive } from "@/lib/permissions/levels";

/*
  La membresía de equipo que acompaña a los roles.

  Sin una fila de `WorkspaceMembership` el panel no reconoce a la persona como parte del equipo
  y `resolveModuleLevel` le da NONE, por más cargos o roles que tenga asignados. Por eso asignar
  un rol asegura una membresía STAFF, quitar el último la libera, y quien recibió un rol antes de
  tener cuenta la recibe al iniciar sesión con la cuenta vinculada.

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

/** Borra la membresía STAFF cuando ya no quedan asignaciones vigentes. Dueño/admin: siempre se conserva. */
export async function releaseStaffMembershipIfNoRoles(
  workspaceId: string,
  userId: number,
): Promise<"removed" | "kept"> {
  const rows = await prisma.workspaceRoleAssignment.findMany({
    where: {
      workspaceId,
      revokedAt: null,
      OR: [{ userId }, { member: { userId, workspaceId } }],
    },
    select: { startsAt: true, endsAt: true, revokedAt: true },
  });
  const now = new Date();
  if (rows.some((a) => isAssignmentActive(a, now))) return "kept";

  // Atómico y filtrado por rol: dueño/admin no coinciden nunca, ni siquiera si cambiaron entre medio.
  const { count } = await prisma.workspaceMembership.deleteMany({
    where: { userId, workspaceId, role: "STAFF" },
  });
  return count > 0 ? "removed" : "kept";
}

/** Asegura la membresía STAFF en cada workspace donde esta cuenta tiene una asignación vigente. Devuelve cuántas creó. */
export async function syncPendingTeamMemberships(userId: number): Promise<number> {
  const rows = await prisma.workspaceRoleAssignment.findMany({
    where: { revokedAt: null, OR: [{ userId }, { member: { userId } }] },
    select: { workspaceId: true, startsAt: true, endsAt: true, revokedAt: true },
  });
  const now = new Date();
  const workspaceIds = new Set(
    rows.filter((a) => isAssignmentActive(a, now)).map((a) => a.workspaceId),
  );
  let created = 0;
  for (const workspaceId of workspaceIds) {
    if ((await ensureStaffMembership(workspaceId, userId)) === "created") created++;
  }
  return created;
}
