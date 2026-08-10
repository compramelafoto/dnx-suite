/**
 * Roles institucionales, jerarquía visual y agrupamiento público.
 * Independientes del aporte (contribution) y del participationType legacy.
 */

import {
  DNX_PARTNER_DISPLAY_TIERS,
  DNX_PARTNER_INSTITUTIONAL_ROLES,
  type DnxPartnerDisplayTier,
  type DnxPartnerInstitutionalRole,
  type DnxPartnerParticipationStatus,
  type DnxPartnerParticipationType,
  type DnxPartnerPublicVisibility,
  type DnxPartnerType,
  PartnersDomainError,
} from "./types";

export { DNX_PARTNER_DISPLAY_TIERS, DNX_PARTNER_INSTITUTIONAL_ROLES };

/** Labels públicos estándar (es-AR). */
export const INSTITUTIONAL_ROLE_LABELS: Record<DnxPartnerInstitutionalRole, string> = {
  ORGANIZER: "Organizador",
  CO_ORGANIZER: "Coorganizador",
  INSTITUTIONAL_SPONSOR: "Auspiciante institucional",
  MAIN_SPONSOR: "Sponsor principal",
  SPONSOR: "Sponsor",
  COLLABORATOR: "Colaborador",
  STRATEGIC_PARTNER: "Aliado estratégico",
  MEDIA_PARTNER: "Media Partner",
  SUPPLIER: "Proveedor",
};

export const DISPLAY_TIER_LABELS: Record<DnxPartnerDisplayTier, string> = {
  INSTITUTIONAL: "Institucional",
  MAIN: "Principal",
  STANDARD: "Estándar",
  SUPPORTING: "Apoyo",
};

/** Encabezados de grupo para landing (plural / sección). */
export const INSTITUTIONAL_ROLE_GROUP_HEADINGS: Record<DnxPartnerInstitutionalRole, string> = {
  ORGANIZER: "Organizan",
  CO_ORGANIZER: "Coorganizan",
  INSTITUTIONAL_SPONSOR: "Con el apoyo de",
  MAIN_SPONSOR: "Sponsor principal",
  SPONSOR: "Sponsors",
  COLLABORATOR: "Colaboran",
  STRATEGIC_PARTNER: "Aliados estratégicos",
  MEDIA_PARTNER: "Media Partners",
  SUPPLIER: "Proveedores",
};

/** Orden de grupos en superficies públicas. */
export const PUBLIC_INSTITUTIONAL_ROLE_ORDER: readonly DnxPartnerInstitutionalRole[] = [
  "ORGANIZER",
  "CO_ORGANIZER",
  "INSTITUTIONAL_SPONSOR",
  "MAIN_SPONSOR",
  "SPONSOR",
  "COLLABORATOR",
  "STRATEGIC_PARTNER",
  "MEDIA_PARTNER",
] as const;

/** SUPPLIER oculto públicamente salvo opt-in. */
export const DEFAULT_PUBLIC_HIDDEN_ROLES: readonly DnxPartnerInstitutionalRole[] = [
  "SUPPLIER",
] as const;

export const INSTITUTIONAL_ROLE_OPTIONS = DNX_PARTNER_INSTITUTIONAL_ROLES.map((value) => ({
  value,
  label: INSTITUTIONAL_ROLE_LABELS[value],
}));

export const DISPLAY_TIER_OPTIONS = DNX_PARTNER_DISPLAY_TIERS.map((value) => ({
  value,
  label: DISPLAY_TIER_LABELS[value],
}));

const PUBLIC_VISIBLE_STATUSES: ReadonlySet<DnxPartnerParticipationStatus> = new Set([
  "CONFIRMED",
  "ACTIVE",
  "COMPLETED",
]);

export function defaultDisplayTierForRole(
  role: DnxPartnerInstitutionalRole,
): DnxPartnerDisplayTier {
  switch (role) {
    case "ORGANIZER":
    case "CO_ORGANIZER":
    case "INSTITUTIONAL_SPONSOR":
      return "INSTITUTIONAL";
    case "MAIN_SPONSOR":
      return "MAIN";
    case "SPONSOR":
      return "STANDARD";
    default:
      return "SUPPORTING";
  }
}

/** Mapeo conservador participationType → institutionalRole (backfill / defaults). */
export function institutionalRoleFromParticipationType(
  type: DnxPartnerParticipationType,
): DnxPartnerInstitutionalRole {
  switch (type) {
    case "MEDIA_PARTNER":
      return "MEDIA_PARTNER";
    case "COLLABORATOR":
      return "COLLABORATOR";
    case "INSTITUTIONAL_PARTNER":
      return "INSTITUTIONAL_SPONSOR";
    case "SERVICE_PROVIDER":
      return "SUPPLIER";
    case "PRIZE_PROVIDER":
    case "BENEFIT_PROVIDER":
    case "COMMERCIAL_PARTNER":
    case "SPONSOR":
      return "SPONSOR";
    default:
      return "SPONSOR";
  }
}

/** participationType legacy sugerido al elegir rol institucional (compat). */
export function participationTypeFromInstitutionalRole(
  role: DnxPartnerInstitutionalRole,
): DnxPartnerParticipationType {
  switch (role) {
    case "MEDIA_PARTNER":
      return "MEDIA_PARTNER";
    case "COLLABORATOR":
      return "COLLABORATOR";
    case "INSTITUTIONAL_SPONSOR":
    case "ORGANIZER":
    case "CO_ORGANIZER":
    case "STRATEGIC_PARTNER":
      return "INSTITUTIONAL_PARTNER";
    case "SUPPLIER":
      return "SERVICE_PROVIDER";
    case "MAIN_SPONSOR":
    case "SPONSOR":
      return "SPONSOR";
    default:
      return "SPONSOR";
  }
}

/**
 * Label público: custom opcional (sin HTML) o fallback del enum.
 */
export function resolvePublicRoleLabel(
  role: DnxPartnerInstitutionalRole,
  publicRoleLabel?: string | null,
): string {
  const sanitized = sanitizePublicRoleLabel(publicRoleLabel);
  return sanitized || INSTITUTIONAL_ROLE_LABELS[role];
}

export function sanitizePublicRoleLabel(raw?: string | null): string | null {
  if (raw == null) return null;
  const stripped = raw
    .replace(/<[^>]*>/g, "")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim();
  if (!stripped) return null;
  return stripped.slice(0, 120);
}

export type PublicPartnerDisplayItem = {
  participationId: string;
  partnerId: string;
  partnerName: string;
  partnerSlug?: string | null;
  logoUrl?: string | null;
  websiteUrl?: string | null;
  institutionalRole: DnxPartnerInstitutionalRole;
  displayTier: DnxPartnerDisplayTier;
  displayOrder: number;
  publicRoleLabel: string | null;
  resolvedRoleLabel: string;
  title?: string | null;
  description?: string | null;
  status: DnxPartnerParticipationStatus;
  /** Ausente se trata como HIDDEN (seguro por defecto en superficies nuevas). */
  publicVisibility?: DnxPartnerPublicVisibility | null;
};

/** Logo admin: pendiente / cargado / aprobado. */
export type PartnerLogoAdminState = "PENDING" | "UPLOADED" | "APPROVED";

/** Publicación admin: oculto / listo / publicado. */
export type PartnerPublicationAdminState = "HIDDEN" | "READY" | "PUBLISHED";

export function resolvePartnerLogoAdminState(input: {
  hasUsableApprovedLogo: boolean;
  hasUploadedLogo: boolean;
}): PartnerLogoAdminState {
  if (input.hasUsableApprovedLogo) return "APPROVED";
  if (input.hasUploadedLogo) return "UPLOADED";
  return "PENDING";
}

export function resolvePartnerPublicationAdminState(input: {
  publicVisibility: DnxPartnerPublicVisibility | null | undefined;
  participationStatus: DnxPartnerParticipationStatus;
  logoState: PartnerLogoAdminState;
  partnerType?: DnxPartnerType | null;
  requireApprovedLogo?: boolean;
}): PartnerPublicationAdminState {
  if (input.publicVisibility === "PUBLIC") return "PUBLISHED";
  const statusOk = PUBLIC_VISIBLE_STATUSES.has(input.participationStatus);
  const requireLogo =
    input.requireApprovedLogo ??
    (input.partnerType != null &&
      input.partnerType !== "PERSON" &&
      input.partnerType !== "GOVERNMENT");
  const logoOk = !requireLogo || input.logoState === "APPROVED";
  if (statusOk && logoOk) return "READY";
  return "HIDDEN";
}

/**
 * Publicación manual: participación confirmada/activa + PUBLIC.
 * Logo aprobado requerido para tipos comerciales (no PERSON) salvo override.
 */
export function assertParticipationPublicPublishable(input: {
  status: DnxPartnerParticipationStatus;
  partnerType?: DnxPartnerType | null;
  hasApprovedLogo: boolean;
  allowWithoutLogo?: boolean;
}): void {
  if (!PUBLIC_VISIBLE_STATUSES.has(input.status)) {
    throw new PartnersDomainError(
      "INVALID_STATE",
      "La participación debe estar CONFIRMED, ACTIVE o COMPLETED para publicar.",
    );
  }
  const commercial =
    input.partnerType != null &&
    input.partnerType !== "PERSON" &&
    input.partnerType !== "GOVERNMENT";
  if (commercial && !input.allowWithoutLogo && !input.hasApprovedLogo) {
    throw new PartnersDomainError(
      "INVALID_STATE",
      "Se requiere un logo aprobado antes de publicar.",
    );
  }
}

export type PublicPartnerGroup = {
  role: DnxPartnerInstitutionalRole;
  heading: string;
  items: PublicPartnerDisplayItem[];
};

export type GroupPublicPartnersOptions = {
  /** Incluir SUPPLIER u otros ocultos. Default false. */
  includeHiddenRoles?: boolean;
  /** Roles adicionales a ocultar. */
  hideRoles?: readonly DnxPartnerInstitutionalRole[];
  /** Si true, incluye DRAFT/PROPOSED (solo admin). Default: solo confirmados/activos. */
  includeNonPublicStatuses?: boolean;
};

function isPubliclyVisible(
  item: Pick<
    PublicPartnerDisplayItem,
    "status" | "institutionalRole" | "publicVisibility"
  >,
  options?: GroupPublicPartnersOptions,
): boolean {
  if (!options?.includeNonPublicStatuses) {
    if (!PUBLIC_VISIBLE_STATUSES.has(item.status)) return false;
    if (item.publicVisibility !== "PUBLIC") return false;
  }
  const hidden = new Set<DnxPartnerInstitutionalRole>([
    ...(options?.includeHiddenRoles ? [] : DEFAULT_PUBLIC_HIDDEN_ROLES),
    ...(options?.hideRoles ?? []),
  ]);
  return !hidden.has(item.institutionalRole);
}

/**
 * Agrupa partners para landing. Omite grupos vacíos.
 * Orden: rol (canon) → displayOrder → nombre.
 */
export function groupPartnersForPublicDisplay(
  items: PublicPartnerDisplayItem[],
  options?: GroupPublicPartnersOptions,
): PublicPartnerGroup[] {
  const visible = items.filter((i) => isPubliclyVisible(i, options));
  const byRole = new Map<DnxPartnerInstitutionalRole, PublicPartnerDisplayItem[]>();

  for (const item of visible) {
    const list = byRole.get(item.institutionalRole) ?? [];
    list.push(item);
    byRole.set(item.institutionalRole, list);
  }

  const groups: PublicPartnerGroup[] = [];
  for (const role of PUBLIC_INSTITUTIONAL_ROLE_ORDER) {
    const list = byRole.get(role);
    if (!list?.length) continue;
    list.sort((a, b) => {
      if (a.displayOrder !== b.displayOrder) return a.displayOrder - b.displayOrder;
      return a.partnerName.localeCompare(b.partnerName, "es");
    });
    groups.push({
      role,
      heading: INSTITUTIONAL_ROLE_GROUP_HEADINGS[role],
      items: list.map((i) => ({
        ...i,
        resolvedRoleLabel: resolvePublicRoleLabel(i.institutionalRole, i.publicRoleLabel),
      })),
    });
  }

  if (options?.includeHiddenRoles) {
    for (const role of DEFAULT_PUBLIC_HIDDEN_ROLES) {
      const list = byRole.get(role);
      if (!list?.length) continue;
      list.sort((a, b) => a.displayOrder - b.displayOrder);
      groups.push({
        role,
        heading: INSTITUTIONAL_ROLE_GROUP_HEADINGS[role],
        items: list.map((i) => ({
          ...i,
          resolvedRoleLabel: resolvePublicRoleLabel(i.institutionalRole, i.publicRoleLabel),
        })),
      });
    }
  }

  return groups;
}

export function normalizeInstitutionalFields(input: {
  institutionalRole?: DnxPartnerInstitutionalRole | null;
  displayTier?: DnxPartnerDisplayTier | null;
  displayOrder?: number | null;
  publicRoleLabel?: string | null;
  participationType?: DnxPartnerParticipationType | null;
}): {
  institutionalRole: DnxPartnerInstitutionalRole;
  displayTier: DnxPartnerDisplayTier;
  displayOrder: number;
  publicRoleLabel: string | null;
  participationType: DnxPartnerParticipationType;
} {
  const institutionalRole =
    input.institutionalRole ??
    (input.participationType
      ? institutionalRoleFromParticipationType(input.participationType)
      : "SPONSOR");
  const displayTier = input.displayTier ?? defaultDisplayTierForRole(institutionalRole);
  const displayOrder =
    typeof input.displayOrder === "number" && Number.isFinite(input.displayOrder)
      ? Math.max(0, Math.trunc(input.displayOrder))
      : 100;
  const publicRoleLabel = sanitizePublicRoleLabel(input.publicRoleLabel);
  const participationType =
    input.participationType ?? participationTypeFromInstitutionalRole(institutionalRole);
  return {
    institutionalRole,
    displayTier,
    displayOrder,
    publicRoleLabel,
    participationType,
  };
}
