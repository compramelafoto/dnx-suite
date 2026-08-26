import type { Role } from "@prisma/client";
import { Role as RoleEnum } from "@prisma/client";
import { TemplateV2DomainError } from "@/lib/template-v2/services/template-v2-errors";

export type TemplateV2AuthUser = {
  id: number;
  role: Role;
};

export type TemplateV2AccessRow = {
  id: string;
  ownerUserId: number;
  status: string;
};

export type TemplateV2PublicationRow = {
  visibility: string;
  reviewStatus: string;
} | null;

const DESIGNER_ROLES: Role[] = [
  RoleEnum.PHOTOGRAPHER,
  RoleEnum.LAB_PHOTOGRAPHER,
  RoleEnum.ADMIN,
];

export function isTemplateV2DesignerRole(role: Role): boolean {
  return DESIGNER_ROLES.includes(role);
}

export function isAdminRole(role: Role): boolean {
  return role === RoleEnum.ADMIN;
}

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
}): TemplateV2AccessRow {
  if (!args.user) {
    throw new TemplateV2DomainError("TEMPLATE_UNAUTHORIZED", "No autenticado", 401);
  }
  if (!isTemplateV2DesignerRole(args.user.role)) {
    throw new TemplateV2DomainError("TEMPLATE_FORBIDDEN", "Sin permisos de diseñador", 403);
  }
  if (!args.template) {
    throw new TemplateV2DomainError("TEMPLATE_NOT_FOUND", "Plantilla no encontrada", 404);
  }
  if (isAdminRole(args.user.role)) return args.template;
  if (args.template.ownerUserId === args.user.id) return args.template;
  if (isPublicApproved(args.publication ?? null)) return args.template;
  throw new TemplateV2DomainError("TEMPLATE_NOT_FOUND", "Plantilla no encontrada", 404);
}

/**
 * Escritura: propietario o admin. Catálogo ajeno → not found (no 403).
 */
export function requireTemplateV2WriteAccess(args: {
  user: TemplateV2AuthUser | null;
  template: TemplateV2AccessRow | null;
}): TemplateV2AccessRow {
  if (!args.user) {
    throw new TemplateV2DomainError("TEMPLATE_UNAUTHORIZED", "No autenticado", 401);
  }
  if (!isTemplateV2DesignerRole(args.user.role)) {
    throw new TemplateV2DomainError("TEMPLATE_FORBIDDEN", "Sin permisos de diseñador", 403);
  }
  if (!args.template) {
    throw new TemplateV2DomainError("TEMPLATE_NOT_FOUND", "Plantilla no encontrada", 404);
  }
  if (isAdminRole(args.user.role)) return args.template;
  if (args.template.ownerUserId === args.user.id) return args.template;
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
