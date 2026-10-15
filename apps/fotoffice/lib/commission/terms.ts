import "server-only";
import { prisma } from "@repo/db";
import { isAssignmentActive } from "@/lib/permissions/levels";

/**
 * Quiénes integran hoy la Comisión directiva y quiénes votan (diseño de Roles §12.6).
 *
 * Gobierno lo usa para la votación, los asistentes de las reuniones y los avisos. El estado del
 * socio NO se mira a propósito: un integrante inactivo sigue en su cargo y sigue votando hasta
 * que la comisión decida otra cosa (§12.1.3); el admin ya recibió el aviso.
 */

export type OfficeHolder = {
  termId: string;
  officeId: string;
  officeName: string;
  votes: boolean;
  memberId: string | null;
  userId: number | null;
  displayName: string;
  email: string | null;
  startsAt: Date | null;
  endsAt: Date | null;
};

export async function listActiveOfficeHolders(workspaceId: string, now: Date = new Date()): Promise<OfficeHolder[]> {
  const rows = await prisma.workspaceOfficeTerm.findMany({
    where: { workspaceId, revokedAt: null, office: { archivedAt: null } },
    select: {
      id: true,
      officeId: true,
      memberId: true,
      userId: true,
      startsAt: true,
      endsAt: true,
      revokedAt: true,
      office: { select: { name: true, votes: true, order: true } },
      member: { select: { firstName: true, lastName: true, email: true, userId: true } },
      user: { select: { name: true, email: true } },
    },
  });

  // El orden del cargo sólo sirve para ordenar: va al lado del titular y no adentro.
  return rows
    .filter((r) => isAssignmentActive(r, now))
    .map((r) => ({
      order: r.office.order,
      holder: {
        termId: r.id,
        officeId: r.officeId,
        officeName: r.office.name,
        votes: r.office.votes,
        memberId: r.memberId,
        userId: r.userId ?? r.member?.userId ?? null,
        displayName: r.member
          ? `${r.member.firstName} ${r.member.lastName}`.trim()
          : (r.user?.name?.trim() || r.user?.email || "Sin nombre"),
        email: r.member?.email ?? r.user?.email ?? null,
        startsAt: r.startsAt,
        endsAt: r.endsAt,
      } satisfies OfficeHolder,
    }))
    .sort((a, b) => a.order - b.order || a.holder.displayName.localeCompare(b.holder.displayName, "es"))
    .map((x) => x.holder);
}

export async function canVote(userId: number, workspaceId: string, now: Date = new Date()): Promise<boolean> {
  const holders = await listActiveOfficeHolders(workspaceId, now);
  return holders.some((h) => h.votes && h.userId === userId);
}
