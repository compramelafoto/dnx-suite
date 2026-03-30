import { prisma } from "@repo/db";
import type { FotorankJudgeCompensationMode, FotorankJudgePricingMode } from "@repo/db";

export type DirectoryJudgeCardDto = {
  judgeAccountId: string;
  displayName: string;
  headline: string | null;
  avatarUrl: string | null;
  specialties: string[];
  compensationMode: FotorankJudgeCompensationMode;
  pricingSummary: string | null;
  isAvailableForJuryWork: boolean;
  isVerifiedByPlatform: boolean;
  completedAssignments: number;
  country: string | null;
  region: string | null;
  languages: string[];
};

export type DirectoryListFilters = {
  search?: string;
  specialty?: string;
  language?: string;
  country?: string;
  region?: string;
  availableOnly?: boolean;
  compensation?: FotorankJudgeCompensationMode;
  verifiedOnly?: boolean;
  minExperience?: number;
  priceMin?: number;
  priceMax?: number;
};

function parseStringArrayJson(raw: unknown): string[] {
  if (!raw || !Array.isArray(raw)) return [];
  return raw.filter((x): x is string => typeof x === "string" && x.trim().length > 0).map((s) => s.trim());
}

export function buildPricingSummaryPublic(params: {
  pricingMode: FotorankJudgePricingMode;
  showPricingPublicly: boolean;
  compensationMode: FotorankJudgeCompensationMode;
  priceAmount: number | null;
  priceCurrency: string | null;
  priceUnit: string | null;
  priceNotes: string | null;
}): string | null {
  const { pricingMode, showPricingPublicly, compensationMode, priceAmount, priceCurrency, priceUnit, priceNotes } =
    params;
  if (compensationMode === "VOLUNTEER" && pricingMode === "NOT_SHOWN") {
    return "Ad honorem";
  }
  if (compensationMode === "VOLUNTEER") return "Ad honorem";
  if (compensationMode === "BOTH") {
    if (!showPricingPublicly || pricingMode === "NOT_SHOWN") return "Ad honorem / pago (consultar)";
  }
  if (!showPricingPublicly || pricingMode === "NOT_SHOWN") {
    return compensationMode === "PAID" ? "Pago — consultar" : null;
  }
  const cur = priceCurrency?.trim() || "";
  const unitLabel =
    priceUnit === "PER_CONTEST"
      ? "por concurso"
      : priceUnit === "PER_CATEGORY"
        ? "por categoría"
        : priceUnit === "PER_HOUR"
          ? "por hora"
          : priceUnit === "CUSTOM"
            ? ""
            : "";
  if (pricingMode === "FIXED" && priceAmount != null) {
    const n = priceAmount;
    return `${cur ? `${cur} ` : ""}${n}${unitLabel ? ` ${unitLabel}` : ""}`.trim();
  }
  if (pricingMode === "STARTING_AT" && priceAmount != null) {
    return `Desde ${cur ? `${cur} ` : ""}${priceAmount}${unitLabel ? ` ${unitLabel}` : ""}`.trim();
  }
  if (pricingMode === "NEGOTIABLE") return "A convenir";
  if (priceNotes?.trim()) return priceNotes.trim();
  return "Pago — consultar";
}

function matchesFilters(row: {
  specialtiesJson: unknown;
  languagesJson: unknown;
  country: string | null;
  region: string | null;
  isAvailableForJuryWork: boolean;
  compensationMode: FotorankJudgeCompensationMode;
  isVerifiedByPlatform: boolean;
  experienceYears: number | null;
  pricingMode: FotorankJudgePricingMode;
  showPricingPublicly: boolean;
  priceAmount: number | null;
}, f: DirectoryListFilters): boolean {
  const specs = parseStringArrayJson(row.specialtiesJson);
  const langs = parseStringArrayJson(row.languagesJson);
  if (f.specialty?.trim()) {
    const q = f.specialty.trim().toLowerCase();
    if (!specs.some((s) => s.toLowerCase().includes(q))) return false;
  }
  if (f.language?.trim()) {
    const q = f.language.trim().toLowerCase();
    if (!langs.some((s) => s.toLowerCase().includes(q))) return false;
  }
  if (f.country?.trim() && (row.country ?? "").toLowerCase() !== f.country.trim().toLowerCase()) return false;
  if (f.region?.trim() && !(row.region ?? "").toLowerCase().includes(f.region.trim().toLowerCase())) return false;
  if (f.availableOnly && !row.isAvailableForJuryWork) return false;
  if (f.compensation && row.compensationMode !== f.compensation) return false;
  if (f.verifiedOnly && !row.isVerifiedByPlatform) return false;
  if (f.minExperience != null && f.minExperience > 0) {
    const ey = row.experienceYears ?? 0;
    if (ey < f.minExperience) return false;
  }
  if (f.priceMin != null || f.priceMax != null) {
    if (!row.showPricingPublicly || row.priceAmount == null) return false;
    if (f.priceMin != null && row.priceAmount < f.priceMin) return false;
    if (f.priceMax != null && row.priceAmount > f.priceMax) return false;
  }
  return true;
}

async function completedAssignmentsCountByJudgeIds(ids: string[]): Promise<Map<string, number>> {
  if (ids.length === 0) return new Map();
  const rows = await prisma.fotorankJudgeAssignment.groupBy({
    by: ["judgeAccountId"],
    where: { judgeAccountId: { in: ids }, assignmentStatus: "COMPLETED" },
    _count: { _all: true },
  });
  return new Map(rows.map((r) => [r.judgeAccountId, r._count._all]));
}

export async function listProfessionalDirectoryJudges(
  filters: DirectoryListFilters,
  opts?: { take?: number; skip?: number }
): Promise<{ items: DirectoryJudgeCardDto[]; totalApprox: number }> {
  const take = Math.min(opts?.take ?? 48, 100);
  const skip = opts?.skip ?? 0;

  const search = filters.search?.trim().toLowerCase();

  const rows = await prisma.fotorankJudgeProfile.findMany({
    where: {
      isListedInProfessionalDirectory: true,
      judgeAccount: { accountStatus: "ACTIVE" },
      ...(search
        ? {
            OR: [
              { firstName: { contains: search, mode: "insensitive" } },
              { lastName: { contains: search, mode: "insensitive" } },
              { displayNameOverride: { contains: search, mode: "insensitive" } },
              { professionalHeadline: { contains: search, mode: "insensitive" } },
              { shortBio: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: {
      judgeAccount: { select: { id: true } },
    },
    orderBy: [{ updatedAt: "desc" }],
    take: 300,
  });

  const filtered = rows.filter((r) => matchesFilters(r, filters));
  const slice = filtered.slice(skip, skip + take);
  const countMap = await completedAssignmentsCountByJudgeIds(slice.map((r) => r.judgeAccount.id));
  const items: DirectoryJudgeCardDto[] = slice.map((r) => {
    const displayName =
      r.displayNameOverride?.trim() || `${r.firstName} ${r.lastName}`.trim();
    const pricingSummary = buildPricingSummaryPublic({
      pricingMode: r.pricingMode,
      showPricingPublicly: r.showPricingPublicly,
      compensationMode: r.compensationMode,
      priceAmount: r.priceAmount,
      priceCurrency: r.priceCurrency,
      priceUnit: r.priceUnit,
      priceNotes: r.priceNotes,
    });
    return {
      judgeAccountId: r.judgeAccount.id,
      displayName,
      headline: r.professionalHeadline,
      avatarUrl: r.avatarUrl,
      specialties: parseStringArrayJson(r.specialtiesJson).slice(0, 6),
      compensationMode: r.compensationMode,
      pricingSummary,
      isAvailableForJuryWork: r.isAvailableForJuryWork,
      isVerifiedByPlatform: r.isVerifiedByPlatform,
      completedAssignments: countMap.get(r.judgeAccount.id) ?? 0,
      country: r.showLocationPublicly ? r.country : null,
      region: r.showLocationPublicly ? r.region : null,
      languages: parseStringArrayJson(r.languagesJson),
    };
  });

  return { items, totalApprox: filtered.length };
}

export type OrganizerJudgeDetailDto = {
  judgeAccountId: string;
  displayName: string;
  headline: string | null;
  shortBio: string | null;
  avatarUrl: string | null;
  specialties: string[];
  experienceYears: number | null;
  languages: string[];
  country: string | null;
  region: string | null;
  city: string | null;
  websiteUrl: string | null;
  instagram: string | null;
  portfolioUrl: string | null;
  isAvailableForJuryWork: boolean;
  availabilityNotes: string | null;
  availableRemote: boolean;
  availableInPerson: boolean;
  preferredContestScopes: string | null;
  compensationMode: FotorankJudgeCompensationMode;
  pricingMode: FotorankJudgePricingMode;
  pricingSummary: string | null;
  isVerifiedByPlatform: boolean;
  completedAssignments: number;
  responseRate: number | null;
  avgResponseTimeHours: number | null;
  publicSlug: string;
};

export async function getOrganizerViewJudgeDetail(judgeAccountId: string): Promise<OrganizerJudgeDetailDto | null> {
  const r = await prisma.fotorankJudgeProfile.findFirst({
    where: {
      judgeAccountId,
      isListedInProfessionalDirectory: true,
      judgeAccount: { accountStatus: "ACTIVE" },
    },
    include: {
      judgeAccount: { select: { id: true } },
    },
  });
  if (!r) return null;

  const displayName = r.displayNameOverride?.trim() || `${r.firstName} ${r.lastName}`.trim();
  const pricingSummary = buildPricingSummaryPublic({
    pricingMode: r.pricingMode,
    showPricingPublicly: r.showPricingPublicly,
    compensationMode: r.compensationMode,
    priceAmount: r.priceAmount,
    priceCurrency: r.priceCurrency,
    priceUnit: r.priceUnit,
    priceNotes: r.priceNotes,
  });
  const countMap = await completedAssignmentsCountByJudgeIds([r.judgeAccount.id]);

  return {
    judgeAccountId: r.judgeAccount.id,
    displayName,
    headline: r.professionalHeadline,
    shortBio: r.shortBio,
    avatarUrl: r.avatarUrl,
    specialties: parseStringArrayJson(r.specialtiesJson),
    experienceYears: r.experienceYears,
    languages: parseStringArrayJson(r.languagesJson),
    country: r.showLocationPublicly ? r.country : null,
    region: r.showLocationPublicly ? r.region : null,
    city: r.showLocationPublicly ? r.city : null,
    websiteUrl: r.showWebsitePublicly ? r.website : null,
    instagram: r.showInstagramPublicly ? r.instagram : null,
    portfolioUrl: r.portfolioUrl,
    isAvailableForJuryWork: r.isAvailableForJuryWork,
    availabilityNotes: r.availabilityNotes,
    availableRemote: r.availableRemote,
    availableInPerson: r.availableInPerson,
    preferredContestScopes: r.preferredContestScopes,
    compensationMode: r.compensationMode,
    pricingMode: r.pricingMode,
    pricingSummary,
    isVerifiedByPlatform: r.isVerifiedByPlatform,
    completedAssignments: countMap.get(r.judgeAccount.id) ?? 0,
    responseRate: r.responseRate,
    avgResponseTimeHours: r.avgResponseTimeHours,
    publicSlug: r.publicSlug,
  };
}
