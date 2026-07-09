import { Prisma, PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
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
} from "@prisma/client";

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
