/**
 * Tipo de organización del Workspace. FotoOffice no es solo para empresas ni
 * solo para un tipo de institución: una asociación de fotógrafos, una ONG,
 * un estudio o un freelancer usan la misma plataforma modular. Esta
 * clasificación es puramente descriptiva hoy — no gatea módulos ni
 * funcionalidad. En una etapa futura podría usarse para *sugerir* una
 * configuración inicial de módulos (nunca para restringirlos).
 */
export const FOTOFFICE_ORGANIZATION_TYPES = [
  { id: "PHOTOGRAPHERS_ASSOCIATION", label: "Asociación / Sociedad de fotógrafos" },
  { id: "NONPROFIT", label: "ONG / Fundación" },
  { id: "PHOTOGRAPHY_COMMUNITY", label: "Comunidad / Colectivo fotográfico" },
  { id: "PHOTO_STUDIO", label: "Estudio fotográfico" },
  { id: "PHOTOGRAPHY_COMPANY", label: "Empresa de fotografía" },
  { id: "FREELANCE_PHOTOGRAPHER", label: "Fotógrafo/a independiente" },
  { id: "AGENCY_PRODUCTION", label: "Agencia / Productora" },
  { id: "EDUCATIONAL_INSTITUTION", label: "Institución educativa" },
  { id: "CULTURAL_ORGANIZATION", label: "Club / Asociación cultural" },
  { id: "EVENT_ORGANIZATION", label: "Organización de eventos" },
  { id: "OTHER", label: "Otro" },
] as const;

export type FotofficeOrganizationTypeId = (typeof FOTOFFICE_ORGANIZATION_TYPES)[number]["id"];

export const FOTOFFICE_ORGANIZATION_TYPE_IDS: Set<string> = new Set(
  FOTOFFICE_ORGANIZATION_TYPES.map((o) => o.id),
);

/**
 * Compatibilidad con Workspaces creados antes de este cambio, que todavía
 * pueden tener guardado un id del esquema viejo (`independent` | `studio` |
 * `agency`) en `FotofficeWorkspaceBranding.activityType`. No requiere
 * migración de datos: normaliza en lectura, sin tocar la base.
 */
const LEGACY_ACTIVITY_TYPE_MAP: Record<string, FotofficeOrganizationTypeId> = {
  independent: "FREELANCE_PHOTOGRAPHER",
  studio: "PHOTO_STUDIO",
  agency: "AGENCY_PRODUCTION",
};

export function normalizeFotofficeOrganizationType(
  raw: string | null | undefined,
): FotofficeOrganizationTypeId | "" {
  if (!raw) return "";
  if (FOTOFFICE_ORGANIZATION_TYPE_IDS.has(raw)) return raw as FotofficeOrganizationTypeId;
  return LEGACY_ACTIVITY_TYPE_MAP[raw] ?? "";
}

export const FOTOFFICE_SPECIALTIES = [
  { id: "social_events", label: "Eventos sociales" },
  { id: "weddings", label: "Bodas" },
  { id: "birthdays", label: "Cumpleaños" },
  { id: "school", label: "Fotografía escolar" },
  { id: "sports", label: "Deportes" },
  { id: "press", label: "Prensa" },
  { id: "product", label: "Producto" },
  { id: "gastronomy", label: "Gastronomía" },
  { id: "portraits", label: "Retratos" },
  { id: "fashion", label: "Moda" },
  { id: "real_estate", label: "Inmobiliaria" },
  { id: "corporate", label: "Institucional" },
  { id: "other", label: "Otra" },
] as const;

export type FotofficeSpecialtyId = (typeof FOTOFFICE_SPECIALTIES)[number]["id"];

export const FOTOFFICE_SPECIALTY_IDS = new Set(
  FOTOFFICE_SPECIALTIES.map((s) => s.id),
);
