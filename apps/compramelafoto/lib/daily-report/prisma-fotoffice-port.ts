/**
 * Adaptador Prisma del puerto de FotOffice.
 */

import type { PrismaClient } from "@prisma/client";
import type { DateRange, FotofficePort, FotofficeStats } from "@repo/ops-daily-report";

export function createPrismaFotofficePort(client: PrismaClient): FotofficePort {
  return {
    async stats(range: DateRange): Promise<FotofficeStats> {
      const inRange = { gte: range.start, lt: range.end };

      const [
        newWorkspaces,
        totalWorkspaces,
        newMembers,
        totalMembers,
        newServiceLeads,
        newCourseLeads,
        pendingServiceLeads,
        pendingCourseLeads,
        publishedWebsites,
        moduleGroups,
      ] = await Promise.all([
        client.workspace.count({ where: { createdAt: inRange } }),
        client.workspace.count(),
        client.member.count({ where: { createdAt: inRange } }),
        client.member.count(),
        client.serviceSalesLead.count({ where: { createdAt: inRange } }),
        client.courseSalesLead.count({ where: { createdAt: inRange } }),
        client.serviceSalesLead.count({ where: { status: "NEW" } }),
        client.courseSalesLead.count({ where: { status: "NEW" } }),
        client.fotofficeWorkspaceWebsite.count(),
        client.workspaceFeatureModule.groupBy({
          by: ["moduleKey"],
          where: { enabled: true },
          _count: { _all: true },
        }),
      ]);

      const enabledModules: Record<string, number> = {};
      for (const group of moduleGroups) {
        enabledModules[group.moduleKey] = group._count._all;
      }

      return {
        newWorkspaces,
        totalWorkspaces,
        newMembers,
        totalMembers,
        newServiceLeads,
        newCourseLeads,
        pendingLeads: pendingServiceLeads + pendingCourseLeads,
        publishedWebsites,
        enabledModules,
      };
    },
  };
}
