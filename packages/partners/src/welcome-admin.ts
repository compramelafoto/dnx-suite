/**
 * Administración de activaciones destacadas (WELCOME_INTERSTITIAL).
 * Sin migraciones. Placements montados vs catálogo técnico.
 */
import { PartnersDomainError } from "./types";
import type { DnxPartnerApplication, DnxPartnerContextType } from "./types";
import {
  AD_PLACEMENT_CATALOG,
  isClickatonPartnerWelcomeEnabled,
  isClfPartnerAdsEnabled,
  isClfPartnerAlbumWelcomeEnabled,
  isFotorankPartnerWelcomeEnabled,
  isInfospotPartnerAdsEnabled,
  type AdPlacementCatalogEntry,
  type DnxPartnerAdPlacementKey,
} from "./campaigns";
import {
  WELCOME_ACTIVATION_CREATIVE_FORMAT,
  WELCOME_ACTIVATION_DEFAULT_FREQUENCY_HOURS,
  WELCOME_ACTIVATION_PLACEMENT_KEYS,
  assertWelcomeActivationPlacement,
  assertWelcomeActivationTargetAllowed,
  isWelcomeActivationExcludedApplication,
  isWelcomeActivationPlacementKey,
  type WelcomeActivationApplication,
  type WelcomeActivationPlacementKey,
} from "./welcome-activation";
import {
  isPartnerCampaignEligibleForAlbumContext,
  isPartnerCampaignEligibleForContestContext,
  isPartnerCampaignEligibleForEditionContext,
  type PartnerCampaignScopeContext,
} from "./campaign-edition-context";
import { assertSafePartnerDestinationUrl } from "./tracking";
import {
  assertWelcomeCanonicalContextIdFormat,
  validateWelcomeAssetForPublish,
  type WelcomeAssetPublishCheckInput,
} from "./welcome-asset-context";

/** Placements con runtime público ya montado (Etapas 3–5 + InfoSpot). */
export const MOUNTED_WELCOME_PLACEMENT_KEYS = [
  "INFOSPOT_HOME_WELCOME",
  "CLICKATON_EVENT_WELCOME",
  "FOTORANK_CONTEST_WELCOME",
  "CLF_ALBUM_WELCOME",
] as const satisfies readonly WelcomeActivationPlacementKey[];

export type MountedWelcomePlacementKey = (typeof MOUNTED_WELCOME_PLACEMENT_KEYS)[number];

/** Placements en catálogo técnico pero sin montaje público aún. */
export const UNMOUNTED_WELCOME_PLACEMENT_KEYS = [
  "CLICKATON_HOME_WELCOME",
  "FOTORANK_HOME_WELCOME",
  "CLF_HOME_WELCOME",
] as const satisfies readonly WelcomeActivationPlacementKey[];

export const WELCOME_ADMIN_FORMAT_LABEL = "Activación destacada";
export const WELCOME_ADMIN_FORMAT_DESCRIPTION =
  "Ventana patrocinada que aparece una vez cada 24 horas en una superficie autorizada.";

export type WelcomeAdminScopeKind =
  | "GLOBAL"
  | "PLATFORM"
  | "EDITION"
  | "CONTEST"
  | "ALBUM";

export type WelcomeAdminPlacementOption = {
  application: WelcomeActivationApplication;
  placementKey: WelcomeActivationPlacementKey;
  name: string;
  description: string;
  mounted: boolean;
  selectable: boolean;
  disabledReason: string | null;
};

export function isMountedWelcomePlacementKey(
  key: string,
): key is MountedWelcomePlacementKey {
  return (MOUNTED_WELCOME_PLACEMENT_KEYS as readonly string[]).includes(key);
}

export function listWelcomePlacementsForAdminUi(): WelcomeAdminPlacementOption[] {
  const out: WelcomeAdminPlacementOption[] = [];
  for (const entry of AD_PLACEMENT_CATALOG) {
    if (!isWelcomeActivationPlacementKey(entry.placementKey)) continue;
    if (isWelcomeActivationExcludedApplication(entry.application)) continue;
    const mounted = isMountedWelcomePlacementKey(entry.placementKey);
    out.push({
      application: entry.application as WelcomeActivationApplication,
      placementKey: entry.placementKey,
      name: entry.name,
      description: entry.description,
      mounted,
      selectable: mounted,
      disabledReason: mounted ? null : "Superficie todavía no habilitada",
    });
  }
  return out;
}

/** Solo opciones publicables (runtime montado). */
export function listSelectableWelcomePlacementsForAdmin(): WelcomeAdminPlacementOption[] {
  return listWelcomePlacementsForAdminUi().filter((p) => p.selectable);
}

export function assertWelcomePlacementPublishable(
  application: DnxPartnerApplication | string,
  placementKey: string,
): asserts placementKey is MountedWelcomePlacementKey {
  assertWelcomeActivationPlacement(application, placementKey);
  if (!isMountedWelcomePlacementKey(placementKey)) {
    throw new PartnersDomainError(
      "VALIDATION",
      `El placement ${placementKey} aún no tiene runtime montado. Elegí una superficie habilitada.`,
    );
  }
}

export type WelcomeRuntimeFlagRow = {
  key: string;
  label: string;
  application: WelcomeActivationApplication | "CLF_ALBUM";
  enabled: boolean;
};

/**
 * Lectura local de flags (sin secretos). Default OFF = deshabilitado.
 */
export function getWelcomeRuntimeFlagSnapshot(): WelcomeRuntimeFlagRow[] {
  return [
    {
      key: "CLICKATON_PARTNER_WELCOME_ENABLED",
      label: "Clickatón · welcome evento",
      application: "CLICKATON",
      enabled: isClickatonPartnerWelcomeEnabled(),
    },
    {
      key: "FOTORANK_PARTNER_WELCOME_ENABLED",
      label: "FotoRank · welcome concurso",
      application: "FOTO_RANK",
      enabled: isFotorankPartnerWelcomeEnabled(),
    },
    {
      key: "INFOSPOT_PARTNER_ADS_ENABLED",
      label: "InfoSpot · ads / welcome home",
      application: "INFO_SPOT",
      enabled: isInfospotPartnerAdsEnabled(),
    },
    {
      key: "CLF_PARTNER_ADS_ENABLED",
      label: "ComprameLaFoto · ads (kill switch)",
      application: "COMPRAME_LA_FOTO",
      enabled: isClfPartnerAdsEnabled(),
    },
    {
      key: "CLF_PARTNER_ALBUM_WELCOME_ENABLED",
      label: "ComprameLaFoto · welcome álbum",
      application: "CLF_ALBUM",
      enabled: isClfPartnerAlbumWelcomeEnabled(),
    },
  ];
}

export function flagsRequiredForWelcomePlacement(
  placementKey: MountedWelcomePlacementKey,
): string[] {
  switch (placementKey) {
    case "CLICKATON_EVENT_WELCOME":
      return ["CLICKATON_PARTNER_WELCOME_ENABLED"];
    case "FOTORANK_CONTEST_WELCOME":
      return ["FOTORANK_PARTNER_WELCOME_ENABLED"];
    case "INFOSPOT_HOME_WELCOME":
      return ["INFOSPOT_PARTNER_ADS_ENABLED"];
    case "CLF_ALBUM_WELCOME":
      return ["CLF_PARTNER_ADS_ENABLED", "CLF_PARTNER_ALBUM_WELCOME_ENABLED"];
    default:
      return [];
  }
}

export function isWelcomeRuntimeVisibleForPlacement(
  placementKey: MountedWelcomePlacementKey,
): boolean {
  const snap = getWelcomeRuntimeFlagSnapshot();
  const required = flagsRequiredForWelcomePlacement(placementKey);
  return required.every((k) => snap.find((r) => r.key === k)?.enabled === true);
}

export const WELCOME_FLAG_OFF_PUBLISH_WARNING =
  "La campaña quedará configurada, pero no será visible mientras el runtime esté deshabilitado.";

export type WelcomeScopeConfigInput = {
  scopeKind: WelcomeAdminScopeKind;
  application: DnxPartnerApplication | string;
  /** ID canónico cuando el alcance es contextual. */
  contextId?: string | null;
};

/**
 * Valida alcance administrativo: GLOBAL/PLATFORM sin ID; EDITION/CONTEST/ALBUM con ID y app correcta.
 */
export function assertWelcomeAdminScopeConfig(input: WelcomeScopeConfigInput): void {
  assertWelcomeActivationTargetAllowed(input.application);
  const app = input.application as WelcomeActivationApplication;
  const id = input.contextId?.trim() || null;

  switch (input.scopeKind) {
    case "GLOBAL":
    case "PLATFORM":
      if (id) {
        throw new PartnersDomainError(
          "VALIDATION",
          "Alcance global/plataforma no debe incluir entidad contextual.",
        );
      }
      return;
    case "EDITION":
      if (app !== "CLICKATON") {
        throw new PartnersDomainError(
          "VALIDATION",
          "El alcance evento/edición solo aplica a Clickatón.",
        );
      }
      if (!id) {
        throw new PartnersDomainError(
          "VALIDATION",
          "Seleccioná un evento o edición de Clickatón.",
        );
      }
      return;
    case "CONTEST":
      if (app !== "FOTO_RANK") {
        throw new PartnersDomainError(
          "VALIDATION",
          "El alcance concurso solo aplica a FotoRank.",
        );
      }
      if (!id) {
        throw new PartnersDomainError("VALIDATION", "Seleccioná un concurso de FotoRank.");
      }
      return;
    case "ALBUM":
      if (app !== "COMPRAME_LA_FOTO") {
        throw new PartnersDomainError(
          "VALIDATION",
          "El alcance álbum solo aplica a ComprameLaFoto.",
        );
      }
      if (!id) {
        throw new PartnersDomainError(
          "VALIDATION",
          "Seleccioná un álbum público de ComprameLaFoto.",
        );
      }
      return;
    default:
      throw new PartnersDomainError("VALIDATION", "Alcance de campaña inválido.");
  }
}

export function contextTypeForWelcomeScope(
  scopeKind: WelcomeAdminScopeKind,
): DnxPartnerContextType {
  switch (scopeKind) {
    case "GLOBAL":
      return "GLOBAL";
    case "PLATFORM":
      return "PLATFORM";
    case "EDITION":
      return "EDITION";
    case "CONTEST":
      return "CONTEST";
    case "ALBUM":
      return "ALBUM";
  }
}

export function assertWelcomeParticipationMatchesScope(input: {
  scopeKind: WelcomeAdminScopeKind;
  application: DnxPartnerApplication | string;
  participation: PartnerCampaignScopeContext | null | undefined;
  contextId?: string | null;
}): void {
  assertWelcomeAdminScopeConfig({
    scopeKind: input.scopeKind,
    application: input.application,
    contextId: input.contextId,
  });

  const p = input.participation;
  if (input.scopeKind === "GLOBAL" || input.scopeKind === "PLATFORM") {
    if (!p) {
      throw new PartnersDomainError(
        "VALIDATION",
        "La campaña global debe vincularse a una participación GLOBAL o PLATFORM explícita (no huérfana).",
      );
    }
    const ctx = String(p.contextType);
    if (ctx !== "GLOBAL" && ctx !== "PLATFORM") {
      throw new PartnersDomainError(
        "VALIDATION",
        "Participación global/plataforma inválida.",
      );
    }
    if (p.application !== input.application && input.scopeKind === "PLATFORM") {
      throw new PartnersDomainError(
        "VALIDATION",
        "La participación PLATFORM debe coincidir con la aplicación.",
      );
    }
    return;
  }

  if (!p) {
    throw new PartnersDomainError(
      "VALIDATION",
      "Falta participación contextual (no se admiten campañas huérfanas).",
    );
  }

  const scopeId = (input.contextId ?? p.contextId ?? "").trim();
  if (input.scopeKind === "EDITION") {
    if (
      !isPartnerCampaignEligibleForEditionContext({
        editionId: scopeId,
        participation: p,
      })
    ) {
      throw new PartnersDomainError("VALIDATION", "Participación de edición inválida.");
    }
    return;
  }
  if (input.scopeKind === "CONTEST") {
    if (
      !isPartnerCampaignEligibleForContestContext({
        contestId: scopeId,
        participation: p,
      })
    ) {
      throw new PartnersDomainError("VALIDATION", "Participación de concurso inválida.");
    }
    return;
  }
  if (input.scopeKind === "ALBUM") {
    if (
      !isPartnerCampaignEligibleForAlbumContext({
        albumId: scopeId,
        participation: p,
      })
    ) {
      throw new PartnersDomainError("VALIDATION", "Participación de álbum inválida.");
    }
  }
}

export type WelcomeAdminPrePublishIssue = {
  code: string;
  message: string;
  severity: "error" | "warning";
};

export type WelcomeAdminPrePublishInput = {
  partnerStatus: string;
  partnerArchivedAt?: Date | string | null;
  campaignStatus: string;
  campaignArchivedAt?: Date | string | null;
  application: DnxPartnerApplication | string;
  placementKeys: readonly string[];
  hasApprovedCreative: boolean;
  hasApprovedAssetWithUrl: boolean;
  destinationUrl: string | null | undefined;
  scopeKind: WelcomeAdminScopeKind;
  contextId?: string | null;
  participation: PartnerCampaignScopeContext | null | undefined;
  /** Detalle del asset de la creative welcome; si falta, hasApprovedAssetWithUrl no basta. */
  welcomeAsset?: WelcomeAssetPublishCheckInput | null;
};

/**
 * Validación central previa a publicar / activar welcome.
 */
export function validateWelcomeCampaignBeforePublish(
  input: WelcomeAdminPrePublishInput,
): WelcomeAdminPrePublishIssue[] {
  const issues: WelcomeAdminPrePublishIssue[] = [];

  if (isWelcomeActivationExcludedApplication(input.application)) {
    issues.push({
      code: "FOTO_OFFICE",
      message: "FotoOffice está excluido de activaciones destacadas.",
      severity: "error",
    });
    return issues;
  }

  try {
    assertWelcomeActivationTargetAllowed(input.application);
  } catch (e) {
    issues.push({
      code: "APP",
      message: e instanceof Error ? e.message : "Aplicación no autorizada",
      severity: "error",
    });
  }

  if (input.partnerArchivedAt || input.partnerStatus === "ARCHIVED") {
    issues.push({
      code: "PARTNER",
      message: "El sponsor está archivado o inactivo.",
      severity: "error",
    });
  } else if (input.partnerStatus !== "ACTIVE") {
    issues.push({
      code: "PARTNER_STATUS",
      message: "El sponsor debe estar ACTIVE.",
      severity: "error",
    });
  }

  if (input.campaignArchivedAt) {
    issues.push({
      code: "CAMPAIGN_ARCHIVED",
      message: "La campaña está archivada.",
      severity: "error",
    });
  }

  const welcomePlacements = input.placementKeys.filter(isWelcomeActivationPlacementKey);
  if (welcomePlacements.length === 0) {
    issues.push({
      code: "PLACEMENT",
      message: "Vinculá un placement de activación destacada habilitado.",
      severity: "error",
    });
  } else {
    for (const key of welcomePlacements) {
      try {
        assertWelcomePlacementPublishable(input.application, key);
      } catch (e) {
        issues.push({
          code: "PLACEMENT_MOUNT",
          message: e instanceof Error ? e.message : "Placement no publicable",
          severity: "error",
        });
      }
      if (isMountedWelcomePlacementKey(key) && !isWelcomeRuntimeVisibleForPlacement(key)) {
        issues.push({
          code: "FLAG_OFF",
          message: WELCOME_FLAG_OFF_PUBLISH_WARNING,
          severity: "warning",
        });
      }
    }
  }

  try {
    assertWelcomeParticipationMatchesScope({
      scopeKind: input.scopeKind,
      application: input.application,
      participation: input.participation,
      contextId: input.contextId,
    });
  } catch (e) {
    issues.push({
      code: "SCOPE",
      message: e instanceof Error ? e.message : "Alcance inválido",
      severity: "error",
    });
  }

  if (
    input.scopeKind === "EDITION" ||
    input.scopeKind === "CONTEST" ||
    input.scopeKind === "ALBUM"
  ) {
    try {
      assertWelcomeCanonicalContextIdFormat(
        input.scopeKind,
        input.contextId ?? input.participation?.contextId,
      );
    } catch (e) {
      issues.push({
        code: "CONTEXT_ID",
        message: e instanceof Error ? e.message : "ID contextual inválido",
        severity: "error",
      });
    }
  }

  if (!input.hasApprovedCreative) {
    issues.push({
      code: "CREATIVE",
      message: "Se requiere al menos un creative APPROVED con formato WELCOME_INTERSTITIAL.",
      severity: "error",
    });
  }

  if (input.welcomeAsset) {
    for (const a of validateWelcomeAssetForPublish(input.welcomeAsset)) {
      issues.push(a);
    }
  } else if (!input.hasApprovedAssetWithUrl) {
    issues.push({
      code: "ASSET",
      message:
        "Se requiere un asset del sponsor aprobado formalmente (no URL suelta ni PENDING).",
      severity: "error",
    });
  } else {
    issues.push({
      code: "ASSET_DETAIL",
      message:
        "No se pudo verificar el asset aprobado del sponsor. Revisá la creative vinculada.",
      severity: "error",
    });
  }

  const dest = input.destinationUrl?.trim() ?? "";
  if (!dest) {
    issues.push({
      code: "DESTINATION",
      message: "Definí una URL de destino.",
      severity: "error",
    });
  } else {
    try {
      assertSafePartnerDestinationUrl(dest);
    } catch (e) {
      issues.push({
        code: "DESTINATION_UNSAFE",
        message: e instanceof Error ? e.message : "URL de destino insegura.",
        severity: "error",
      });
    }
  }

  return issues;
}

export function welcomeAdminCatalogMeta(): {
  format: typeof WELCOME_ACTIVATION_CREATIVE_FORMAT;
  formatLabel: string;
  formatDescription: string;
  frequencyHours: number;
  mountedKeys: readonly MountedWelcomePlacementKey[];
  unmountedKeys: readonly WelcomeActivationPlacementKey[];
} {
  return {
    format: WELCOME_ACTIVATION_CREATIVE_FORMAT,
    formatLabel: WELCOME_ADMIN_FORMAT_LABEL,
    formatDescription: WELCOME_ADMIN_FORMAT_DESCRIPTION,
    frequencyHours: WELCOME_ACTIVATION_DEFAULT_FREQUENCY_HOURS,
    mountedKeys: MOUNTED_WELCOME_PLACEMENT_KEYS,
    unmountedKeys: UNMOUNTED_WELCOME_PLACEMENT_KEYS as unknown as WelcomeActivationPlacementKey[],
  };
}

export type { AdPlacementCatalogEntry, DnxPartnerAdPlacementKey };
