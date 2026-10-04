import "server-only";
import { prisma } from "@repo/db";
import { hashInvitationToken } from "@/lib/members/invitation-tokens";

/**
 * El acceso que corresponde al enlace del aula, o null.
 *
 * Se busca por el hash: el token crudo nunca toca la base. Un token con forma imposible ni
 * siquiera consulta.
 */
export async function buscarAccesoPorToken(token: string) {
  if (!token || token.length < 20 || token.length > 100) return null;
  return prisma.courseAccess.findUnique({
    where: { tokenHash: hashInvitationToken(token) },
    include: {
      enrollment: { select: { id: true, name: true, dni: true, email: true } },
      course: {
        select: {
          id: true,
          title: true,
          slug: true,
          completionPercent: true,
          workspace: { select: { id: true } },
          lessons: {
            orderBy: { sortOrder: "asc" },
            select: {
              id: true,
              title: true,
              description: true,
              durationSeconds: true,
              videoStatus: true,
              videoUid: true,
              sortOrder: true,
            },
          },
        },
      },
      progress: { select: { lessonId: true, completedAt: true, lastPositionSeconds: true } },
    },
  });
}

export type AccesoDelAula = NonNullable<Awaited<ReturnType<typeof buscarAccesoPorToken>>>;
