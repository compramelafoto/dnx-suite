import type { PrismaClient } from "@prisma/client";
import type { ContentPlatform } from "../platform";

export type ContentPrisma = PrismaClient;

export type PlatformScoped = {
  prisma: ContentPrisma;
  platform: ContentPlatform;
  /** Institución, en las plataformas con un blog por institución (FOTOFFICE). */
  workspaceKey?: string | null;
};
