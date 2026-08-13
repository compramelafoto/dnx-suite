/**
 * Administración del Slider de marcas (LOGO_MARQUEE).
 * Sin migraciones. Placements montados vs preparados (próximamente).
 * Modelo: una campaña por sponsor; varias campañas pueden coincidir en un placement.
 */
import { PartnersDomainError } from "./types";
import type { DnxPartnerApplication, DnxPartnerContextType } from "./types";
import {
  AD_PLACEMENT_CATALOG,
  type AdPlacementCatalogEntry,
  type DnxPartnerAdPlacementKey,
  type DnxPartnerCreativeFormat,
} from "./campaigns";
import { isWelcomeActivationExcludedApplication } from "./welcome-activation";

/** Formato canónico — no crear BRAND_SLIDER / equivalentes. */
export const LOGO_MARQUEE_CREATIVE_FORMAT: DnxPartnerCreativeFormat = "LOGO_MARQUEE";

export const MARQUEE_ADMIN_FORMAT_LABEL = "Slider de marcas";
export const MARQUEE_ADMIN_FORMAT_DESCRIPTION =
  "Franja continua de logos patrocinadores dentro de una superficie autorizada.";

/** Placements de slider de marcas en catálogo. */
export const LOGO_MARQUEE_PLACEMENT_KEYS = [
  "INFOSPOT_HOME_MARQUEE",
  "CLF_LOGO_MARQUEE",
  "CLICKATON_HOME_MARQUEE",
  "CLICKATON_EVENT_MARQUEE",
  "FOTORANK_HOME_MARQUEE",
  "FOTORANK_CONTEST_MARQUEE",
] as const satisfies readonly DnxPartnerAdPlacementKey[];

export type LogoMarqueePlacementKey = (typeof LOGO_MARQUEE_PLACEMENT_KEYS)[number];

/**
 * Runtime público montado:
 * InfoSpot home, CLF portada, Clickatón home/evento, FotoRank home/concurso.
 */
export const MOUNTED_LOGO_MARQUEE_PLACEMENT_KEYS = [
  "INFOSPOT_HOME_MARQUEE",
  "CLF_LOGO_MARQUEE",
  "CLICKATON_HOME_MARQUEE",
  "CLICKATON_EVENT_MARQUEE",
  "FOTORANK_HOME_MARQUEE",
  "FOTORANK_CONTEST_MARQUEE",
] as const satisfies readonly LogoMarqueePlacementKey[];

export type MountedLogoMarqueePlacementKey =
  (typeof MOUNTED_LOGO_MARQUEE_PLACEMENT_KEYS)[number];

/** En catálogo, sin montaje público — no publicables. */
export const UNMOUNTED_LOGO_MARQUEE_PLACEMENT_KEYS = [] as const satisfies readonly LogoMarqueePlacementKey[];

export type MarqueeAdminScopeKind =
  | "GLOBAL"
  | "PLATFORM"
  | "EDITION"
  | "CONTEST";

export type MarqueeAdminPlacementOption = {
  application: Exclude<DnxPartnerApplication, "FOTO_OFFICE" | "DNX_SUITE" | "OTHER">;
  placementKey: LogoMarqueePlacementKey;
  name: string;
  description: string;
  mounted: boolean;
  selectable: boolean;
  /** Disponible | Próximamente */
  availabilityLabel: "Disponible" | "Próximamente";
  disabledReason: string | null;
  allowedScopeKinds: readonly MarqueeAdminScopeKind[];
  requiresContextId: boolean;
};

export type MarqueePlacementMatrixRow = {
  application: DnxPartnerApplication;
  placementKey: LogoMarqueePlacementKey;
  allowedFormats: readonly DnxPartnerCreativeFormat[];
  mounted: boolean;
  publishable: boolean;
  allowedScopeKinds: readonly MarqueeAdminScopeKind[];
  requiredContextTypes: readonly DnxPartnerContextType[] | null;
};

const SCOPE_BY_KEY: Record<
  LogoMarqueePlacementKey,
  {
    scopes: readonly MarqueeAdminScopeKind[];
    contextTypes: readonly DnxPartnerContextType[] | null;
  }
> = {
  INFOSPOT_HOME_MARQUEE: { scopes: ["GLOBAL", "PLATFORM"], contextTypes: null },
  CLF_LOGO_MARQUEE: { scopes: ["GLOBAL", "PLATFORM"], contextTypes: null },
  CLICKATON_HOME_MARQUEE: { scopes: ["GLOBAL", "PLATFORM"], contextTypes: null },
  CLICKATON_EVENT_MARQUEE: {
    scopes: ["EDITION"],
    contextTypes: ["EDITION", "EVENT"],
  },
  FOTORANK_HOME_MARQUEE: { scopes: ["GLOBAL", "PLATFORM"], contextTypes: null },
  FOTORANK_CONTEST_MARQUEE: {
    scopes: ["GLOBAL", "PLATFORM", "CONTEST"],
    contextTypes: ["CONTEST"],
  },
};

export function isLogoMarqueePlacementKey(key: string): key is LogoMarqueePlacementKey {
  return (LOGO_MARQUEE_PLACEMENT_KEYS as readonly string[]).includes(key);
}

export function isMountedLogoMarqueePlacementKey(
  key: string,
): key is MountedLogoMarqueePlacementKey {
  return (MOUNTED_LOGO_MARQUEE_PLACEMENT_KEYS as readonly string[]).includes(key);
}

export function listLogoMarqueePlacementMatrix(): MarqueePlacementMatrixRow[] {
  const out: MarqueePlacementMatrixRow[] = [];
  for (const key of LOGO_MARQUEE_PLACEMENT_KEYS) {
    const entry = AD_PLACEMENT_CATALOG.find((e) => e.placementKey === key);
    if (!entry) continue;
    const meta = SCOPE_BY_KEY[key];
    const mounted = isMountedLogoMarqueePlacementKey(key);
    out.push({
      application: entry.application,
      placementKey: key,
      allowedFormats: entry.allowedFormats,
      mounted,
      publishable: mounted,
      allowedScopeKinds: meta.scopes,
      requiredContextTypes: meta.contextTypes,
    });
  }
  return out;
}

export function listLogoMarqueePlacementsForAdminUi(): MarqueeAdminPlacementOption[] {
  const out: MarqueeAdminPlacementOption[] = [];
  for (const entry of AD_PLACEMENT_CATALOG) {
    if (!isLogoMarqueePlacementKey(entry.placementKey)) continue;
    if (isWelcomeActivationExcludedApplication(entry.application)) continue;
    if (
      entry.application !== "CLICKATON" &&
      entry.application !== "FOTO_RANK" &&
      entry.application !== "INFO_SPOT" &&
      entry.application !== "COMPRAME_LA_FOTO"
    ) {
      continue;
    }
    const mounted = isMountedLogoMarqueePlacementKey(entry.placementKey);
    const meta = SCOPE_BY_KEY[entry.placementKey];
    out.push({
      application: entry.application,
      placementKey: entry.placementKey,
      name: entry.name,
      description: entry.description,
      mounted,
      selectable: mounted,
      availabilityLabel: mounted ? "Disponible" : "Próximamente",
      disabledReason: mounted ? null : "Superficie todavía no habilitada",
      allowedScopeKinds: meta.scopes,
      requiresContextId: meta.contextTypes != null,
    });
  }
  return out;
}

export function listSelectableLogoMarqueePlacementsForAdmin(): MarqueeAdminPlacementOption[] {
  return listLogoMarqueePlacementsForAdminUi().filter((p) => p.selectable);
}

export function assertLogoMarqueePlacementPublishable(
  application: DnxPartnerApplication | string,
  placementKey: string,
): asserts placementKey is MountedLogoMarqueePlacementKey {
  if (isWelcomeActivationExcludedApplication(application)) {
    throw new PartnersDomainError(
      "VALIDATION",
      "FotoOffice está excluido del Slider de marcas.",
    );
  }
  if (!isLogoMarqueePlacementKey(placementKey)) {
    throw new PartnersDomainError(
      "VALIDATION",
      `El placement ${placementKey} no es un Slider de marcas (LOGO_MARQUEE).`,
    );
  }
  const entry = AD_PLACEMENT_CATALOG.find(
    (e) => e.placementKey === placementKey && e.application === application,
  );
  if (!entry) {
    throw new PartnersDomainError(
      "VALIDATION",
      `El placement ${placementKey} no pertenece a la aplicación ${application}.`,
    );
  }
  if (!entry.allowedFormats.includes("LOGO_MARQUEE") && !entry.allowedFormats.includes("LOGO")) {
    throw new PartnersDomainError(
      "VALIDATION",
      `El placement ${placementKey} no admite formato LOGO_MARQUEE.`,
    );
  }
  if (!isMountedLogoMarqueePlacementKey(placementKey)) {
    throw new PartnersDomainError(
      "VALIDATION",
      `El placement ${placementKey} aún no tiene runtime montado (Próximamente).`,
    );
  }
}

export function assertLogoMarqueeScopeConfig(input: {
  placementKey: LogoMarqueePlacementKey;
  scopeKind: MarqueeAdminScopeKind;
  contextId?: string | null;
}): void {
  const meta = SCOPE_BY_KEY[input.placementKey];
  if (!meta.scopes.includes(input.scopeKind)) {
    throw new PartnersDomainError(
      "VALIDATION",
      `Alcance ${input.scopeKind} no válido para ${input.placementKey}.`,
    );
  }
  const needsId = input.scopeKind === "CONTEST" || input.scopeKind === "EDITION";
  const id = input.contextId?.trim() ?? "";
  if (needsId && !id) {
    throw new PartnersDomainError(
      "VALIDATION",
      `El placement ${input.placementKey} requiere un contexto canónico (ID).`,
    );
  }
  if (!needsId && id) {
    throw new PartnersDomainError(
      "VALIDATION",
      `El placement ${input.placementKey} no admite contextId (alcance GLOBAL/PLATFORM).`,
    );
  }
}

/**
 * Validación de creative+placement antes de publicar/vincular de forma productiva.
 * No interpreta participation nula como global.
 */
export function assertLogoMarqueeBindingAllowed(input: {
  application: DnxPartnerApplication | string;
  placementKey: string;
  creativeFormat?: DnxPartnerCreativeFormat | string | null;
  participationContextType?: DnxPartnerContextType | string | null;
  participationContextId?: string | null;
  /** Si true, exige participation explícita (no huérfana). */
  requireExplicitParticipation?: boolean;
}): void {
  assertLogoMarqueePlacementPublishable(input.application, input.placementKey);
  if (
    input.creativeFormat &&
    input.creativeFormat !== "LOGO_MARQUEE" &&
    input.creativeFormat !== "LOGO"
  ) {
    throw new PartnersDomainError(
      "VALIDATION",
      `Formato ${input.creativeFormat} incompatible con Slider de marcas.`,
    );
  }
  if (input.requireExplicitParticipation) {
    if (!input.participationContextType) {
      throw new PartnersDomainError(
        "VALIDATION",
        "Campañas huérfanas (participation nula) no son válidas. Definí alcance GLOBAL/PLATFORM explícito o contexto.",
      );
    }
  }
  const key = input.placementKey as LogoMarqueePlacementKey;
  const meta = SCOPE_BY_KEY[key];
  if (meta.contextTypes) {
    const ct = input.participationContextType ?? "";
    if (!(meta.contextTypes as readonly string[]).includes(ct)) {
      throw new PartnersDomainError(
        "VALIDATION",
        `Contexto ${ct || "(vacío)"} incorrecto para ${key}.`,
      );
    }
    if (!input.participationContextId?.trim()) {
      throw new PartnersDomainError(
        "VALIDATION",
        `ID contextual vacío para ${key}.`,
      );
    }
  }
}

export function marqueeAdminCatalogMeta(): {
  format: typeof LOGO_MARQUEE_CREATIVE_FORMAT;
  formatLabel: string;
  formatDescription: string;
  mountedKeys: readonly string[];
  unmountedKeys: readonly string[];
} {
  return {
    format: LOGO_MARQUEE_CREATIVE_FORMAT,
    formatLabel: MARQUEE_ADMIN_FORMAT_LABEL,
    formatDescription: MARQUEE_ADMIN_FORMAT_DESCRIPTION,
    mountedKeys: MOUNTED_LOGO_MARQUEE_PLACEMENT_KEYS,
    unmountedKeys: UNMOUNTED_LOGO_MARQUEE_PLACEMENT_KEYS,
  };
}

export function getLogoMarqueeCatalogEntry(
  application: string,
  placementKey: string,
): AdPlacementCatalogEntry | null {
  return (
    AD_PLACEMENT_CATALOG.find(
      (e) => e.application === application && e.placementKey === placementKey,
    ) ?? null
  );
}
