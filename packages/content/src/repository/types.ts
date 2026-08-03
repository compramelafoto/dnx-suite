import type { PrismaClient } from "@prisma/client";
import type { ContentPlatform } from "../platform";

export type ContentPrisma = PrismaClient;

export type PlatformScoped = {
  prisma: ContentPrisma;
  platform: ContentPlatform;
};
