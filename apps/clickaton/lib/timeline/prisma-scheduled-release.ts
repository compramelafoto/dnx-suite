import "server-only";

import { prisma } from "@/lib/admin/db";
import { releaseAllPromptsForEdition } from "@/lib/timeline/prisma-timeline";
import {
  buildDuePromptsWhere,
  type PromptReleaseStore,
} from "@/lib/timeline/scheduled-release";

export function createPrismaPromptReleaseStore(): PromptReleaseStore {
  return {
    async findDuePrompts({ now, limit }) {
      return prisma.clickatonPrompt.findMany({
        where: buildDuePromptsWhere(now),
        select: { id: true, editionId: true, sequence: true, captureStartsAt: true },
        orderBy: [{ editionId: "asc" }, { sequence: "asc" }],
        take: limit,
      });
    },
    async markEditionReleased({ editionId, releasedAt }) {
      return releaseAllPromptsForEdition({ editionId, releasedAt });
    },
  };
}
