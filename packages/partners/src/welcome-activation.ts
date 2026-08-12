/**
 * Activación destacada de sponsor (welcome interstitial) — contratos de dominio.
 * No monta UI; las apps consultan estas reglas antes de renderizar.
 */

import type { DnxPartnerApplication } from "./types";
import { PartnersDomainError } from "./types";
import {
  AD_PLACEMENT_CATALOG,
  type AdPlacementCatalogEntry,
  type DnxPartnerAdPlacementKey,
  type DnxPartnerCreativeFormat,
} from "./campaigns";

/** Plataformas autorizadas para activación destacada. */
export const WELCOME_ACTIVATION_APPLICATIONS = [
  "CLICKATON",
  "FOTO_RANK",
  "INFO_SPOT",
  "COMPRAME_LA_FOTO",
] as const;

export type WelcomeActivationApplication =
  (typeof WELCOME_ACTIVATION_APPLICATIONS)[number];

/**
 * Exclusión explícita (el enum `FOTO_OFFICE` permanece por compatibilidad histórica).
 * Nunca target, publish, placement ni opción admin de activaciones destacadas.
 */
export const WELCOME_ACTIVATION_EXCLUDED_APPLICATIONS = ["FOTO_OFFICE"] as const;

export type WelcomeActivationExcludedApplication =
  (typeof WELCOME_ACTIVATION_EXCLUDED_APPLICATIONS)[number];

/** Formato canónico — no crear equivalentes. */
export const WELCOME_ACTIVATION_CREATIVE_FORMAT: DnxPartnerCreativeFormat =
  "WELCOME_INTERSTITIAL";

/** Placements de activación destacada (allowlist de superficies). */
export const WELCOME_ACTIVATION_PLACEMENT_KEYS = [
  "INFOSPOT_HOME_WELCOME",
  "CLICKATON_HOME_WELCOME",
  "CLICKATON_EVENT_WELCOME",
  "FOTORANK_HOME_WELCOME",
  "FOTORANK_CONTEST_WELCOME",
  "CLF_HOME_WELCOME",
  "CLF_ALBUM_WELCOME",
] as const satisfies readonly DnxPartnerAdPlacementKey[];

export type WelcomeActivationPlacementKey =
  (typeof WELCOME_ACTIVATION_PLACEMENT_KEYS)[number];

export const WELCOME_ACTIVATION_DEFAULT_FREQUENCY_HOURS = 24;

/** Variantes de animación admitidas (UI). `random` elige entre las 4 una sola vez. */
export const WELCOME_ACTIVATION_ANIMATION_VARIANTS = [
  "fade",
  "slide-left",
  "slide-right",
  "slide-up",
] as const;

export type WelcomeActivationAnimationVariant =
  (typeof WELCOME_ACTIVATION_ANIMATION_VARIANTS)[number];

export type WelcomeActivationAnimationChoice =
  | WelcomeActivationAnimationVariant
  | "random";

/** Evento tipado de cierre — sin persistencia central en esta etapa. */
export type PartnerWelcomeDismissReason = "close_button" | "escape" | "programmatic";

export type PartnerWelcomeDismissEvent = {
  type: "PARTNER_WELCOME_DISMISS";
  campaignId: string;
  placementKey: string;
  creativeId?: string | null;
  reason: PartnerWelcomeDismissReason;
  occurredAt: string; // ISO
};

export function isWelcomeActivationApplication(
  application: DnxPartnerApplication | string,
): application is WelcomeActivationApplication {
  return (WELCOME_ACTIVATION_APPLICATIONS as readonly string[]).includes(application);
}

export function isWelcomeActivationExcludedApplication(
  application: DnxPartnerApplication | string,
): application is WelcomeActivationExcludedApplication {
  return (WELCOME_ACTIVATION_EXCLUDED_APPLICATIONS as readonly string[]).includes(
    application,
  );
}

export function isWelcomeActivationPlacementKey(
  key: string,
): key is WelcomeActivationPlacementKey {
  return (WELCOME_ACTIVATION_PLACEMENT_KEYS as readonly string[]).includes(key);
}

export function listWelcomeActivationCatalogEntries(): AdPlacementCatalogEntry[] {
  return AD_PLACEMENT_CATALOG.filter((e) =>
    isWelcomeActivationPlacementKey(e.placementKey),
  );
}

/**
 * Catálogo admin / binding: apps autorizadas, nunca FotoOffice.
 * Incluye placements no-welcome de IS/CLF para no romper campañas actuales.
 */
export function listAdPlacementCatalogForAdminBinding(): AdPlacementCatalogEntry[] {
  return AD_PLACEMENT_CATALOG.filter(
    (e) =>
      isWelcomeActivationApplication(e.application) &&
      !isWelcomeActivationExcludedApplication(e.application),
  );
}

export function assertWelcomeActivationTargetAllowed(
  application: DnxPartnerApplication | string,
): asserts application is WelcomeActivationApplication {
  if (isWelcomeActivationExcludedApplication(application)) {
    throw new PartnersDomainError(
      "VALIDATION",
      "FotoOffice está excluido de activaciones destacadas de sponsors.",
    );
  }
  if (!isWelcomeActivationApplication(application)) {
    throw new PartnersDomainError(
      "VALIDATION",
      `Aplicación no autorizada para activación destacada: ${application}`,
    );
  }
}

export function assertWelcomeActivationPlacement(
  application: DnxPartnerApplication | string,
  placementKey: string,
): asserts placementKey is WelcomeActivationPlacementKey {
  assertWelcomeActivationTargetAllowed(application);
  if (!isWelcomeActivationPlacementKey(placementKey)) {
    throw new PartnersDomainError(
      "VALIDATION",
      `Placement no es una activación destacada: ${placementKey}`,
    );
  }
  const entry = AD_PLACEMENT_CATALOG.find(
    (e) => e.application === application && e.placementKey === placementKey,
  );
  if (!entry) {
    throw new PartnersDomainError(
      "VALIDATION",
      `Placement ${placementKey} no pertenece a ${application}.`,
    );
  }
  if (!entry.allowedFormats.includes(WELCOME_ACTIVATION_CREATIVE_FORMAT)) {
    throw new PartnersDomainError(
      "VALIDATION",
      `Placement ${placementKey} no admite WELCOME_INTERSTITIAL.`,
    );
  }
}

function normalizePathname(pathname: string): string {
  const raw = pathname.trim() || "/";
  const noQuery = raw.split("?")[0]?.split("#")[0] ?? "/";
  if (noQuery.length > 1 && noQuery.endsWith("/")) {
    return noQuery.slice(0, -1);
  }
  return noQuery || "/";
}

/**
 * Defensa adicional: flujos críticos donde la activación NUNCA debe montarse,
 * aunque el placement esté autorizado.
 */
export const PARTNER_WELCOME_CRITICAL_PATH_PATTERNS: Record<
  WelcomeActivationApplication,
  readonly RegExp[]
> = {
  CLICKATON: [
    /^\/admin(\/|$)/i,
    /^\/api(\/|$)/i,
    /^\/login(\/|$)/i,
    /^\/registro(\/|$)/i,
    /^\/auth(\/|$)/i,
    /^\/r(\/|$)/i,
    /^\/tienda\/checkout(\/|$)/i,
    /^\/maratones\/[^/]+\/inscripcion(\/|$)/i,
    /\/pago(\/|$)/i,
    /\/confirmacion(\/|$)/i,
    /\/entrega(\/|$)/i,
    /\/upload(\/|$)/i,
    /\/cargar(\/|$)/i,
  ],
  FOTO_RANK: [
    /^\/admin(\/|$)/i,
    /^\/api(\/|$)/i,
    /^\/dashboard(\/|$)/i,
    /^\/login(\/|$)/i,
    /^\/crear-cuenta(\/|$)/i,
    /^\/recuperar(\/|$)/i,
    /^\/verificar-email(\/|$)/i,
    /^\/onboarding(\/|$)/i,
    /^\/jurado(\/|$)/i,
    /^\/jurados(\/|$)/i,
    /^\/r(\/|$)/i,
    /\/inscripcion(\/|$)/i,
    /\/admision(\/|$)/i,
    /\/upload(\/|$)/i,
    /\/cargar(\/|$)/i,
    /\/participante.*upload/i,
    /\/resultados\/preview(\/|$)/i,
  ],
  INFO_SPOT: [
    /^\/admin(\/|$)/i,
    /^\/api(\/|$)/i,
    /^\/login(\/|$)/i,
    /^\/auth(\/|$)/i,
    /^\/r(\/|$)/i,
  ],
  COMPRAME_LA_FOTO: [
    /^\/admin(\/|$)/i,
    /^\/api(\/|$)/i,
    /^\/dashboard(\/|$)/i,
    /^\/fotografo(\/|$)/i,
    /^\/organizador(\/|$)/i,
    /^\/lab(\/|$)/i,
    /^\/cliente(\/|$)/i,
    /^\/login(\/|$)/i,
    /^\/registro(\/|$)/i,
    /^\/auth(\/|$)/i,
    /^\/r(\/|$)/i,
    /^\/carrito(\/|$)/i,
    /^\/checkout(\/|$)/i,
    /^\/pago(\/|$)/i,
    /^\/descargas(\/|$)/i,
    /\/comprar(\/|$)/i,
    /\/confirmacion(\/|$)/i,
    /\/imprimir\/(resumen|confirmacion)(\/|$)/i,
  ],
};

/**
 * Allowlist por placement: solo estas rutas públicas pueden mostrar la activación.
 * Defensa en profundidad junto con critical paths.
 */
export const PARTNER_WELCOME_PLACEMENT_PATH_ALLOWLIST: Record<
  WelcomeActivationPlacementKey,
  readonly RegExp[]
> = {
  INFOSPOT_HOME_WELCOME: [/^\/$/],
  CLICKATON_HOME_WELCOME: [/^\/$/],
  CLICKATON_EVENT_WELCOME: [/^\/maratones\/[^/]+$/i],
  FOTORANK_HOME_WELCOME: [/^\/$/],
  FOTORANK_CONTEST_WELCOME: [/^\/concursos\/[^/]+$/i],
  CLF_HOME_WELCOME: [/^\/$/],
  CLF_ALBUM_WELCOME: [/^\/g\/[^/]+$/i, /^\/e\/[^/]+$/i, /^\/a\/[^/]+$/i],
};

export function isPartnerWelcomeCriticalPath(
  application: WelcomeActivationApplication,
  pathname: string,
): boolean {
  const path = normalizePathname(pathname);
  return PARTNER_WELCOME_CRITICAL_PATH_PATTERNS[application].some((re) => re.test(path));
}

export function isPartnerWelcomePathAllowedForPlacement(
  placementKey: WelcomeActivationPlacementKey,
  pathname: string,
): boolean {
  const path = normalizePathname(pathname);
  return PARTNER_WELCOME_PLACEMENT_PATH_ALLOWLIST[placementKey].some((re) =>
    re.test(path),
  );
}

export type CanMountPartnerWelcomeResult =
  | { ok: true }
  | { ok: false; reason: string };

/**
 * Gate único para montar activación destacada (sin side-effects).
 * Las apps deben llamar esto antes de renderizar el interstitial.
 */
export function canMountPartnerWelcomeActivation(input: {
  application: DnxPartnerApplication | string;
  placementKey: string;
  pathname: string;
}): CanMountPartnerWelcomeResult {
  if (isWelcomeActivationExcludedApplication(input.application)) {
    return { ok: false, reason: "foto_office_excluded" };
  }
  if (!isWelcomeActivationApplication(input.application)) {
    return { ok: false, reason: "application_not_allowed" };
  }
  if (!isWelcomeActivationPlacementKey(input.placementKey)) {
    return { ok: false, reason: "placement_not_welcome" };
  }
  const entry = AD_PLACEMENT_CATALOG.find(
    (e) =>
      e.application === input.application && e.placementKey === input.placementKey,
  );
  if (!entry) {
    return { ok: false, reason: "placement_app_mismatch" };
  }
  if (isPartnerWelcomeCriticalPath(input.application, input.pathname)) {
    return { ok: false, reason: "critical_path" };
  }
  if (!isPartnerWelcomePathAllowedForPlacement(input.placementKey, input.pathname)) {
    return { ok: false, reason: "path_not_in_allowlist" };
  }
  return { ok: true };
}

export function pickWelcomeAnimationVariant(
  choice: WelcomeActivationAnimationChoice,
  random: () => number = Math.random,
): WelcomeActivationAnimationVariant {
  if (choice !== "random") return choice;
  const list = WELCOME_ACTIVATION_ANIMATION_VARIANTS;
  const idx = Math.min(list.length - 1, Math.floor(random() * list.length));
  return list[idx] ?? "fade";
}
