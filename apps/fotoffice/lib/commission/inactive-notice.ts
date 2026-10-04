import "server-only";
import { prisma } from "@repo/db";
import { appUrl } from "@/lib/app-url";
import { loadWorkspaceEmailContext } from "@/lib/communications/load-workspace-signature";
import { sendAndLogEmail } from "@/lib/communications/send-and-log";
import { isAssignmentActive } from "@/lib/permissions/levels";
import { buildMemberInactiveWithRoleEmail } from "./emails";

/**
 * Cuando una ficha pasa a suspendida o de baja y la persona tiene un cargo o un rol vigente en
 * la Comisión directiva, avisa al dueño y a los administradores. NO revoca nada: la persona
 * conserva el cargo y sigue votando hasta que la dirección decida (diseño §12.1.3).
 */
export async function notifyAdminsIfCommissionMemberInactive(input: {
  workspaceId: string;
  memberId: string;
  newStatus: "ACTIVE" | "SUSPENDED" | "INACTIVE";
  now?: Date;
}): Promise<{ sent: number }> {
  if (input.newStatus === "ACTIVE") return { sent: 0 };
  const now = input.now ?? new Date();

  const member = await prisma.member.findFirst({
    where: { id: input.memberId, workspaceId: input.workspaceId },
    select: { firstName: true, lastName: true, userId: true },
  });
  if (!member) return { sent: 0 };

  // La persona puede estar cargada por su ficha o por su cuenta: se miran las dos.
  const owner = member.userId !== null ? [{ memberId: input.memberId }, { userId: member.userId }] : [{ memberId: input.memberId }];
  const where = { workspaceId: input.workspaceId, revokedAt: null, OR: owner };

  const [terms, assignments] = await Promise.all([
    prisma.workspaceOfficeTerm.findMany({
      where,
      select: { startsAt: true, endsAt: true, revokedAt: true, office: { select: { name: true } } },
    }),
    prisma.workspaceRoleAssignment.findMany({
      where,
      select: { startsAt: true, endsAt: true, revokedAt: true, role: { select: { name: true } } },
    }),
  ]);
  const officeNames = [...new Set(terms.filter((t) => isAssignmentActive(t, now)).map((t) => t.office.name))];
  const roleNames = [...new Set(assignments.filter((a) => isAssignmentActive(a, now)).map((a) => a.role.name))];
  if (officeNames.length === 0 && roleNames.length === 0) return { sent: 0 };

  const base = appUrl();
  if (!base) {
    console.error("[fotoffice][comision] sin URL pública: no se manda el aviso de inactivo");
    return { sent: 0 };
  }

  const recipients = await prisma.workspaceMembership.findMany({
    where: { workspaceId: input.workspaceId, role: { in: ["WORKSPACE_OWNER", "WORKSPACE_ADMIN"] } },
    select: { user: { select: { id: true, email: true } } },
  });

  const { organizationName } = await loadWorkspaceEmailContext(input.workspaceId);
  const body = buildMemberInactiveWithRoleEmail({
    institution: organizationName,
    personName: `${member.firstName} ${member.lastName}`.trim(),
    newStatus: input.newStatus,
    officeNames,
    roleNames,
    commissionUrl: `${base}/workspace/configuracion/comision`,
  });

  let sent = 0;
  for (const { user } of recipients) {
    if (!user.email) continue;
    const outcome = await sendAndLogEmail({
      to: user.email,
      templateKey: "commission-member-inactive",
      body,
      userId: user.id,
    });
    if (outcome.status === "SENT") sent += 1;
    else console.error("[fotoffice][comision] el aviso de inactivo no salió", { status: outcome.status });
  }
  return { sent };
}
