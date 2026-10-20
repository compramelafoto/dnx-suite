import { prisma, type PrismaClient } from "@repo/db";

export function getPrisma(): PrismaClient {
  return prisma;
}

export async function disconnectPrisma() {
  await prisma.$disconnect();
}
