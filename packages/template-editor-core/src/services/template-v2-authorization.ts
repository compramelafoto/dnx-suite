import type { Role } from "@prisma/client";
import { Role as RoleEnum } from "@prisma/client";
import { TemplateV2DomainError } from "./template-v2-errors";
import { peekTemplateV2Policy } from "./template-v2-runtime";
import type {
  TemplateV2AccessPolicy,
  TemplateV2AccessRow,
  TemplateV2AuthUser,
} from "./template-v2-policy";

export type {
  TemplateV2AccessPolicy,
  TemplateV2AccessRow,
  TemplateV2AuthUser,
} from "./template-v2-policy";

export type TemplateV2PublicationRow = {
  visibility: string;
  reviewStatus: string;
} | null;

const DESIGNER_ROLES: Role[] = [
  RoleEnum.PHOTOGRAPHER,
  RoleEnum.LAB_PHOTOGRAPHER,
  RoleEnum.ADMIN,
];

export function isTemplateV2DesignerRole(role: Role | string): boolean {
  return (DESIGNER_ROLES as string[]).includes(role);
}

export function isAdminRole(role: Role | string): boolean {
  return role === RoleEnum.ADMIN;
}

/** Lo que regía antes de que la política fuera inyectable. No cambia para quien no la pasa. */
export const DEFAULT_TEMPLATE_V2_POLICY: TemplateV2AccessPolicy = {
  canDesign: (user) => isTemplateV2DesignerRole(user.role),
  isAdmin: (user) => isAdminRole(user.role),
  owns: (user, template) => template.ownerUserId === user.id,
};

export function isPublicApproved(publication: TemplateV2PublicationRow): boolean {
  return publication?.visibility === "PUBLIC" && publication?.reviewStatus === "APPROVED";
}

/**
 * Lectura: propietario, admin, o catálogo público aprobado.
 * Ante denegación usa NOT_FOUND para no filtrar existencia de privadas ajenas.
 */
export function requireTemplateV2ReadAccess(args: {
  user: TemplateV2AuthUser | null;
  template: TemplateV2AccessRow | null;
  publication?: TemplateV2PublicationRow;
  policy?: TemplateV2AccessPolicy;
}): TemplateV2AccessRow {
  const policy = args.policy ?? DEFAULT_TEMPLATE_V2_POLICY;
  if (!args.user) {
    throw new TemplateV2DomainError("TEMPLATE_UNAUTHORIZED", "No autenticado", 401);
  }
  if (!policy.canDesign(args.user)) {
    throw new TemplateV2DomainError("TEMPLATE_FORBIDDEN", "Sin permisos de diseñador", 403);
  }
  if (!args.template) {
    throw new TemplateV2DomainError("TEMPLATE_NOT_FOUND", "Plantilla no encontrada", 404);
  }
  if (policy.isAdmin(args.user)) return args.template;
  if (policy.owns(args.user, args.template)) return args.template;
  if (isPublicApproved(args.publication ?? null)) return args.template;
  throw new TemplateV2DomainError("TEMPLATE_NOT_FOUND", "Plantilla no encontrada", 404);
}

/**
 * Escritura: propietario o admin. Catálogo ajeno → not found (no 403).
 */
export function requireTemplateV2WriteAccess(args: {
  user: TemplateV2AuthUser | null;
  template: TemplateV2AccessRow | null;
  policy?: TemplateV2AccessPolicy;
}): TemplateV2AccessRow {
  const policy = args.policy ?? DEFAULT_TEMPLATE_V2_POLICY;
  if (!args.user) {
    throw new TemplateV2DomainError("TEMPLATE_UNAUTHORIZED", "No autenticado", 401);
  }
  if (!policy.canDesign(args.user)) {
    throw new TemplateV2DomainError("TEMPLATE_FORBIDDEN", "Sin permisos de diseñador", 403);
  }
  if (!args.template) {
    throw new TemplateV2DomainError("TEMPLATE_NOT_FOUND", "Plantilla no encontrada", 404);
  }
  if (policy.isAdmin(args.user)) return args.template;
  if (policy.owns(args.user, args.template)) return args.template;
  throw new TemplateV2DomainError("TEMPLATE_NOT_FOUND", "Plantilla no encontrada", 404);
}

/** Alias pedido en el brief. */
export const requireTemplateV2Access = requireTemplateV2WriteAccess;

export function assertCanClone(args: {
  user: TemplateV2AuthUser | null;
  template: TemplateV2AccessRow | null;
  publication?: TemplateV2PublicationRow;
}): TemplateV2AccessRow {
  // Clone = read source + write new owned copy
  return requireTemplateV2ReadAccess(args);
}

/**
 * La política efectiva: la que declara la app, completada con los valores por omisión.
 *
 * Sin esto cada servicio tendría que acordarse de mirar el runtime, y el que se olvidara
 * volvería a decidir con el vocabulario de roles de otra aplicación. Fue exactamente lo que
 * pasó: el filtro HTTP consultaba la política y la autorización de dominio no, así que el
 * dueño de una institución pasaba la puerta y chocaba contra la pared de atrás.
 */
export function resolveTemplateV2Policy(): TemplateV2AccessPolicy {
  const declarada = peekTemplateV2Policy();
  return {
    canDesign: declarada?.canDesign ?? DEFAULT_TEMPLATE_V2_POLICY.canDesign,
    isAdmin: declarada?.isAdmin ?? DEFAULT_TEMPLATE_V2_POLICY.isAdmin,
    owns: declarada?.owns ?? DEFAULT_TEMPLATE_V2_POLICY.owns,
  };
}
