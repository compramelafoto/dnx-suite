/**
 * Permisos editoriales Info Spot (capa de dominio, sin Next.js).
 *
 * Roles:
 * - INFOSPOT_DIRECTOR: administra todo (settings, usuarios, noticias).
 * - INFOSPOT_REDACTOR: crea/edita/publica/despublica noticias; no admin de usuarios/settings.
 *
 * `canPublish` queda preparado para un futuro flujo de revisión
 * (algunos redactores podrían requerir aprobación).
 */

const ROLE_DIRECTOR = "INFOSPOT_DIRECTOR";
const ROLE_REDACTOR = "INFOSPOT_REDACTOR";
const STATUS_ACTIVE = "ACTIVE";

export type InfoSpotPermissionSubject = {
  role: string;
  canPublish?: boolean | null;
  status?: string | null;
  /** SUPER_ADMIN de la suite DNX — bypass editorial. */
  isSuperAdmin?: boolean;
};

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

function canPublishFlag(subject: InfoSpotPermissionSubject): boolean {
  if (subject.isSuperAdmin) return true;
  if (isDirector(subject)) return true;
  return subject.canPublish !== false;
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
  return isDirector(subject) || isRedactor(subject);
}

export function canEditInfoSpotArticle(
  subject: InfoSpotPermissionSubject | null | undefined,
): boolean {
  if (!isActiveMember(subject) || !subject) return false;
  return isDirector(subject) || isRedactor(subject);
}

/**
 * Publicar / despublicar. Hoy DIRECTOR y REDACTOR (con canPublish) pueden.
 * En el futuro, redactores con canPublish=false requerirán revisión.
 */
export function canPublishInfoSpotArticle(
  subject: InfoSpotPermissionSubject | null | undefined,
): boolean {
  if (!isActiveMember(subject) || !subject) return false;
  if (isDirector(subject)) return true;
  if (isRedactor(subject)) return canPublishFlag(subject);
  return false;
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
