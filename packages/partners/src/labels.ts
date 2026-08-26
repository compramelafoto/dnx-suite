import type {
  DnxPartnerApplication,
  DnxPartnerAudienceType,
  DnxPartnerBenefitStatus,
  DnxPartnerBenefitType,
  DnxPartnerContextType,
  DnxPartnerContributionStatus,
  DnxPartnerContributionType,
  DnxPartnerParticipationStatus,
  DnxPartnerParticipationType,
  DnxPartnerPaymentMode,
  DnxPartnerPublicVisibility,
  DnxPartnerRedemptionMethod,
  DnxPartnerStatus,
  DnxPartnerType,
} from "./types";

/** Etiquetas UI (es-AR) para tipo de partner/sponsor. */
export const PARTNER_TYPE_LABELS: Record<DnxPartnerType, string> = {
  COMPANY: "Empresa",
  BUSINESS: "Negocio",
  BRAND: "Marca",
  INSTITUTION: "Institución",
  ORGANIZATION: "Organización",
  PERSON: "Persona",
  GOVERNMENT: "Gobierno",
  OTHER: "Otro",
};

/** Etiquetas UI (es-AR) para estado comercial del partner. */
export const PARTNER_STATUS_LABELS: Record<DnxPartnerStatus, string> = {
  PROSPECT: "Prospecto",
  ACTIVE: "Activo",
  INACTIVE: "Inactivo",
  ARCHIVED: "Archivado",
};

/** Etiquetas UI (es-AR) para estados de participación. */
export const PARTICIPATION_STATUS_LABELS: Record<DnxPartnerParticipationStatus, string> = {
  DRAFT: "Borrador",
  PROPOSED: "Propuesto",
  CONFIRMED: "Confirmado",
  ACTIVE: "Activo",
  COMPLETED: "Completado",
  CANCELLED: "Cancelado",
  ARCHIVED: "Archivado",
};

export const CONTRIBUTION_STATUS_LABELS: Record<DnxPartnerContributionStatus, string> = {
  PENDING: "Pendiente",
  CONFIRMED: "Confirmado",
  PARTIALLY_DELIVERED: "Entregado parcialmente",
  DELIVERED: "Entregado",
  CANCELLED: "Cancelado",
};

export const BENEFIT_STATUS_LABELS: Record<DnxPartnerBenefitStatus, string> = {
  DRAFT: "Borrador",
  ACTIVE: "Activo",
  PAUSED: "Pausado",
  EXPIRED: "Vencido",
  ARCHIVED: "Archivado",
};

/**
 * Tipos de participación visibles en Clickatón.
 * Reutiliza enums canónicos; sponsor de categoría/sede = SPONSOR + contextType.
 */
export const CLICKATON_PARTICIPATION_ROLE_OPTIONS = [
  { value: "SPONSOR", label: "Sponsor general", contextHint: "EDITION" },
  { value: "SPONSOR_MAIN", label: "Sponsor principal", mapsTo: "SPONSOR", titleHint: "Sponsor principal" },
  { value: "SPONSOR_CATEGORY", label: "Sponsor de categoría", mapsTo: "SPONSOR", contextHint: "CATEGORY" },
  { value: "SPONSOR_VENUE", label: "Sponsor de sede", mapsTo: "SPONSOR", contextHint: "VENUE" },
  { value: "PRIZE_PROVIDER", label: "Proveedor de premios" },
  { value: "BENEFIT_PROVIDER", label: "Proveedor de beneficios" },
  { value: "SERVICE_PROVIDER", label: "Proveedor de servicios" },
  { value: "INSTITUTIONAL_PARTNER", label: "Partner institucional" },
  { value: "MEDIA_PARTNER", label: "Media partner" },
  { value: "COLLABORATOR", label: "Colaborador" },
  { value: "OTHER", label: "Otro" },
] as const;

export type ClickatonParticipationRoleOption =
  (typeof CLICKATON_PARTICIPATION_ROLE_OPTIONS)[number]["value"];

export function resolveClickatonParticipationType(
  role: string,
): {
  participationType: DnxPartnerParticipationType;
  contextTypeHint?: "EDITION" | "CATEGORY" | "VENUE";
  titleHint?: string;
} {
  const opt = CLICKATON_PARTICIPATION_ROLE_OPTIONS.find((o) => o.value === role);
  if (!opt) return { participationType: "OTHER" };
  const mapsTo = "mapsTo" in opt ? opt.mapsTo : undefined;
  const participationType = (mapsTo ?? opt.value) as DnxPartnerParticipationType;
  const contextHint = "contextHint" in opt ? opt.contextHint : undefined;
  const titleHint = "titleHint" in opt ? opt.titleHint : undefined;
  return {
    participationType,
    contextTypeHint: contextHint as "EDITION" | "CATEGORY" | "VENUE" | undefined,
    titleHint,
  };
}

export const PARTICIPATION_TYPE_LABELS: Record<DnxPartnerParticipationType, string> = {
  SPONSOR: "Sponsor",
  BENEFIT_PROVIDER: "Proveedor de beneficios",
  PRIZE_PROVIDER: "Proveedor de premios",
  SERVICE_PROVIDER: "Proveedor de servicios",
  INSTITUTIONAL_PARTNER: "Partner institucional",
  MEDIA_PARTNER: "Media partner",
  COMMERCIAL_PARTNER: "Partner comercial",
  COLLABORATOR: "Colaborador",
  OTHER: "Otro",
};

export const CONTRIBUTION_TYPE_LABELS: Record<DnxPartnerContributionType, string> = {
  MONEY: "Dinero",
  PRODUCT: "Producto",
  PRIZE: "Premio",
  VOUCHER: "Voucher",
  DISCOUNT: "Descuento",
  SERVICE: "Servicio",
  EQUIPMENT: "Equipamiento",
  PROMOTION: "Difusión / promoción",
  CONTENT: "Contenido",
  INSTITUTIONAL_SUPPORT: "Apoyo institucional",
  VENUE: "Sede / espacio",
  LOGISTICS: "Logística",
  OTHER: "Otro",
};

export const BENEFIT_TYPE_LABELS: Record<DnxPartnerBenefitType, string> = {
  PERCENTAGE_DISCOUNT: "Descuento porcentual",
  FIXED_DISCOUNT: "Descuento fijo",
  PROMO_CODE: "Código promocional",
  FREE_SERVICE: "Servicio gratuito",
  FREE_PRODUCT: "Producto gratuito",
  VOUCHER: "Voucher",
  PRIORITY_SERVICE: "Servicio prioritario",
  SPECIAL_PRICE: "Precio especial",
  UPGRADE: "Mejora / upgrade",
  OTHER: "Otro",
};

export const REDEMPTION_METHOD_LABELS: Record<DnxPartnerRedemptionMethod, string> = {
  PROMO_CODE: "Código promocional",
  DIGITAL_CREDENTIAL: "Credencial digital",
  PHYSICAL_CREDENTIAL: "Credencial física",
  IDENTITY_VERIFICATION: "Verificación de identidad",
  MANUAL_APPROVAL: "Aprobación manual",
  EXTERNAL_LINK: "Enlace externo",
  CONTACT_PARTNER: "Contactar al partner",
  OTHER: "Otro",
};

export const AUDIENCE_TYPE_LABELS: Record<DnxPartnerAudienceType, string> = {
  ALL_USERS: "Todos los usuarios",
  ORGANIZATION_MEMBERS: "Miembros de la organización",
  EVENT_PARTICIPANTS: "Participantes del evento",
  EDITION_PARTICIPANTS: "Participantes de la edición",
  PRODUCT_PURCHASERS: "Compradores de producto",
  MEMBERSHIP_HOLDERS: "Titulares de membresía",
  MANUAL_USERS: "Usuarios manuales",
  CUSTOM_GROUP: "Grupo personalizado",
  OTHER: "Otro",
};

export const APPLICATION_LABELS: Record<DnxPartnerApplication, string> = {
  DNX_SUITE: "DNX Suite",
  CLICKATON: "Clickatón",
  FOTO_OFFICE: "FotoOffice",
  FOTO_RANK: "FotoRank",
  COMPRAME_LA_FOTO: "ComprameLaFoto",
  INFO_SPOT: "InfoSpot",
  OTHER: "Otra",
};

export const CONTEXT_TYPE_LABELS: Record<DnxPartnerContextType, string> = {
  GLOBAL: "Global",
  ORGANIZATION: "Organización",
  EVENT: "Evento",
  EDITION: "Edición",
  VENUE: "Sede",
  CONTEST: "Concurso",
  CATEGORY: "Categoría",
  ALBUM: "Álbum",
  MEMBERSHIP: "Membresía",
  CAMPAIGN: "Campaña",
  PLATFORM: "Plataforma",
  OTHER: "Otro",
};

export const PAYMENT_MODE_LABELS: Record<DnxPartnerPaymentMode, string> = {
  NONE: "Sin pago",
  ONE_TIME: "Pago único",
  INSTALLMENTS: "Cuotas",
  RECURRING: "Recurrente",
  MANUAL: "Manual",
  EXTERNAL: "Externo",
};

export const PUBLIC_VISIBILITY_LABELS: Record<DnxPartnerPublicVisibility, string> = {
  HIDDEN: "Oculto",
  PUBLIC: "Público",
};

export const OUTBOUND_LINK_STATUS_LABELS: Record<
  "ACTIVE" | "PAUSED" | "ARCHIVED",
  string
> = {
  ACTIVE: "Activo",
  PAUSED: "Pausado",
  ARCHIVED: "Archivado",
};

/**
 * Audiencias Clickatón v1 (simples).
 * Labels en metadata/label; evaluación real en etapa posterior.
 */
export const CLICKATON_AUDIENCE_OPTIONS = [
  { value: "EDITION_PARTICIPANTS", label: "Todos los participantes de la edición", audienceType: "EDITION_PARTICIPANTS" as DnxPartnerAudienceType },
  { value: "CONFIRMED_REGISTRATION", label: "Inscripción confirmada", audienceType: "CUSTOM_GROUP" as DnxPartnerAudienceType, groupKey: "CONFIRMED_REGISTRATION" },
  { value: "PRODUCT_PURCHASERS", label: "Compradores de inscripción", audienceType: "PRODUCT_PURCHASERS" as DnxPartnerAudienceType },
  { value: "CATEGORY", label: "Participantes de una categoría", audienceType: "CUSTOM_GROUP" as DnxPartnerAudienceType, groupKey: "CATEGORY" },
  { value: "MANUAL_USERS", label: "Usuarios seleccionados manualmente", audienceType: "MANUAL_USERS" as DnxPartnerAudienceType },
  { value: "WINNERS", label: "Ganadores", audienceType: "CUSTOM_GROUP" as DnxPartnerAudienceType, groupKey: "WINNERS" },
  { value: "EDITION_WINNERS", label: "Ganadores de la edición", audienceType: "CUSTOM_GROUP" as DnxPartnerAudienceType, groupKey: "EDITION_WINNERS" },
  { value: "CATEGORY_WINNERS", label: "Ganadores de una categoría", audienceType: "CUSTOM_GROUP" as DnxPartnerAudienceType, groupKey: "CATEGORY_WINNERS" },
  { value: "PRIZE_BUNDLE_WINNERS", label: "Ganadores de un lote de premios", audienceType: "CUSTOM_GROUP" as DnxPartnerAudienceType, groupKey: "PRIZE_BUNDLE_WINNERS" },
  { value: "FINALISTS", label: "Finalistas", audienceType: "CUSTOM_GROUP" as DnxPartnerAudienceType, groupKey: "FINALISTS" },
  { value: "STAFF", label: "Staff / organizadores", audienceType: "CUSTOM_GROUP" as DnxPartnerAudienceType, groupKey: "STAFF" },
  { value: "CUSTOM_GROUP", label: "Audiencia personalizada futura", audienceType: "CUSTOM_GROUP" as DnxPartnerAudienceType, groupKey: "CUSTOM_FUTURE" },
] as const;
