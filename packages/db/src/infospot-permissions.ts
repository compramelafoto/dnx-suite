/**
 * Permisos editoriales Info Spot (capa de dominio, sin Next.js).
 *
 * Roles:
 * - INFOSPOT_DIRECTOR: administra todo (settings, usuarios, noticias).
 * - INFOSPOT_REDACTOR: crea/edita noticias; publica según publicationPolicy / canPublish.
 * - INFOSPOT_COLABORADOR: crea/edita borradores; no publica ni administra.
 */

const ROLE_DIRECTOR = "INFOSPOT_DIRECTOR";
const ROLE_REDACTOR = "INFOSPOT_REDACTOR";
const ROLE_COLABORADOR = "INFOSPOT_COLABORADOR";
const STATUS_ACTIVE = "ACTIVE";

export const INFOSPOT_PUBLICATION_POLICIES = [
  "DIRECT_PUBLISH",
  "REQUIRES_APPROVAL",
] as const;

export type InfoSpotPublicationPolicyName =
  (typeof INFOSPOT_PUBLICATION_POLICIES)[number];

export type InfoSpotPermissionSubject = {
  role: string;
  canPublish?: boolean | null;
  /** Política explícita; si falta, se deriva de canPublish + rol. */
  publicationPolicy?: InfoSpotPublicationPolicyName | string | null;
  status?: string | null;
  /** SUPER_ADMIN de la suite DNX — bypass editorial. */
  isSuperAdmin?: boolean;
};

export const INFOSPOT_EDITORIAL_ROLES = [
  ROLE_DIRECTOR,
  ROLE_REDACTOR,
  ROLE_COLABORADOR,
] as const;

export type InfoSpotEditorialRoleName = (typeof INFOSPOT_EDITORIAL_ROLES)[number];

export function isInfoSpotEditorialRole(role: string): role is InfoSpotEditorialRoleName {
  return (INFOSPOT_EDITORIAL_ROLES as readonly string[]).includes(role);
}

export function isInfoSpotPublicationPolicy(
  value: string,
): value is InfoSpotPublicationPolicyName {
  return (INFOSPOT_PUBLICATION_POLICIES as readonly string[]).includes(value);
}

/**
 * Normaliza política + canPublish sin dejar pares contradictorios.
 * - Director → siempre DIRECT_PUBLISH / canPublish=true
 * - Colaborador → siempre REQUIRES_APPROVAL / canPublish=false
 * - Redactor → respeta la política; canPublish=false fuerza REQUIRES_APPROVAL
 */
export function resolveInfoSpotPublicationFields(params: {
  role: string;
  publicationPolicy?: string | null;
  canPublish?: boolean | null;
}): {
  publicationPolicy: InfoSpotPublicationPolicyName;
  canPublish: boolean;
} {
  if (params.role === ROLE_DIRECTOR) {
    return { publicationPolicy: "DIRECT_PUBLISH", canPublish: true };
  }
  if (params.role === ROLE_COLABORADOR) {
    return { publicationPolicy: "REQUIRES_APPROVAL", canPublish: false };
  }

  let policy: InfoSpotPublicationPolicyName =
    params.publicationPolicy === "REQUIRES_APPROVAL"
      ? "REQUIRES_APPROVAL"
      : params.publicationPolicy === "DIRECT_PUBLISH"
        ? "DIRECT_PUBLISH"
        : params.canPublish === false
          ? "REQUIRES_APPROVAL"
          : "DIRECT_PUBLISH";

  // canPublish=false siempre gana sobre DIRECT_PUBLISH.
  if (params.canPublish === false) {
    policy = "REQUIRES_APPROVAL";
  }

  return {
    publicationPolicy: policy,
    canPublish: policy === "DIRECT_PUBLISH",
  };
}

export function effectivePublicationPolicy(
  subject: InfoSpotPermissionSubject | null | undefined,
): InfoSpotPublicationPolicyName {
  if (!subject) return "REQUIRES_APPROVAL";
  if (subject.isSuperAdmin || subject.role === ROLE_DIRECTOR) {
    return "DIRECT_PUBLISH";
  }
  if (subject.role === ROLE_COLABORADOR) return "REQUIRES_APPROVAL";
  return resolveInfoSpotPublicationFields({
    role: subject.role,
    publicationPolicy: subject.publicationPolicy,
    canPublish: subject.canPublish,
  }).publicationPolicy;
}

export function publicationPolicyLabel(policy: string): string {
  switch (policy) {
    case "DIRECT_PUBLISH":
      return "Puede publicar directamente";
    case "REQUIRES_APPROVAL":
      return "Requiere aprobación del Director";
    default:
      return policy;
  }
}

function isActiveMember(subject: InfoSpotPermissionSubject | null | undefined): boolean {
  if (!subject) return false;
  if (subject.isSuperAdmin) return true;
  const status = subject.status ?? STATUS_ACTIVE;
  return status === STATUS_ACTIVE;
}

function isDirector(subject: InfoSpotPermissionSubject): boolean {
  return subject.isSuperAdmin === true || subject.role === ROLE_DIRECTOR;
}

function isRedactor(subject: InfoSpotPermissionSubject): boolean {
  return subject.role === ROLE_REDACTOR;
}

function isColaborador(subject: InfoSpotPermissionSubject): boolean {
  return subject.role === ROLE_COLABORADOR;
}

function canPublishFlag(subject: InfoSpotPermissionSubject): boolean {
  if (subject.isSuperAdmin) return true;
  if (isDirector(subject)) return true;
  if (isColaborador(subject)) return false;
  return (
    effectivePublicationPolicy(subject) === "DIRECT_PUBLISH" &&
    subject.canPublish !== false
  );
}

export function canManageInfoSpotSettings(
  subject: InfoSpotPermissionSubject | null | undefined,
): boolean {
  if (!isActiveMember(subject) || !subject) return false;
  return isDirector(subject);
}

export function canManageInfoSpotUsers(
  subject: InfoSpotPermissionSubject | null | undefined,
): boolean {
  if (!isActiveMember(subject) || !subject) return false;
  return isDirector(subject);
}

export function canCreateInfoSpotArticle(
  subject: InfoSpotPermissionSubject | null | undefined,
): boolean {
  if (!isActiveMember(subject) || !subject) return false;
  return isDirector(subject) || isRedactor(subject) || isColaborador(subject);
}

export function canEditInfoSpotArticle(
  subject: InfoSpotPermissionSubject | null | undefined,
): boolean {
  if (!isActiveMember(subject) || !subject) return false;
  return isDirector(subject) || isRedactor(subject) || isColaborador(subject);
}

/**
 * Publicar / despublicar.
 * COLABORADOR nunca publica. REDACTOR respeta publicationPolicy / canPublish.
 */
export function canPublishInfoSpotArticle(
  subject: InfoSpotPermissionSubject | null | undefined,
): boolean {
  if (!isActiveMember(subject) || !subject) return false;
  if (isDirector(subject)) return true;
  if (isColaborador(subject)) return false;
  if (isRedactor(subject)) return canPublishFlag(subject);
  return false;
}

/** Director (o SUPER_ADMIN): bandeja de aprobaciones editoriales. */
export function canReviewInfoSpotApprovals(
  subject: InfoSpotPermissionSubject | null | undefined,
): boolean {
  return canManageInfoSpotUsers(subject);
}

export function canAccessInfoSpotRedaccion(
  subject: InfoSpotPermissionSubject | null | undefined,
): boolean {
  return canCreateInfoSpotArticle(subject) || canEditInfoSpotArticle(subject);
}

export function canAccessInfoSpotAdmin(
  subject: InfoSpotPermissionSubject | null | undefined,
): boolean {
  return canManageInfoSpotSettings(subject) || canManageInfoSpotUsers(subject);
}

/** DIRECTOR: revisar / aprobar / rechazar / archivar envíos de eventos. */
export function canModerateInfoSpotEvents(
  subject: InfoSpotPermissionSubject | null | undefined,
): boolean {
  if (!isActiveMember(subject) || !subject) return false;
  return isDirector(subject);
}

/** DIRECTOR y REDACTOR: consultar eventos publicados (vincular a noticias luego). */
export function canViewInfoSpotPublishedEvents(
  subject: InfoSpotPermissionSubject | null | undefined,
): boolean {
  if (!isActiveMember(subject) || !subject) return false;
  return isDirector(subject) || isRedactor(subject);
}

/** Solo DIRECTOR edita envíos pendientes / publica eventos. */
export function canPublishInfoSpotEvent(
  subject: InfoSpotPermissionSubject | null | undefined,
): boolean {
  return canModerateInfoSpotEvents(subject);
}

export function infoSpotRoleLabel(role: string): string {
  switch (role) {
    case ROLE_DIRECTOR:
      return "Director/a";
    case ROLE_REDACTOR:
      return "Redactor/a";
    case ROLE_COLABORADOR:
      return "Colaborador/a";
    default:
      return role.replace(/^INFOSPOT_/, "");
  }
}
