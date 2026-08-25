/**
 * Panel global de estado DNX Partners — contrato compartido (solo lectura).
 * Sin secretos, sin escritura, sin FotoOffice como destino gestionable.
 */

import {
  AD_PLACEMENT_CATALOG,
  isClickatonEventMarqueeEnabled,
  isClickatonHomeMarqueeEnabled,
  isClickatonPartnerWelcomeEnabled,
  isClfPartnerAdsEnabled,
  isClfPartnerAlbumWelcomeEnabled,
  isFotorankContestMarqueeEnabled,
  isFotorankHomeMarqueeEnabled,
  isFotorankHomeWelcomeEnabled,
  isFotorankPartnerWelcomeEnabled,
  isInfospotPartnerAdsEnabled,
  type DnxPartnerAdPlacementKey,
} from "./campaigns";
import { isLogoMarqueePlacementKey, isMountedLogoMarqueePlacementKey } from "./marquee-admin";
import { isWelcomeActivationPlacementKey } from "./welcome-activation";
import { computeCtrPercent } from "./analytics";
import type { DnxPartnerApplication } from "./types";

/** Plataformas del Sponsor Global (FotoOffice excluido). */
export const PARTNER_GLOBAL_STATUS_APPLICATIONS = [
  "CLICKATON",
  "FOTO_RANK",
  "INFO_SPOT",
  "COMPRAME_LA_FOTO",
] as const satisfies readonly DnxPartnerApplication[];

export type PartnerGlobalStatusApplication =
  (typeof PARTNER_GLOBAL_STATUS_APPLICATIONS)[number];

export const PARTNER_GLOBAL_HEALTH_STATES = [
  "HEALTHY",
  "FLAGS_OFF",
  "NO_CAMPAIGNS",
  "SYNC_PENDING",
  "SYNC_FAILED",
  "CONFIGURATION_MISSING",
  "UNVERIFIABLE",
] as const;

export type PartnerGlobalHealthState = (typeof PARTNER_GLOBAL_HEALTH_STATES)[number];

export const PARTNER_FLAG_DISPLAY_STATES = [
  "ON",
  "OFF",
  "NO_CONFIGURADO",
  "UNVERIFIABLE",
] as const;

export type PartnerFlagDisplayState = (typeof PARTNER_FLAG_DISPLAY_STATES)[number];

/** @deprecated use PARTNER_FLAG_DISPLAY_STATES */
export const PARTNER_FLAG_UI_STATES = PARTNER_FLAG_DISPLAY_STATES;

/** @deprecated use PartnerFlagDisplayState */
export type PartnerFlagUiState = PartnerFlagDisplayState;

export const PARTNER_GLOBAL_HEALTH_LABELS: Record<PartnerGlobalHealthState, string> = {
  HEALTHY: "Operativa",
  FLAGS_OFF: "Flags desactivados",
  NO_CAMPAIGNS: "Sin campañas",
  SYNC_PENDING: "Sincronización pendiente",
  SYNC_FAILED: "Sincronización fallida",
  CONFIGURATION_MISSING: "Configuración incompleta",
  UNVERIFIABLE: "No verificable",
};

export const PARTNER_GLOBAL_APP_LABELS: Record<PartnerGlobalStatusApplication, string> = {
  CLICKATON: "Clickatón",
  FOTO_RANK: "FotoRank",
  INFO_SPOT: "InfoSpot",
  COMPRAME_LA_FOTO: "ComprameLaFoto",
};

export const PARTNERS_CENTRAL_ADMIN_DEFAULT_URL =
  "https://maratonfotografica.com/admin/sponsors";

const CENTRAL_ADMIN_ORIGIN_ALLOWLIST = new Set([
  "maratonfotografica.com",
  "www.maratonfotografica.com",
  "clickaton.com",
  "www.clickaton.com",
]);

const FOCUS_PLACEMENT_KEYS: Record<
  PartnerGlobalStatusApplication,
  readonly DnxPartnerAdPlacementKey[]
> = {
  CLICKATON: [
    "CLICKATON_EVENT_WELCOME",
    "CLICKATON_HOME_MARQUEE",
    "CLICKATON_EVENT_MARQUEE",
  ],
  FOTO_RANK: [
    "FOTORANK_CONTEST_WELCOME",
    "FOTORANK_HOME_MARQUEE",
    "FOTORANK_CONTEST_MARQUEE",
  ],
  INFO_SPOT: ["INFOSPOT_HOME_WELCOME", "INFOSPOT_HOME_MARQUEE"],
  COMPRAME_LA_FOTO: ["CLF_ALBUM_WELCOME", "CLF_LOGO_MARQUEE"],
};

export const FOTO_OFFICE_GLOBAL_STATUS_NOTE =
  "FotoOffice: Excluido de Sponsor Global.";

export type PartnerGlobalFlagRow = {
  key: string;
  label: string;
  state: PartnerFlagDisplayState;
};

export type PartnerGlobalPlacementRow = {
  placementKey: DnxPartnerAdPlacementKey | string;
  formatFamily: "WELCOME_INTERSTITIAL" | "LOGO_MARQUEE" | "OTHER";
  mounted: boolean;
  label: string;
};

export type PartnerGlobalCampaignCounts = {
  total: number | null;
  draft: number | null;
  active: number | null;
  paused: number | null;
  endedOrOther: number | null;
  unverifiable: boolean;
};

export type PartnerGlobalSyncSummary = {
  lastPublicationAt: string | null;
  lastSyncAt: string | null;
  pending: number | null;
  synced: number | null;
  failed: number | null;
  unverifiable: boolean;
  warning: string | null;
};

export type PartnerGlobalMetricsSummary = {
  impressions: number | null;
  clicks: number | null;
  ctrPercent: number | null;
  lastActivityAt: string | null;
  note: string | null;
  unverifiable: boolean;
};

export type PartnerGlobalPlatformStatus = {
  application: PartnerGlobalStatusApplication;
  label: string;
  source: "CENTRAL" | "LOCAL_REPLICA";
  health: PartnerGlobalHealthState;
  healthLabel: string;
  integrationOperational: boolean;
  flags: PartnerGlobalFlagRow[];
  placements: PartnerGlobalPlacementRow[];
  campaigns: PartnerGlobalCampaignCounts;
  sync: PartnerGlobalSyncSummary;
  metrics: PartnerGlobalMetricsSummary;
  warnings: string[];
  detailPath: string;
  centralAdminUrl: string;
  fotoOfficeNote: string;
  loadError: string | null;
  schemaAvailable: boolean;
  queryFailed: boolean;
};

export type PartnerGlobalStatusSnapshot = {
  generatedAt: string;
  platforms: PartnerGlobalPlatformStatus[];
  fotoOfficeExcluded: true;
  centralAdminUrl: string;
};

export type PartnerGlobalStatusOverview = PartnerGlobalStatusSnapshot;

const SENSITIVE_PAYLOAD_PATTERNS = [
  /DATABASE_URL/i,
  /postgresql:\/\//i,
  /mysql:\/\//i,
  /mongodb(?:\+srv)?:\/\//i,
  /redis:\/\//i,
  /connection[_-]?string/i,
  /postgres:\/\/[^\s"']+/i,
] as const;

/**
 * Interpreta flag por nombre de env (sin revelar el valor).
 * Ausente → NO_CONFIGURADO; truthy → ON; presente inválido → OFF.
 */
export function resolvePartnerFlagDisplayState(
  envName: string,
  env: NodeJS.ProcessEnv = process.env,
): PartnerFlagDisplayState {
  return resolvePartnerFlagUiState(env[envName]);
}

/** @deprecated use resolvePartnerFlagDisplayState */
export function resolvePartnerFlagUiState(
  raw: string | undefined | null,
): PartnerFlagDisplayState {
  if (raw === undefined || raw === null) return "NO_CONFIGURADO";
  const t = raw.trim();
  if (t === "") return "NO_CONFIGURADO";
  const lower = t.toLowerCase();
  if (lower === "1" || lower === "true" || lower === "on" || lower === "yes") {
    return "ON";
  }
  return "OFF";
}

export function isPartnerFlagEffectivelyOn(state: PartnerFlagDisplayState): boolean {
  return state === "ON";
}

export function resolveDnxPartnersCentralAdminUrl(
  envValue?: string | null,
): string {
  const originOverride = process.env.DNX_PARTNERS_CENTRAL_ADMIN_ORIGIN?.trim();
  if (originOverride) {
    try {
      const base = originOverride.includes("://")
        ? originOverride
        : `https://${originOverride}`;
      const host = new URL(base).hostname.toLowerCase();
      if (CENTRAL_ADMIN_ORIGIN_ALLOWLIST.has(host)) {
        const normalized = base.replace(/\/$/, "");
        return normalized.endsWith("/admin/sponsors")
          ? normalized
          : `${normalized}/admin/sponsors`;
      }
    } catch {
      /* fall through */
    }
  }

  const raw = envValue?.trim();
  if (raw && /^https:\/\//i.test(raw) && !/[?&](token|email|password|secret)=/i.test(raw)) {
    try {
      const host = new URL(raw).hostname.toLowerCase();
      if (CENTRAL_ADMIN_ORIGIN_ALLOWLIST.has(host)) {
        return raw.replace(/\/$/, "");
      }
    } catch {
      /* fall through */
    }
  }
  return PARTNERS_CENTRAL_ADMIN_DEFAULT_URL;
}

/** @deprecated use resolveDnxPartnersCentralAdminUrl */
export function resolvePartnersCentralAdminUrl(envValue?: string | null): string {
  return resolveDnxPartnersCentralAdminUrl(envValue);
}

export function assertSafePartnersCentralAdminUrl(url: string): string {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") {
      return PARTNERS_CENTRAL_ADMIN_DEFAULT_URL;
    }
    if (!CENTRAL_ADMIN_ORIGIN_ALLOWLIST.has(u.hostname.toLowerCase())) {
      return PARTNERS_CENTRAL_ADMIN_DEFAULT_URL;
    }
    for (const key of ["token", "email", "password", "secret", "access_token"]) {
      if (u.searchParams.has(key)) {
        u.searchParams.delete(key);
      }
    }
    return u.toString().replace(/\/$/, "");
  } catch {
    return PARTNERS_CENTRAL_ADMIN_DEFAULT_URL;
  }
}

/** Lanza si el payload serializado contiene secretos o connection strings. */
export function assertPartnerGlobalStatusPayloadSafe(payload: unknown): void {
  const json = JSON.stringify(payload);
  for (const pattern of SENSITIVE_PAYLOAD_PATTERNS) {
    if (pattern.test(json)) {
      throw new Error("partner_global_status_payload_contains_sensitive_data");
    }
  }
}

function placementFormatFamily(
  placementKey: string,
): PartnerGlobalPlacementRow["formatFamily"] {
  if (isWelcomeActivationPlacementKey(placementKey)) return "WELCOME_INTERSTITIAL";
  if (isLogoMarqueePlacementKey(placementKey)) return "LOGO_MARQUEE";
  return "OTHER";
}

export function listPartnerGlobalPlacementsForApp(
  application: PartnerGlobalStatusApplication,
): PartnerGlobalPlacementRow[] {
  const keys = FOCUS_PLACEMENT_KEYS[application];
  return keys.map((placementKey) => {
    const entry = AD_PLACEMENT_CATALOG.find(
      (e) => e.application === application && e.placementKey === placementKey,
    );
    const formatFamily = placementFormatFamily(placementKey);
    return {
      placementKey,
      formatFamily,
      mounted:
        formatFamily === "WELCOME_INTERSTITIAL" ||
        isMountedLogoMarqueePlacementKey(placementKey),
      label: entry?.name ?? placementKey,
    };
  });
}

export function readPartnerGlobalFlagsForApp(
  application: PartnerGlobalStatusApplication,
  env: NodeJS.ProcessEnv = process.env,
): PartnerGlobalFlagRow[] {
  const read = (key: string, label: string): PartnerGlobalFlagRow => ({
    key,
    label,
    state: resolvePartnerFlagDisplayState(key, env),
  });

  switch (application) {
    case "CLICKATON":
      return [
        read("CLICKATON_PARTNER_WELCOME_ENABLED", "Welcome de evento"),
        read("CLICKATON_HOME_MARQUEE_ENABLED", "Slider home"),
        read("CLICKATON_EVENT_MARQUEE_ENABLED", "Slider evento"),
      ];
    case "FOTO_RANK":
      return [
        read("FOTORANK_PARTNER_WELCOME_ENABLED", "Welcome de concurso"),
        read("FOTORANK_HOME_MARQUEE_ENABLED", "Slider portada"),
        read("FOTORANK_CONTEST_MARQUEE_ENABLED", "Slider concurso"),
      ];
    case "INFO_SPOT":
      return [
        read("INFOSPOT_PARTNER_ADS_ENABLED", "Ads generales"),
        read("INFOSPOT_PARTNER_ADS_ENABLED", "Welcome home"),
        read("INFOSPOT_PARTNER_ADS_ENABLED", "Marquee home"),
      ];
    case "COMPRAME_LA_FOTO":
      return [
        read("CLF_PARTNER_ADS_ENABLED", "Ads generales"),
        read("CLF_PARTNER_ALBUM_WELCOME_ENABLED", "Welcome de álbum"),
        read("CLF_PARTNER_ADS_ENABLED", "Marquee existente"),
      ];
    default:
      return [];
  }
}

export type ComputePartnerPlatformStatusInput = {
  application: PartnerGlobalStatusApplication;
  source: "CENTRAL" | "LOCAL_REPLICA";
  flags?: PartnerGlobalFlagRow[];
  campaigns?: PartnerGlobalCampaignCounts;
  sync?: PartnerGlobalSyncSummary;
  metrics?: PartnerGlobalMetricsSummary;
  schemaAvailable: boolean;
  queryFailed?: boolean;
  loadError?: string | null;
  warnings?: string[];
  centralAdminUrl?: string;
  env?: NodeJS.ProcessEnv;
};

export type ComputePartnerGlobalHealthInput = {
  flags: readonly PartnerGlobalFlagRow[];
  campaigns: PartnerGlobalCampaignCounts;
  sync: PartnerGlobalSyncSummary;
  schemaAvailable: boolean;
  queryFailed: boolean;
  loadError: string | null;
};

export function computePartnerGlobalHealth(
  input: ComputePartnerGlobalHealthInput,
): PartnerGlobalHealthState {
  if (input.loadError || input.queryFailed) return "UNVERIFIABLE";
  if (!input.schemaAvailable) return "CONFIGURATION_MISSING";
  if (input.campaigns.unverifiable || input.sync.unverifiable) return "UNVERIFIABLE";

  if (input.sync.failed != null && input.sync.failed > 0) return "SYNC_FAILED";
  if (input.sync.pending != null && input.sync.pending > 0) return "SYNC_PENDING";

  const anyFlagOn = input.flags.some((f) => isPartnerFlagEffectivelyOn(f.state));
  if (!anyFlagOn) return "FLAGS_OFF";

  if (input.campaigns.total == null) return "UNVERIFIABLE";
  if (input.campaigns.total === 0) return "NO_CAMPAIGNS";

  if (
    anyFlagOn &&
    input.campaigns.total > 0 &&
    input.sync.failed === 0
  ) {
    return "HEALTHY";
  }

  return "NO_CAMPAIGNS";
}

export function emptyCampaignCounts(unverifiable = true): PartnerGlobalCampaignCounts {
  return {
    total: null,
    draft: null,
    active: null,
    paused: null,
    endedOrOther: null,
    unverifiable,
  };
}

export function emptySyncCounts(unverifiable = true): PartnerGlobalSyncSummary {
  return {
    lastPublicationAt: null,
    lastSyncAt: null,
    pending: null,
    synced: null,
    failed: null,
    unverifiable,
    warning: null,
  };
}

/** @deprecated use emptySyncCounts */
export function emptySyncSummary(unverifiable = true): PartnerGlobalSyncSummary {
  return emptySyncCounts(unverifiable);
}

export function emptyMetrics(unverifiable = true): PartnerGlobalMetricsSummary {
  return {
    impressions: null,
    clicks: null,
    ctrPercent: null,
    lastActivityAt: null,
    note: unverifiable
      ? "Métrica no verificable en esta fuente."
      : "Métrica disponible únicamente en la plataforma de destino.",
    unverifiable,
  };
}

/** @deprecated use emptyMetrics */
export function emptyMetricsSummary(
  note: string | null = null,
  unverifiable = true,
): PartnerGlobalMetricsSummary {
  const base = emptyMetrics(unverifiable);
  return { ...base, note: note ?? base.note };
}

export function buildPartnerMetricsSummary(input: {
  impressions: number | null;
  clicks: number | null;
  lastActivityAt?: string | null;
  metricsOnlyOnDestination?: boolean;
  unverifiable?: boolean;
}): PartnerGlobalMetricsSummary {
  if (
    input.unverifiable ||
    input.impressions == null ||
    input.clicks == null
  ) {
    return emptyMetrics(true);
  }
  if (input.impressions === null && input.clicks === null) {
    return {
      impressions: null,
      clicks: null,
      ctrPercent: null,
      lastActivityAt: input.lastActivityAt ?? null,
      note: "Métrica disponible únicamente en la plataforma de destino.",
      unverifiable: false,
    };
  }
  return {
    impressions: input.impressions,
    clicks: input.clicks,
    ctrPercent: computeCtrPercent(input.impressions, input.clicks),
    lastActivityAt: input.lastActivityAt ?? null,
    note: input.metricsOnlyOnDestination
      ? "Métrica disponible únicamente en la plataforma de destino."
      : null,
    unverifiable: false,
  };
}

/** @deprecated use buildPartnerMetricsSummary */
export function buildMetricsFromCounts(input: {
  impressions: number | null;
  clicks: number | null;
  lastActivityAt?: string | null;
  note?: string | null;
  unverifiable?: boolean;
}): PartnerGlobalMetricsSummary {
  return buildPartnerMetricsSummary({
    impressions: input.impressions,
    clicks: input.clicks,
    lastActivityAt: input.lastActivityAt,
    metricsOnlyOnDestination: Boolean(input.note),
    unverifiable: input.unverifiable,
  });
}

export function localDetailPathForApp(
  application: PartnerGlobalStatusApplication,
): string {
  switch (application) {
    case "CLICKATON":
      return "/admin/sponsors/estado-global";
    case "FOTO_RANK":
      return "/dashboard/sponsors-dnx-partners";
    case "INFO_SPOT":
      return "/admin/sponsors-dnx-partners";
    case "COMPRAME_LA_FOTO":
      return "/admin/sponsors-dnx-partners";
    default:
      return "/";
  }
}

export function computePartnerPlatformStatus(
  input: ComputePartnerPlatformStatusInput,
): PartnerGlobalPlatformStatus {
  const flags = input.flags ?? readPartnerGlobalFlagsForApp(input.application, input.env);
  const campaigns =
    input.campaigns ??
    emptyCampaignCounts(!input.schemaAvailable || Boolean(input.queryFailed));
  const sync =
    input.sync ??
    emptySyncCounts(!input.schemaAvailable || Boolean(input.queryFailed));
  const metrics =
    input.metrics ??
    emptyMetrics(
      !input.schemaAvailable ||
        Boolean(input.queryFailed) ||
        input.source === "LOCAL_REPLICA",
    );
  const loadError = input.loadError ?? null;
  const queryFailed = Boolean(input.queryFailed || loadError);
  const health = computePartnerGlobalHealth({
    flags,
    campaigns,
    sync,
    schemaAvailable: input.schemaAvailable,
    queryFailed,
    loadError,
  });
  const warnings = [...(input.warnings ?? [])];
  if (sync.failed != null && sync.failed > 0) {
    warnings.push(`Hay ${sync.failed} sincronización(es) en estado FAILED.`);
  }
  if (loadError || queryFailed) {
    warnings.push("No se pudo completar la consulta de estado.");
  }
  if (!flags.some((f) => isPartnerFlagEffectivelyOn(f.state))) {
    warnings.push("Los flags publicitarios están ausentes u OFF (sin cambio visual público).");
  }

  const centralAdminUrl = assertSafePartnersCentralAdminUrl(
    resolveDnxPartnersCentralAdminUrl(input.centralAdminUrl),
  );

  return {
    application: input.application,
    label: PARTNER_GLOBAL_APP_LABELS[input.application],
    source: input.source,
    health,
    healthLabel: PARTNER_GLOBAL_HEALTH_LABELS[health],
    integrationOperational:
      health === "HEALTHY" || health === "FLAGS_OFF" || health === "NO_CAMPAIGNS",
    flags,
    placements: listPartnerGlobalPlacementsForApp(input.application),
    campaigns,
    sync,
    metrics,
    warnings,
    detailPath: localDetailPathForApp(input.application),
    centralAdminUrl,
    fotoOfficeNote: FOTO_OFFICE_GLOBAL_STATUS_NOTE,
    loadError,
    schemaAvailable: input.schemaAvailable,
    queryFailed,
  };
}

/** @deprecated use computePartnerPlatformStatus */
export function buildPartnerGlobalPlatformStatus(
  input: Omit<ComputePartnerPlatformStatusInput, "schemaAvailable" | "queryFailed"> & {
    dataSourceReady: boolean | null;
  },
): PartnerGlobalPlatformStatus {
  return computePartnerPlatformStatus({
    ...input,
    schemaAvailable: input.dataSourceReady === true,
    queryFailed: input.dataSourceReady === null || Boolean(input.loadError),
  });
}

export function buildUnverifiablePlatformStatus(
  application: PartnerGlobalStatusApplication,
  source: "CENTRAL" | "LOCAL_REPLICA",
  loadError: string,
): PartnerGlobalPlatformStatus {
  return computePartnerPlatformStatus({
    application,
    source,
    schemaAvailable: false,
    queryFailed: true,
    loadError: "consulta_fallida",
    warnings: [loadError],
    campaigns: emptyCampaignCounts(true),
    sync: emptySyncCounts(true),
    metrics: emptyMetrics(true),
  });
}

export function snapshotRuntimeFlagBooleans(): Record<string, boolean> {
  return {
    clickatonWelcome: isClickatonPartnerWelcomeEnabled(),
    clickatonHomeMarquee: isClickatonHomeMarqueeEnabled(),
    clickatonEventMarquee: isClickatonEventMarqueeEnabled(),
    fotorankWelcome: isFotorankPartnerWelcomeEnabled(),
    fotorankHomeWelcome: isFotorankHomeWelcomeEnabled(),
    fotorankHomeMarquee: isFotorankHomeMarqueeEnabled(),
    fotorankContestMarquee: isFotorankContestMarqueeEnabled(),
    infospotAds: isInfospotPartnerAdsEnabled(),
    clfAds: isClfPartnerAdsEnabled(),
    clfAlbumWelcome: isClfPartnerAlbumWelcomeEnabled(),
  };
}
