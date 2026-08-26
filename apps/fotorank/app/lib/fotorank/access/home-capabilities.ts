/**
 * Resolución de capacidades post-login (ETAPA 09B).
 * Una sola identidad User → destinos y secciones del hub personal.
 * Jurado: detectado por FotorankJudgeAccount con el mismo email (cuenta existente).
 */
import { prisma } from "@repo/db";

export type HomeCapabilityKind =
  | "participant"
  | "organizer"
  | "jury"
  | "superAdmin"
  | "none";

export type HomeParticipationSummary = {
  id: string;
  contestTitle: string;
  contestSlug: string;
  status: string;
  registrationNumber: string;
};

export type HomeOrganizationSummary = {
  id: string;
  name: string;
  slug: string;
};

export type HomeOrganizerContestSummary = {
  id: string;
  title: string;
  slug: string;
  organizationId: string;
  organizationName: string;
  status: string;
};

export type HomeJuryContestSummary = {
  contestId: string;
  title: string;
  slug: string;
  judgeAccountId: string;
};

export type HomeCapabilities = {
  userId: number;
  email: string;
  isSuperAdmin: boolean;
  hasParticipations: boolean;
  hasOrganizations: boolean;
  hasJuryAccount: boolean;
  participations: HomeParticipationSummary[];
  organizations: HomeOrganizationSummary[];
  organizerContests: HomeOrganizerContestSummary[];
  juryContests: HomeJuryContestSummary[];
  /** Capabilidades “activas” (excluye none). */
  kinds: Exclude<HomeCapabilityKind, "none">[];
};

export type ResolveHomeCapabilitiesInput = {
  userId: number;
  email: string;
  globalRole?: string | null;
};

export async function resolveHomeCapabilities(
  input: ResolveHomeCapabilitiesInput,
): Promise<HomeCapabilities> {
  const email = input.email.trim().toLowerCase();
  const isSuperAdmin =
    input.globalRole === "SUPER_ADMIN" || input.globalRole === "SUPERADMIN";

  const [registrations, memberships, judgeAccount] = await Promise.all([
    prisma.fotorankContestRegistration.findMany({
      where: {
        participantUserId: input.userId,
        status: { notIn: ["CANCELLED", "DRAFT"] },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        status: true,
        registrationNumber: true,
        contest: { select: { title: true, slug: true } },
      },
    }),
    prisma.contestOrganizationMember.findMany({
      where: { userId: input.userId, status: "ACTIVE" },
      select: {
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
            contests: {
              select: {
                id: true,
                title: true,
                slug: true,
                status: true,
                organizationId: true,
              },
              orderBy: { createdAt: "desc" },
              take: 40,
            },
          },
        },
      },
    }),
    prisma.fotorankJudgeAccount.findUnique({
      where: { email },
      select: {
        id: true,
        accountStatus: true,
        assignments: {
          where: {
            assignmentStatus: {
              in: ["ASSIGNED", "ACCEPTED", "IN_PROGRESS", "EXTENDED"],
            },
          },
          select: {
            contestId: true,
            contest: { select: { id: true, title: true, slug: true } },
          },
          take: 40,
        },
      },
    }),
  ]);

  const participations: HomeParticipationSummary[] = registrations.map((r) => ({
    id: r.id,
    contestTitle: r.contest.title,
    contestSlug: r.contest.slug,
    status: r.status,
    registrationNumber: r.registrationNumber,
  }));

  const organizations: HomeOrganizationSummary[] = memberships.map((m) => ({
    id: m.organization.id,
    name: m.organization.name,
    slug: m.organization.slug,
  }));

  const organizerContests: HomeOrganizerContestSummary[] = memberships.flatMap((m) =>
    m.organization.contests.map((c) => ({
      id: c.id,
      title: c.title,
      slug: c.slug,
      organizationId: m.organization.id,
      organizationName: m.organization.name,
      status: c.status,
    })),
  );

  const juryActive =
    Boolean(judgeAccount) &&
    (judgeAccount!.accountStatus === "ACTIVE" ||
      judgeAccount!.accountStatus === "INVITED");

  const juryByContest = new Map<string, HomeJuryContestSummary>();
  if (juryActive && judgeAccount) {
    for (const a of judgeAccount.assignments) {
      if (!juryByContest.has(a.contestId)) {
        juryByContest.set(a.contestId, {
          contestId: a.contest.id,
          title: a.contest.title,
          slug: a.contest.slug,
          judgeAccountId: judgeAccount.id,
        });
      }
    }
  }

  const juryContests = [...juryByContest.values()];
  const hasParticipations = participations.length > 0;
  const hasOrganizations = organizations.length > 0;
  const hasJuryAccount = juryActive;

  const kinds: Exclude<HomeCapabilityKind, "none">[] = [];
  if (hasParticipations) kinds.push("participant");
  if (hasOrganizations) kinds.push("organizer");
  if (hasJuryAccount) kinds.push("jury");
  if (isSuperAdmin) kinds.push("superAdmin");

  return {
    userId: input.userId,
    email,
    isSuperAdmin,
    hasParticipations,
    hasOrganizations,
    hasJuryAccount,
    participations,
    organizations,
    organizerContests,
    juryContests,
    kinds,
  };
}

/**
 * Destino post-login cuando no hay `next` seguro.
 * Multi-capacidad → hub personal. Una sola → panel directo.
 */
export function resolvePostLoginPath(caps: HomeCapabilities): string {
  const { kinds } = caps;

  if (kinds.length === 0) {
    return "/mi-actividad";
  }

  if (kinds.length === 1) {
    switch (kinds[0]) {
      case "participant":
        return "/participaciones";
      case "organizer":
        return "/dashboard";
      case "jury":
        // Sesión jurado sigue siendo independiente; aterriza en login jurado con next.
        return "/jurado/login?next=/jurado/panel";
      case "superAdmin":
        return "/mi-actividad";
      default:
        return "/mi-actividad";
    }
  }

  return "/mi-actividad";
}

export async function resolvePostLoginPathForUser(input: {
  userId: number;
  email: string;
  globalRole?: string | null;
  next?: string | null;
}): Promise<string> {
  if (input.next) return input.next;
  const caps = await resolveHomeCapabilities({
    userId: input.userId,
    email: input.email,
    globalRole: input.globalRole,
  });
  return resolvePostLoginPath(caps);
}
