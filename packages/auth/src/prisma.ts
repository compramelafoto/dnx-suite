import { prisma as basePrisma } from "@repo/db";

type SuiteDelegate = {
  create(args: unknown): Promise<unknown>;
  findUnique(args: unknown): Promise<unknown>;
  findMany(args: unknown): Promise<unknown>;
  delete(args: unknown): Promise<unknown>;
  deleteMany(args: unknown): Promise<unknown>;
};

export const prisma = basePrisma as typeof basePrisma & {
  userSession: SuiteDelegate;
  workspaceMembership: SuiteDelegate;
  membership: SuiteDelegate;
  workspaceAppAccess: SuiteDelegate;
  dnxAppInvitation: SuiteDelegate & {
    findFirst(args: unknown): Promise<unknown>;
    findMany(args: unknown): Promise<unknown>;
    update(args: unknown): Promise<unknown>;
    updateMany(args: unknown): Promise<{ count: number }>;
  };
  passwordResetToken: SuiteDelegate & {
    update(args: unknown): Promise<unknown>;
  };
};
