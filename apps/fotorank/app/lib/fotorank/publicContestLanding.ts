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
    rulesData: unknown;
    startAt: Date | null;
    registrationOpensAt: Date | null;
    registrationClosesAt: Date | null;
    registrationEnabled: boolean;
    registrationPricingMode: string;
    submissionOpensAt: Date | null;
    submissionDeadline: Date | null;
    judgingStartAt: Date | null;
    judgingEndAt: Date | null;
    resultsAt: Date | null;
    timezone: string | null;
    categories: Array<{ id: string; name: string; slug: string; description: string | null; maxFiles: number }>;
    status: "DRAFT" | "SETUP_IN_PROGRESS" | "READY_TO_PUBLISH" | "PUBLISHED" | "ACTIVE" | "CLOSED" | "ARCHIVED";
    visibility: "PUBLIC" | "UNLISTED" | "PRIVATE";
  };
  organization: ContestOrganizationProfileDTO;
  judges: PublicContestJudgeCard[];
  /** Highlights derivados para landings especiales (p.ej. Santa Fe). */
  highlights: {
    editionLabel: string | null;
    freeRegistration: boolean;
    openParticipation: boolean;
    minAge: number | null;
    instagramRequired: boolean;
    photoUploadOpen: boolean;
    contactEmail: string | null;
    capturePeriodLabel: string | null;
    prizesPerCategoryLabel: string | null;
    uploadClosedNotice: string | null;
  };
};

function isSantaFeSlug(slug: string): boolean {
  return slug === "santa-fe-en-foco" || slug.includes("santa-fe");
}

function buildHighlights(contest: {
  slug: string;
  registrationPricingMode: string;
  submissionOpensAt: Date | null;
  organizationContactEmail?: string | null;
}): PublicContestLandingData["highlights"] {
  if (!isSantaFeSlug(contest.slug)) {
    return {
      editionLabel: null,
      freeRegistration: contest.registrationPricingMode === "FREE",
      openParticipation: false,
      minAge: null,
      instagramRequired: false,
      photoUploadOpen: Boolean(
        contest.submissionOpensAt && contest.submissionOpensAt.getTime() <= Date.now(),
      ),
      contactEmail: contest.organizationContactEmail ?? null,
      capturePeriodLabel: null,
      prizesPerCategoryLabel: null,
      uploadClosedNotice: null,
    };
  }

  const uploadOpen = Boolean(
    contest.submissionOpensAt && contest.submissionOpensAt.getTime() <= Date.now(),
  );

  return {
    editionLabel: "Edición 2026",
    freeRegistration: true,
    openParticipation: true,
    minAge: 16,
    instagramRequired: true,
    photoUploadOpen: uploadOpen,
    contactEmail: "sfprosario@gmail.com",
    capturePeriodLabel: "1 de agosto al 30 de septiembre de 2026",
    prizesPerCategoryLabel: "1º ARS 500.000 · 2º ARS 400.000 · 3º ARS 300.000 (por categoría)",
    uploadClosedNotice: uploadOpen
      ? null
      : "La inscripción ya está abierta. La carga de fotografías se habilitará próximamente y se comunicará por los canales oficiales del concurso.",
  };
}

export async function getPublicContestLandingBySlug(slug: string): Promise<PublicContestLandingData | null> {
  const contest = await prisma.fotorankContest.findFirst({
    where: {
      slug,
      visibility: "PUBLIC",
      status: { in: [...PUBLIC_STATUSES] },
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

  const orgDto = mapOrganizationToProfileDTO(contest.organization);
  const highlights = buildHighlights({
    slug: contest.slug,
    registrationPricingMode: contest.registrationPricingMode ?? "FREE",
    submissionOpensAt: contest.submissionOpensAt,
    organizationContactEmail: orgDto.contactEmail,
  });

  const defaultPrizes =
    isSantaFeSlug(contest.slug) && !contest.prizesSummary
      ? "Por cada categoría oficial: 1º premio ARS 500.000 · 2º premio ARS 400.000 · 3º premio ARS 300.000."
      : contest.prizesSummary;

  const defaultFullDescription =
    contest.fullDescription ??
    (isSantaFeSlug(contest.slug)
      ? "Santa Fe en Foco, edición 2026. Concurso fotográfico gratuito con participación abierta: no se exige residencia en la Provincia de Santa Fe. La fotografía presentada debe haber sido realizada dentro del territorio de la Provincia de Santa Fe durante el período oficial. Desarrollado sobre FotoRank."
      : null);

  return {
    contest: {
      id: contest.id,
      title: contest.title,
      slug: contest.slug,
      shortDescription: contest.shortDescription,
      fullDescription: defaultFullDescription,
      coverImageUrl: contest.coverImageUrl,
      rulesText: contest.rulesText,
      prizesSummary: defaultPrizes,
      sponsorsText: contest.sponsorsText,
      rulesData: contest.rulesData,
      startAt: contest.startAt,
      registrationOpensAt: contest.registrationOpensAt,
      registrationClosesAt: contest.registrationClosesAt,
      registrationEnabled: contest.registrationEnabled,
      registrationPricingMode: contest.registrationPricingMode,
      submissionOpensAt: contest.submissionOpensAt,
      submissionDeadline: contest.submissionDeadline,
      judgingStartAt: contest.judgingStartAt,
      judgingEndAt: contest.judgingEndAt,
      resultsAt: contest.resultsAt,
      timezone: contest.timezone,
      categories: contest.categories.map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        description: c.description,
        maxFiles: c.maxFiles,
      })),
      status: contest.status,
      visibility: contest.visibility,
    },
    organization: orgDto,
    judges,
    highlights,
  };
}
