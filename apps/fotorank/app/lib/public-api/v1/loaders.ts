import { prisma } from "@repo/db";
import type {
  FotorankPublicDistributionChannelV1,
  FotorankPublicEventListItemV1,
  FotorankPublicEventV1,
} from "./contracts";
import {
  distributionChannelWhereForPublicFilter,
  eventMatchesPublicChannel,
  type InternalDistributionChannel,
} from "./channel";
import type { InternalExperienceType } from "./experience";
import {
  serializePublicEventListItemV1,
  serializePublicEventV1,
  type PublicEventSerializeSource,
} from "./serializers";
import { assertCanSerializeForPublicDetail, assertCanSerializeForPublicList } from "./visibility";

const PUBLIC_STATUSES = ["PUBLISHED", "ACTIVE"] as const;

type JudgeAssignmentLike = {
  judgeAccountId: string;
  category: { name: string } | null;
  judgeAccount: {
    profile: {
      isPublic: boolean;
      publicSlug: string;
      firstName: string;
      lastName: string;
      avatarUrl: string | null;
      shortBio: string | null;
    } | null;
  };
};

type ContestLike = {
  id: string;
  slug: string;
  title: string;
  shortDescription: string | null;
  fullDescription: string | null;
  coverImageUrl: string | null;
  rulesText: string | null;
  prizesSummary: string | null;
  sponsorsText: string | null;
  rulesData: unknown;
  startAt: Date | null;
  submissionDeadline: Date | null;
  judgingStartAt: Date | null;
  judgingEndAt: Date | null;
  resultsAt: Date | null;
  status: string;
  visibility: string;
  experienceType: InternalExperienceType;
  distributionChannel: InternalDistributionChannel;
  createdAt: Date;
  updatedAt: Date;
  organization: {
    id: string;
    name: string;
    slug: string;
    shortDescription: string | null;
    logoUrl: string | null;
    website: string | null;
    city: string | null;
    country: string | null;
    instagram: string | null;
    contactEmail: string | null;
    phone: string | null;
    whatsapp: string | null;
    address: string | null;
  };
  categories: Array<{
    id: string;
    name: string;
    slug: string;
    description: string | null;
    maxFiles: number;
    status: string;
  }>;
  judgeAssignments: JudgeAssignmentLike[];
};

function toSerializeSource(contest: ContestLike): PublicEventSerializeSource {
  const byJudge = new Map<
    string,
    {
      firstName: string;
      lastName: string;
      avatarUrl: string | null;
      publicSlug: string;
      shortBio: string | null;
      categories: string[];
      isPublic: boolean;
    }
  >();

  for (const assignment of contest.judgeAssignments) {
    const profile = assignment.judgeAccount.profile;
    if (!profile?.isPublic || !profile.publicSlug) continue;
    const prev = byJudge.get(assignment.judgeAccountId);
    const catName = assignment.category?.name ?? "General";
    if (prev) {
      prev.categories.push(catName);
    } else {
      byJudge.set(assignment.judgeAccountId, {
        firstName: profile.firstName,
        lastName: profile.lastName,
        avatarUrl: profile.avatarUrl,
        publicSlug: profile.publicSlug,
        shortBio: profile.shortBio,
        categories: [catName],
        isPublic: true,
      });
    }
  }

  return {
    id: contest.id,
    slug: contest.slug,
    title: contest.title,
    shortDescription: contest.shortDescription,
    fullDescription: contest.fullDescription,
    coverImageUrl: contest.coverImageUrl,
    rulesText: contest.rulesText,
    prizesSummary: contest.prizesSummary,
    sponsorsText: contest.sponsorsText,
    rulesData: contest.rulesData,
    startAt: contest.startAt,
    submissionDeadline: contest.submissionDeadline,
    judgingStartAt: contest.judgingStartAt,
    judgingEndAt: contest.judgingEndAt,
    resultsAt: contest.resultsAt,
    status: contest.status,
    visibility: contest.visibility,
    experienceType: contest.experienceType ?? "CONTEST",
    distributionChannel: contest.distributionChannel ?? null,
    createdAt: contest.createdAt,
    updatedAt: contest.updatedAt,
    organization: {
      id: contest.organization.id,
      name: contest.organization.name,
      slug: contest.organization.slug,
      shortDescription: contest.organization.shortDescription,
      logoUrl: contest.organization.logoUrl,
      website: contest.organization.website,
      city: contest.organization.city,
      country: contest.organization.country,
      instagram: contest.organization.instagram,
      contactEmail: contest.organization.contactEmail,
      phone: contest.organization.phone,
      whatsapp: contest.organization.whatsapp,
      address: contest.organization.address,
    },
    categories: contest.categories.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      description: c.description,
      maxFiles: c.maxFiles,
      status: c.status,
    })),
    judges: [...byJudge.values()],
  };
}

export type ListPublicEventsV1Options = {
  limit?: number;
  /** Filtro opcional por canal público (`?channel=`). */
  channel?: FotorankPublicDistributionChannelV1;
};

export type GetPublicEventV1BySlugOptions = {
  /** Si se indica, el evento debe pertenecer a ese canal o se trata como no encontrado. */
  channel?: FotorankPublicDistributionChannelV1;
};

/**
 * Ficha pública V1 por slug (PUBLIC o UNLISTED).
 * Sin HTTP — para consumo servidor / Route Handlers.
 */
export async function getPublicEventV1BySlug(
  slug: string,
  options?: GetPublicEventV1BySlugOptions,
): Promise<FotorankPublicEventV1 | null> {
  const contest = await prisma.fotorankContest.findFirst({
    where: {
      slug,
      status: { in: [...PUBLIC_STATUSES] },
      visibility: { in: ["PUBLIC", "UNLISTED"] },
      ...(options?.channel
        ? distributionChannelWhereForPublicFilter(options.channel)
        : {}),
    },
    include: {
      organization: true,
      categories: { where: { status: "ACTIVE" }, orderBy: { sortOrder: "asc" } },
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

  if (
    !assertCanSerializeForPublicDetail({
      visibility: contest.visibility,
      status: contest.status,
    })
  ) {
    return null;
  }

  const event = serializePublicEventV1(toSerializeSource(contest as ContestLike));

  if (
    options?.channel &&
    !eventMatchesPublicChannel(
      event.distributionChannel,
      options.channel,
      event.experienceType,
    )
  ) {
    return null;
  }

  return event;
}

/**
 * Listado público V1 (solo PUBLIC + publicados).
 * Filtro opcional por `channel` (Etapa 08C).
 */
export async function listPublicEventsV1(
  options?: ListPublicEventsV1Options,
): Promise<FotorankPublicEventListItemV1[]> {
  const limit = options?.limit ?? 24;
  const contests = await prisma.fotorankContest.findMany({
    where: {
      visibility: "PUBLIC",
      status: { in: [...PUBLIC_STATUSES] },
      ...(options?.channel
        ? distributionChannelWhereForPublicFilter(options.channel)
        : {}),
    },
    include: {
      organization: true,
      categories: {
        where: { status: "ACTIVE" },
        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
          maxFiles: true,
          status: true,
        },
      },
      judgeAssignments: {
        where: {
          assignmentStatus: { in: ["ACCEPTED", "IN_PROGRESS", "COMPLETED", "EXTENDED"] },
        },
        include: {
          judgeAccount: {
            include: {
              profile: {
                select: {
                  isPublic: true,
                  publicSlug: true,
                  firstName: true,
                  lastName: true,
                  avatarUrl: true,
                  shortBio: true,
                },
              },
            },
          },
          category: { select: { name: true } },
        },
      },
    },
    orderBy: [{ submissionDeadline: "asc" }, { updatedAt: "desc" }],
    take: Math.min(Math.max(limit, 1), 100),
  });

  const items: FotorankPublicEventListItemV1[] = [];
  for (const contest of contests) {
    if (
      !assertCanSerializeForPublicList({
        visibility: contest.visibility,
        status: contest.status,
      })
    ) {
      continue;
    }
    const item = serializePublicEventListItemV1(
      toSerializeSource(contest as ContestLike),
    );
    if (
      options?.channel &&
      !eventMatchesPublicChannel(
        item.distributionChannel,
        options.channel,
        item.experienceType,
      )
    ) {
      continue;
    }
    items.push(item);
  }
  return items;
}
