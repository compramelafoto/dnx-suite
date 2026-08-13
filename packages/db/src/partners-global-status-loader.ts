/**
 * Carga de estado global DNX Partners (soft-read, fail-closed).
 */
import type { PrismaClient } from "@prisma/client";
import {
  PARTNER_GLOBAL_STATUS_APPLICATIONS,
  buildPartnerMetricsSummary,
  computePartnerPlatformStatus,
  buildUnverifiablePlatformStatus,
  emptyCampaignCounts,
  emptySyncCounts,
  resolveDnxPartnersCentralAdminUrl,
  type PartnerGlobalCampaignCounts,
  type PartnerGlobalPlatformStatus,
  type PartnerGlobalStatusApplication,
  type PartnerGlobalStatusOverview,
  type PartnerGlobalSyncSummary,
} from "@repo/partners";

export type PartnerGlobalStatusLoadMode = "CENTRAL" | "REPLICA";

async function probeSchema(prisma: PrismaClient): Promise<boolean> {
  try {
    await prisma.dnxPartnerAdPlacement.findFirst({ select: { id: true } });
    await prisma.dnxPartnerCampaign.findFirst({ select: { id: true } });
    return true;
  } catch {
    return false;
  }
}

async function probePublicationSyncTable(prisma: PrismaClient): Promise<boolean> {
  try {
    await prisma.dnxPartnerPublicationSync.findFirst({ select: { id: true } });
    return true;
  } catch {
    return false;
  }
}

async function countCampaignsForApp(
  prisma: PrismaClient,
  application: PartnerGlobalStatusApplication,
): Promise<PartnerGlobalCampaignCounts> {
  try {
    const rows = await prisma.dnxPartnerCampaign.groupBy({
      by: ["status"],
      where: {
        archivedAt: null,
        OR: [
          { application },
          { publishTargets: { some: { application } } },
          {
            placementBindings: {
              some: {
                isActive: true,
                adPlacement: { application },
              },
            },
          },
        ],
      },
      _count: { _all: true },
    });

    let draft = 0;
    let active = 0;
    let paused = 0;
    let endedOrOther = 0;
    for (const r of rows) {
      const n = r._count._all;
      if (r.status === "DRAFT") draft += n;
      else if (r.status === "ACTIVE") active += n;
      else if (r.status === "PAUSED") paused += n;
      else endedOrOther += n;
    }
    const total = draft + active + paused + endedOrOther;
    return {
      total,
      draft,
      active,
      paused,
      endedOrOther,
      unverifiable: false,
    };
  } catch {
    return emptyCampaignCounts(true);
  }
}

async function loadSyncSummary(
  prisma: PrismaClient,
  application: PartnerGlobalStatusApplication,
  mode: PartnerGlobalStatusLoadMode,
): Promise<PartnerGlobalSyncSummary> {
  if (mode === "REPLICA") {
    const hasSyncTable = await probePublicationSyncTable(prisma);
    if (!hasSyncTable) {
      return {
        ...emptySyncCounts(false),
        warning:
          "La sincronización detallada se consulta en el CRM central (Clickatón).",
      };
    }
  }

  try {
    const [pending, synced, failed, last] = await Promise.all([
      prisma.dnxPartnerPublicationSync.count({
        where: { targetApplication: application, status: "PENDING" },
      }),
      prisma.dnxPartnerPublicationSync.count({
        where: { targetApplication: application, status: "SYNCED" },
      }),
      prisma.dnxPartnerPublicationSync.count({
        where: { targetApplication: application, status: "FAILED" },
      }),
      prisma.dnxPartnerPublicationSync.findFirst({
        where: { targetApplication: application },
        orderBy: { updatedAt: "desc" },
        select: { updatedAt: true, lastSyncedAt: true },
      }),
    ]);
    return {
      lastPublicationAt: last?.updatedAt?.toISOString() ?? null,
      lastSyncAt: last?.lastSyncedAt?.toISOString() ?? null,
      pending,
      synced,
      failed,
      unverifiable: false,
      warning: failed > 0 ? `Hay ${failed} sync FAILED hacia ${application}.` : null,
    };
  } catch {
    return emptySyncCounts(true);
  }
}

async function loadMetrics(
  prisma: PrismaClient,
  application: PartnerGlobalStatusApplication,
  mode: PartnerGlobalStatusLoadMode,
) {
  try {
    const [impressions, clicks, lastImp, lastClick] = await Promise.all([
      prisma.dnxPartnerImpressionEvent.count({ where: { application } }),
      prisma.dnxPartnerClickEvent.count({ where: { application } }),
      prisma.dnxPartnerImpressionEvent.findFirst({
        where: { application },
        orderBy: { occurredAt: "desc" },
        select: { occurredAt: true },
      }),
      prisma.dnxPartnerClickEvent.findFirst({
        where: { application },
        orderBy: { occurredAt: "desc" },
        select: { occurredAt: true },
      }),
    ]);
    const lastActivityAt =
      [lastImp?.occurredAt, lastClick?.occurredAt]
        .filter(Boolean)
        .sort((a, b) => (a! > b! ? -1 : 1))[0]
        ?.toISOString() ?? null;
    return buildPartnerMetricsSummary({
      impressions,
      clicks,
      lastActivityAt,
      metricsOnlyOnDestination: mode === "REPLICA",
    });
  } catch {
    return buildPartnerMetricsSummary({
      impressions: null,
      clicks: null,
      unverifiable: true,
    });
  }
}

function mapSource(mode: PartnerGlobalStatusLoadMode): "CENTRAL" | "LOCAL_REPLICA" {
  return mode === "CENTRAL" ? "CENTRAL" : "LOCAL_REPLICA";
}

export async function loadPartnerGlobalStatusOverview(
  prisma: PrismaClient,
  input: {
    mode: PartnerGlobalStatusLoadMode;
    application?: PartnerGlobalStatusApplication;
    centralAdminUrl?: string | null;
  },
): Promise<PartnerGlobalStatusOverview> {
  const centralAdminUrl = resolveDnxPartnersCentralAdminUrl(
    input.centralAdminUrl ?? process.env.DNX_PARTNERS_CENTRAL_ADMIN_URL,
  );
  const apps: PartnerGlobalStatusApplication[] =
    input.mode === "REPLICA"
      ? [input.application ?? "FOTO_RANK"]
      : [...PARTNER_GLOBAL_STATUS_APPLICATIONS];

  const platforms: PartnerGlobalPlatformStatus[] = [];

  for (const application of apps) {
    try {
      const schemaAvailable = await probeSchema(prisma);
      if (!schemaAvailable) {
        platforms.push(
          computePartnerPlatformStatus({
            application,
            source: mapSource(input.mode),
            schemaAvailable: false,
            centralAdminUrl,
            warnings: ["Tablas DNX Partners no disponibles en esta base."],
          }),
        );
        continue;
      }

      const [campaigns, sync, metrics] = await Promise.all([
        countCampaignsForApp(prisma, application),
        loadSyncSummary(prisma, application, input.mode),
        loadMetrics(prisma, application, input.mode),
      ]);

      platforms.push(
        computePartnerPlatformStatus({
          application,
          source: mapSource(input.mode),
          schemaAvailable: true,
          campaigns,
          sync,
          metrics,
          centralAdminUrl,
        }),
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "error_desconocido";
      platforms.push(
        buildUnverifiablePlatformStatus(
          application,
          mapSource(input.mode),
          "No se pudo verificar el estado (consulta fallida).",
        ),
      );
      console.error("[partners.global-status]", application, msg.slice(0, 120));
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    platforms,
    fotoOfficeExcluded: true,
    centralAdminUrl,
  };
}

export async function loadPartnerGlobalStatusForLocalApp(
  prisma: PrismaClient,
  application: PartnerGlobalStatusApplication,
): Promise<PartnerGlobalPlatformStatus> {
  const snap = await loadPartnerGlobalStatusOverview(prisma, {
    mode: "REPLICA",
    application,
  });
  return (
    snap.platforms[0] ??
    buildUnverifiablePlatformStatus(application, "LOCAL_REPLICA", "Sin datos")
  );
}

/** @deprecated use loadPartnerGlobalStatusOverview */
export async function loadPartnerGlobalStatusSnapshot(
  prisma: PrismaClient,
  input: {
    mode: "CENTRAL" | "LOCAL_REPLICA";
    application?: PartnerGlobalStatusApplication;
    centralAdminUrl?: string | null;
  },
): Promise<PartnerGlobalStatusOverview> {
  return loadPartnerGlobalStatusOverview(prisma, {
    mode: input.mode === "CENTRAL" ? "CENTRAL" : "REPLICA",
    application: input.application,
    centralAdminUrl: input.centralAdminUrl,
  });
}
