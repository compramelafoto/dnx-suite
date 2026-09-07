import type { Prisma } from "@prisma/client";

/**
 * Filtro del padrón por estado de acceso al portal.
 *
 * Vive aparte del resto de la búsqueda porque se resuelve en SQL sobre la relación de
 * invitaciones, no sobre columnas de `Member`. La alternativa —traer el padrón entero y
 * derivar el estado en memoria— rompería la paginación.
 *
 * Los cuatro estados son los que necesita la operación de alta, no los siete que puede
 * tener una invitación: a quién hay que invitar, a quién ya se le mandó y no entró, quién
 * ya está adentro, y a quién no se le puede mandar nada.
 */

export type MemberAccessFilter =
  /** Nunca se le mandó una invitación, o la que tiene ya no sirve (vencida, revocada, falló). */
  | "SIN_INVITACION_ACTIVA"
  /** Tiene una invitación enviada y vigente, y todavía no la usó. */
  | "PENDIENTE"
  /** Ya vinculó su cuenta: entra al portal. */
  | "CON_ACCESO"
  /** No tiene email cargado: no se le puede enviar nada hasta que la Secretaría lo consiga. */
  | "SIN_EMAIL";

const VALUES: readonly MemberAccessFilter[] = [
  "SIN_INVITACION_ACTIVA",
  "PENDIENTE",
  "CON_ACCESO",
  "SIN_EMAIL",
];

export function isMemberAccessFilter(value: string): value is MemberAccessFilter {
  return (VALUES as readonly string[]).includes(value);
}

export const MEMBER_ACCESS_FILTER_LABELS: Record<MemberAccessFilter, string> = {
  SIN_INVITACION_ACTIVA: "Sin invitación activa",
  PENDIENTE: "Invitación pendiente",
  CON_ACCESO: "Acceso activo",
  SIN_EMAIL: "Sin email",
};

/** Una invitación que el socio todavía puede usar: enviada, sin aceptar, sin revocar y vigente. */
function invitacionViva(now: Date): Prisma.MemberInvitationWhereInput {
  return {
    acceptedAt: null,
    revokedAt: null,
    // `sentAt` nulo es una invitación que quedó creada pero cuyo email nunca salió. Contarla
    // como pendiente haría esperar una respuesta que nadie puede dar.
    sentAt: { not: null },
    expiresAt: { gt: now },
  };
}

/** Sin email utilizable: la columna admite `null` y también cadena vacía. */
const SIN_EMAIL: Prisma.MemberWhereInput = {
  OR: [{ email: null }, { email: "" }],
};

export function memberAccessWhere(
  filter: MemberAccessFilter | undefined,
  now: Date = new Date(),
): Prisma.MemberWhereInput {
  switch (filter) {
    case "CON_ACCESO":
      return { userId: { not: null } };
    case "PENDIENTE":
      return { userId: null, invitations: { some: invitacionViva(now) } };
    case "SIN_INVITACION_ACTIVA":
      // Los que no tienen email quedan afuera a propósito: aparecen en su propio filtro,
      // porque no se resuelven invitando sino consiguiendo la dirección.
      return {
        userId: null,
        NOT: SIN_EMAIL,
        invitations: { none: invitacionViva(now) },
      };
    case "SIN_EMAIL":
      return SIN_EMAIL;
    default:
      return {};
  }
}
