import { prisma } from "@repo/db";
import { mapOrganizationToProfileDTO, type ContestOrganizationProfileDTO } from "./organizationProfile";

const PUBLIC_STATUSES = ["PUBLISHED", "ACTIVE"] as const;

export type PublicContestJudgeCard = {
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  publicSlug: string;
  shortBio: string | null;
  categories: string[];
};

export type PublicContestLandingData = {
  contest: {
    id: string;
    title: string;
    slug: string;
    shortDescription: string | null;
    fullDescription: string | null;
    coverImageUrl: string | null;
    rulesText: string | null;
    prizesSummary: string | null;
    sponsorsText: string | null;
    startAt: Date | null;
    submissionDeadline: Date | null;
    judgingStartAt: Date | null;
    judgingEndAt: Date | null;
    resultsAt: Date | null;
    categories: Array<{ id: string; name: string; slug: string; description: string | null; maxFiles: number }>;
  };
  organization: ContestOrganizationProfileDTO;
  judges: PublicContestJudgeCard[];
};

export async function getPublicContestLandingBySlug(slug: string): Promise<PublicContestLandingData | null> {
  const contest = await prisma.fotorankContest.findFirst({
    where: {
      slug,
      visibility: "PUBLIC",
      status: { in: [...PUBLIC_STATUSES] },
    },
    include: {
      organization: true,
      categories: { orderBy: { sortOrder: "asc" } },
      judgeAssignments: {
        where: {
          assignmentStatus: { in: ["ACCEPTED", "IN_PROGRESS", "COMPLETED", "EXTENDED"] },
        },
        include: {
          judgeAccount: { include: { profile: true } },
          category: true,
        },
      },
    },
  });

  if (!contest) return null;

  const byJudge = new Map<
    string,
    { profile: NonNullable<(typeof contest.judgeAssignments)[0]["judgeAccount"]["profile"]>; categories: string[] }
  >();
  for (const a of contest.judgeAssignments) {
    const profile = a.judgeAccount.profile;
    if (!profile?.isPublic) continue;
    const prev = byJudge.get(a.judgeAccountId);
    const catName = a.category?.name ?? "General";
    if (prev) prev.categories.push(catName);
    else byJudge.set(a.judgeAccountId, { profile, categories: [catName] });
  }

  const judges: PublicContestJudgeCard[] = [...byJudge.values()].map((v) => ({
    firstName: v.profile.firstName,
    lastName: v.profile.lastName,
    avatarUrl: v.profile.avatarUrl,
    publicSlug: v.profile.publicSlug,
    shortBio: v.profile.shortBio,
    categories: [...new Set(v.categories)],
  }));

  return {
    contest: {
      id: contest.id,
      title: contest.title,
      slug: contest.slug,
      shortDescription: contest.shortDescription,
      fullDescription: contest.fullDescription,
      coverImageUrl: contest.coverImageUrl,
      rulesText: contest.rulesText,
      prizesSummary: contest.prizesSummary,
      sponsorsText: contest.sponsorsText,
      startAt: contest.startAt,
      submissionDeadline: contest.submissionDeadline,
      judgingStartAt: contest.judgingStartAt,
      judgingEndAt: contest.judgingEndAt,
      resultsAt: contest.resultsAt,
      categories: contest.categories.map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        description: c.description,
        maxFiles: c.maxFiles,
      })),
    },
    organization: mapOrganizationToProfileDTO(contest.organization),
    judges,
  };
}
