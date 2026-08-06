import { prisma } from "@repo/db";

export type PublicHomeContestCard = {
  slug: string;
  title: string;
  organizerName: string;
  coverImageUrl: string | null;
  submissionDeadline: Date | null;
  startAt: Date | null;
  categoriesCount: number;
  statusLabel: "Inscripciones abiertas" | "Próximamente" | "Cerrado";
};

function getStatusLabel(now: Date, startAt: Date | null, deadline: Date | null): PublicHomeContestCard["statusLabel"] {
  if (deadline && deadline.getTime() < now.getTime()) return "Cerrado";
  if (startAt && startAt.getTime() > now.getTime()) return "Próximamente";
  return "Inscripciones abiertas";
}

export async function listPublicHomeContests(limit = 6): Promise<PublicHomeContestCard[]> {
  try {
    const now = new Date();
    const contests = await prisma.fotorankContest.findMany({
      where: {
        visibility: "PUBLIC",
        status: { in: ["PUBLISHED", "ACTIVE"] },
      },
      include: {
        organization: { select: { name: true } },
        categories: { where: { status: "ACTIVE" }, select: { id: true } },
      },
      orderBy: [{ submissionDeadline: "asc" }, { createdAt: "desc" }],
      take: limit * 2,
    });

    return contests
      .map((c) => ({
        slug: c.slug,
        title: c.title,
        organizerName: c.organization.name,
        coverImageUrl: c.coverImageUrl,
        submissionDeadline: c.submissionDeadline,
        startAt: c.startAt,
        categoriesCount: c.categories.length,
        statusLabel: getStatusLabel(now, c.startAt, c.submissionDeadline),
      }))
      .filter((c) => c.statusLabel !== "Cerrado")
      .slice(0, limit);
  } catch {
    // Home pública: degradar a lista vacía si no hay DB (preview / build local).
    return [];
  }
}
