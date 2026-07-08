import { prisma as db } from "@repo/db";
import type { AuthGuardsPrismaClient } from "./shims/repo-db";

const prisma = db as unknown as AuthGuardsPrismaClient;

export { prisma };
