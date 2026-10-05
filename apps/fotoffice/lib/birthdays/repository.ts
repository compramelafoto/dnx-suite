import { prisma } from "@repo/db";
import { buildBirthdaysOfWeek, type BirthdayView } from "./week";

/**
 * Los cumpleaños de esta semana entre los socios activos de la institución.
 *
 * Se traen todos los que tienen fecha y se filtra en memoria: son un par de cientos de filas, y
 * comparar mes y día en SQL obliga a pelear con la zona horaria de la columna.
 */
export async function loadBirthdaysOfWeek(input: {
  workspaceId: string;
  viewerMemberId: string;
  now?: Date;
}): Promise<BirthdayView[]> {
  const socios = await prisma.member.findMany({
    where: { workspaceId: input.workspaceId, status: "ACTIVE", birthDate: { not: null } },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      birthDate: true,
      instagram: true,
      profilePhotoUrl: true,
      avatarUrl: true,
    },
  });
  return buildBirthdaysOfWeek({
    members: socios.map((s) => ({
      id: s.id,
      firstName: s.firstName,
      lastName: s.lastName,
      birthDate: s.birthDate as Date,
      instagram: s.instagram,
      photoUrl: s.profilePhotoUrl ?? s.avatarUrl ?? null,
    })),
    now: input.now ?? new Date(),
    viewerMemberId: input.viewerMemberId,
  });
}
