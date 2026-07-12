import { Prisma, PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  prismaSchemaEpoch?: string;
};

function createPrismaClient() {
  return new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });
}

/** Epoch del schema generado — cambia cuando aparecen/desaparecen modelos. */
function prismaSchemaEpoch(): string {
  return Prisma.dmmf.datamodel.models.map((m) => m.name).join("|");
}

function clientHasModel(client: PrismaClient, modelName: string): boolean {
  const key = `${modelName[0]!.toLowerCase()}${modelName.slice(1)}`;
  const delegate = (client as unknown as Record<string, { findMany?: unknown } | undefined>)[key];
  return typeof delegate?.findMany === "function";
}

function isStalePrismaClient(client: PrismaClient): boolean {
  const epoch = prismaSchemaEpoch();
  if (globalForPrisma.prismaSchemaEpoch && globalForPrisma.prismaSchemaEpoch !== epoch) {
    return true;
  }
  // Defensa explícita para modelos Info Spot recientes (HMR / Turbopack).
  for (const model of ["InfoSpotEvent", "InfoSpotEventSubmission", "InfoSpotArticle"]) {
    if (
      Prisma.dmmf.datamodel.models.some((m) => m.name === model) &&
      !clientHasModel(client, model)
    ) {
      return true;
    }
  }
  return false;
}

const existing = globalForPrisma.prisma;
if (existing && isStalePrismaClient(existing)) {
  void existing.$disconnect().catch(() => undefined);
  globalForPrisma.prisma = undefined;
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
  globalForPrisma.prismaSchemaEpoch = prismaSchemaEpoch();
}

export { Prisma };
export type { PrismaClient };
/** Re-export Prisma enums for apps that depend on `@repo/db` but not on `@prisma/client` directly. */
export {
  Role,
  TokenPurpose,
  ReferralProgram,
  LabApprovalStatus,
  TalkStatus,
  CameraConnectionAssignmentMode,
  InfoSpotEditorialRole,
  InfoSpotMemberStatus,
  InfoSpotArticleStatus,
  InfoSpotAssetSourceType,
  InfoSpotArticleAssetUsage,
  InfoSpotArticleObservationType,
  InfoSpotEventStatus,
  InfoSpotEventSubmissionStatus,
  InfoSpotContentTag,
} from "@prisma/client";

export {
  canManageInfoSpotSettings,
  canManageInfoSpotUsers,
  canCreateInfoSpotArticle,
  canEditInfoSpotArticle,
  canPublishInfoSpotArticle,
  canReviewInfoSpotApprovals,
  canAccessInfoSpotRedaccion,
  canAccessInfoSpotAdmin,
  canModerateInfoSpotEvents,
  canViewInfoSpotPublishedEvents,
  canPublishInfoSpotEvent,
  isInfoSpotEditorialRole,
  isInfoSpotPublicationPolicy,
  resolveInfoSpotPublicationFields,
  effectivePublicationPolicy,
  publicationPolicyLabel,
  infoSpotRoleLabel,
  INFOSPOT_EDITORIAL_ROLES,
  INFOSPOT_PUBLICATION_POLICIES,
  type InfoSpotPermissionSubject,
  type InfoSpotEditorialRoleName,
  type InfoSpotPublicationPolicyName,
} from "./infospot-permissions";

export {
  resolveClfAlbumCommercialAvailability,
  type ClfAlbumAvailabilityInput,
  type ClfAlbumAvailabilityResult,
  type ClfAlbumCommercialStatus,
  type ClfAlbumAvailabilityOptions,
} from "./clf-album-availability";

export {
  getClfReadonlyClient,
  getClfReadonlyConnectionInfo,
  probeClfReadonlyConnection,
  disconnectClfReadonlyClient,
  type ClfReadonlyConnectionInfo,
} from "./clf-readonly-client";



/** Fotorank judge enums (schema gap — valores alineados a migraciones baseline). */
export const FotorankJudgeMethodType = {
  SCORE_1_5: "SCORE_1_5",
  SCORE_1_10: "SCORE_1_10",
  SCORE_0_100: "SCORE_0_100",
  YES_NO: "YES_NO",
  FAVORITES_SELECTION: "FAVORITES_SELECTION",
  SELECTION_WITH_QUOTA: "SELECTION_WITH_QUOTA",
  CRITERIA_BASED: "CRITERIA_BASED",
} as const;
export type FotorankJudgeMethodType =
  (typeof FotorankJudgeMethodType)[keyof typeof FotorankJudgeMethodType];

export const FotorankJudgeCompensationMode = {
  VOLUNTEER: "VOLUNTEER",
  PAID: "PAID",
  BOTH: "BOTH",
} as const;
export type FotorankJudgeCompensationMode =
  (typeof FotorankJudgeCompensationMode)[keyof typeof FotorankJudgeCompensationMode];

export const FotorankJudgePricingMode = {
  FIXED: "FIXED",
  STARTING_AT: "STARTING_AT",
  NEGOTIABLE: "NEGOTIABLE",
  NOT_SHOWN: "NOT_SHOWN",
} as const;
export type FotorankJudgePricingMode =
  (typeof FotorankJudgePricingMode)[keyof typeof FotorankJudgePricingMode];

export const FotorankJudgePriceUnit = {
  PER_CONTEST: "PER_CONTEST",
  PER_CATEGORY: "PER_CATEGORY",
  PER_HOUR: "PER_HOUR",
  CUSTOM: "CUSTOM",
} as const;
export type FotorankJudgePriceUnit =
  (typeof FotorankJudgePriceUnit)[keyof typeof FotorankJudgePriceUnit];
