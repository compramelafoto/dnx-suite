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
export type {
  FotorankJudgeMethodType,
  FotorankJudgeCompensationMode,
  FotorankJudgePricingMode,
  FotorankJudgePriceUnit,
} from "@prisma/client";
export {
  Role,
  TokenPurpose,
  ReferralProgram,
  LabApprovalStatus,
  TalkStatus,
} from "@prisma/client";
