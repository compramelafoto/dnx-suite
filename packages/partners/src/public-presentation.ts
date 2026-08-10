/**
 * Presentación pública de partners: modo GRID/MARQUEE, umbral, rel SEO y clasificación admin.
 * Sin React / Prisma — recibe datos ya preparados.
 */

import type {
  DnxPartnerDisplayTier,
  DnxPartnerInstitutionalRole,
  DnxPartnerParticipationStatus,
  DnxPartnerPublicVisibility,
  DnxPartnerStatus,
  DnxPartnerType,
} from "./types";
import type { PublicPartnerDisplayItem, PublicPartnerGroup } from "./institutional";

/** 1–3 → GRID; 4+ → MARQUEE (cuando el rol lo permite). */
export const PARTNER_LOGO_MARQUEE_THRESHOLD = 4;

export type PartnerPublicPresentationMode = "GRID" | "MARQUEE";

/** Roles que siempre se muestran en grid estático (peso institucional). */
export const PARTNER_STATIC_GRID_ROLES: readonly DnxPartnerInstitutionalRole[] = [
  "ORGANIZER",
  "CO_ORGANIZER",
  "INSTITUTIONAL_SPONSOR",
  "MAIN_SPONSOR",
] as const;

/** Roles elegibles para marquee cuando hay cantidad suficiente. */
export const PARTNER_MARQUEE_ELIGIBLE_ROLES: readonly DnxPartnerInstitutionalRole[] = [
  "SPONSOR",
  "COLLABORATOR",
  "STRATEGIC_PARTNER",
  "MEDIA_PARTNER",
] as const;

export type PartnerPublicPresentationDecision = {
  mode: PartnerPublicPresentationMode;
  role: DnxPartnerInstitutionalRole;
  itemCount: number;
  /** true si el rol permite marquee y el umbral se cumple. */
  marqueeEligible: boolean;
  threshold: number;
};

export type ResolvePartnerPublicPresentationInput = {
  role: DnxPartnerInstitutionalRole;
  itemCount: number;
  /** Override umbral (default PARTNER_LOGO_MARQUEE_THRESHOLD). */
  marqueeThreshold?: number;
  /** Forzar GRID aunque el umbral permita marquee. */
  forceGrid?: boolean;
};

/**
 * Resuelve GRID vs MARQUEE para un grupo ya filtrado.
 * Organizers / co-organizers / institutional / main → siempre GRID.
 * Sponsors / collaborators / strategic / media → MARQUEE si count >= threshold.
 */
export function resolvePartnerPublicPresentation(
  input: ResolvePartnerPublicPresentationInput,
): PartnerPublicPresentationDecision {
  const threshold = input.marqueeThreshold ?? PARTNER_LOGO_MARQUEE_THRESHOLD;
  const itemCount = Math.max(0, Math.trunc(input.itemCount));
  const roleAllowsMarquee = (PARTNER_MARQUEE_ELIGIBLE_ROLES as readonly string[]).includes(
    input.role,
  );
  const marqueeEligible = roleAllowsMarquee && !input.forceGrid;
  const mode: PartnerPublicPresentationMode =
    marqueeEligible && itemCount >= threshold ? "MARQUEE" : "GRID";
  return {
    mode,
    role: input.role,
    itemCount,
    marqueeEligible,
    threshold,
  };
}

export function resolvePartnerGroupPresentation(
  group: Pick<PublicPartnerGroup, "role" | "items">,
  options?: { marqueeThreshold?: number; forceGrid?: boolean },
): PartnerPublicPresentationDecision {
  return resolvePartnerPublicPresentation({
    role: group.role,
    itemCount: group.items.length,
    marqueeThreshold: options?.marqueeThreshold,
    forceGrid: options?.forceGrid,
  });
}

/** Tamaño visual relativo por tier (bounding box normalizado; sin extremos). */
export type PartnerLogoVisualSize = "lg" | "md" | "sm" | "xs";

export function resolvePartnerLogoVisualSize(
  tier: DnxPartnerDisplayTier,
): PartnerLogoVisualSize {
  switch (tier) {
    case "INSTITUTIONAL":
      return "lg";
    case "MAIN":
      return "md";
    case "STANDARD":
      return "sm";
    case "SUPPORTING":
    default:
      return "xs";
  }
}

/**
 * rel para links de partner.
 * Tracked (/r/) no abre nueva pestaña; comerciales pueden llevar sponsored.
 */
export function resolvePartnerLinkRel(input: {
  institutionalRole: DnxPartnerInstitutionalRole;
  href: string | null | undefined;
}): string | undefined {
  const href = input.href?.trim();
  if (!href) return undefined;
  const isTracked = href.startsWith("/r/");
  const commercial = (
    [
      "MAIN_SPONSOR",
      "SPONSOR",
      "COLLABORATOR",
      "STRATEGIC_PARTNER",
      "MEDIA_PARTNER",
    ] as DnxPartnerInstitutionalRole[]
  ).includes(input.institutionalRole);

  if (isTracked) {
    return commercial ? "noopener noreferrer sponsored" : "noopener noreferrer";
  }
  return commercial
    ? "noopener noreferrer sponsored"
    : "noopener noreferrer";
}

export function partnerLogoAlt(partnerName: string): string {
  const name = partnerName.trim() || "partner";
  return `Logo de ${name}`;
}

/** Clasificación operativa para auditoría de publicación (no inventa datos). */
export type PartnerPublicationAuditClass =
  | "ALREADY_PUBLIC"
  | "READY_TO_PUBLISH"
  | "MISSING_LOGO"
  | "MISSING_DESTINATION"
  | "HIDDEN"
  | "PROSPECT"
  | "INCOMPLETE";

const PUBLIC_STATUSES: ReadonlySet<DnxPartnerParticipationStatus> = new Set([
  "CONFIRMED",
  "ACTIVE",
  "COMPLETED",
]);

/**
 * Clasifica una participación para checklist de publicación.
 * Destination NO bloquea READY_TO_PUBLISH (logo visible sin click).
 * MISSING_DESTINATION se reporta aparte cuando ya es publicable/publicado.
 */
export function classifyPartnerPublicationReadiness(input: {
  partnerStatus: DnxPartnerStatus;
  participationStatus: DnxPartnerParticipationStatus;
  publicVisibility: DnxPartnerPublicVisibility | null | undefined;
  hasApprovedLogo: boolean;
  hasDestinationUrl: boolean;
  partnerType?: DnxPartnerType | null;
  /** PERSON/GOVERNMENT pueden publicar sin logo. */
  allowWithoutLogo?: boolean;
}): {
  primary: PartnerPublicationAuditClass;
  flags: PartnerPublicationAuditClass[];
} {
  const flags: PartnerPublicationAuditClass[] = [];

  if (input.partnerStatus === "PROSPECT") {
    return { primary: "PROSPECT", flags: ["PROSPECT"] };
  }

  const statusOk = PUBLIC_STATUSES.has(input.participationStatus);
  if (!statusOk) {
    return { primary: "INCOMPLETE", flags: ["INCOMPLETE"] };
  }

  const commercial =
    input.partnerType != null &&
    input.partnerType !== "PERSON" &&
    input.partnerType !== "GOVERNMENT";
  const requireLogo = commercial && !input.allowWithoutLogo;
  const logoOk = !requireLogo || input.hasApprovedLogo;

  if (!logoOk) flags.push("MISSING_LOGO");
  if (!input.hasDestinationUrl) flags.push("MISSING_DESTINATION");

  if (input.publicVisibility === "PUBLIC") {
    flags.push("ALREADY_PUBLIC");
    if (!logoOk) return { primary: "MISSING_LOGO", flags };
    return { primary: "ALREADY_PUBLIC", flags };
  }

  flags.push("HIDDEN");
  if (!logoOk) return { primary: "MISSING_LOGO", flags };
  return { primary: "READY_TO_PUBLISH", flags };
}

export type PresentedPartnerGroup = PublicPartnerGroup & {
  presentation: PartnerPublicPresentationDecision;
};

export function presentPartnerGroupsForPublic(
  groups: PublicPartnerGroup[],
  options?: { marqueeThreshold?: number },
): PresentedPartnerGroup[] {
  return groups.map((group) => ({
    ...group,
    presentation: resolvePartnerGroupPresentation(group, options),
  }));
}

/** Items con href trackeado: clave de tracking (sin duplicar por copia visual). */
export function partnerTrackingKeyFromHref(href: string | null | undefined): string | null {
  if (!href?.startsWith("/r/")) return null;
  const key = href.slice(3).split(/[?#]/)[0]?.trim();
  return key || null;
}

export function isPartnerLogoClickable(
  item: Pick<PublicPartnerDisplayItem, "websiteUrl">,
): boolean {
  return Boolean(item.websiteUrl?.trim());
}
