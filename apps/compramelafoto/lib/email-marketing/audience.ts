/**
 * Obtiene destinatarios elegibles para campañas de email marketing
 */

import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";

export type AudienceRole = "PHOTOGRAPHER" | "LAB" | "CLIENT"; // CLIENT → CUSTOMER

export interface AudienceFilters {
  roles?: AudienceRole[];
  workspaceId?: number;
  createdAtFrom?: string; // ISO date
  createdAtTo?: string;
  country?: string;
  province?: string;
  isActive?: boolean;
  lastLoginAtFrom?: string;
  lastLoginAtTo?: string;
  hasOrders?: boolean;
  isVerifiedEmail?: boolean;
}

export interface RecipientRow {
  id: number;
  email: string;
  name: string | null;
  firstName: string;
  lastName: string;
  workspaceName: string;
  role: string;
  referralCode: string | null;
  unsubscribeToken: string | null;
}

const ROLE_MAP: Record<AudienceRole, Role> = {
  PHOTOGRAPHER: Role.PHOTOGRAPHER,
  LAB: Role.LAB,
  CLIENT: Role.CUSTOMER,
};

export async function getAudienceRecipients(
  filters: AudienceFilters,
  options?: { limit?: number; offset?: number }
): Promise<RecipientRow[]> {
  const roles = filters.roles?.length ? filters.roles.map((r) => ROLE_MAP[r]) : [Role.PHOTOGRAPHER, Role.LAB, Role.CUSTOMER];

  const createdAtFrom = filters.createdAtFrom ? new Date(filters.createdAtFrom) : undefined;
  const createdAtTo = filters.createdAtTo ? new Date(filters.createdAtTo) : undefined;
  const lastLoginAtFrom = filters.lastLoginAtFrom ? new Date(filters.lastLoginAtFrom) : undefined;
  const lastLoginAtTo = filters.lastLoginAtTo ? new Date(filters.lastLoginAtTo) : undefined;

  const where: Record<string, unknown> = {
    marketingOptIn: true,
    unsubscribedAt: null,
    role: { in: roles },
    email: { not: null },
  };

  if (createdAtFrom || createdAtTo) {
    where.createdAt = {};
    if (createdAtFrom) (where.createdAt as Record<string, Date>).gte = createdAtFrom;
    if (createdAtTo) (where.createdAt as Record<string, Date>).lte = createdAtTo;
  }

  if (filters.country) where.country = filters.country;
  if (filters.province) where.province = filters.province;
  if (typeof filters.isActive === "boolean") {
    if (filters.isActive) where.blockedAt = null;
    else where.blockedAt = { not: null };
  }

  if (lastLoginAtFrom || lastLoginAtTo) {
    where.lastLoginAt = {};
    if (lastLoginAtFrom) (where.lastLoginAt as Record<string, Date>).gte = lastLoginAtFrom;
    if (lastLoginAtTo) (where.lastLoginAt as Record<string, Date>).lte = lastLoginAtTo;
  }

  if (typeof filters.isVerifiedEmail === "boolean") {
    if (filters.isVerifiedEmail) where.emailVerifiedAt = { not: null };
    else where.emailVerifiedAt = null;
  }

  // workspaceId: en este proyecto no hay workspaces multi-tenant explícitos, omitir por ahora
  if (filters.hasOrders === true) {
    where.OR = [{ buyerOrders: { some: {} } }, { clientOrders: { some: {} } }];
  }

  const users = await prisma.user.findMany({
    where: where as any,
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      companyName: true,
      referralCodeOwned: { select: { code: true } },
      unsubscribeToken: true,
    },
    take: options?.limit ?? 50000,
    skip: options?.offset ?? 0,
  });

  return users.map((u) => {
    const parts = (u.name || "").trim().split(/\s+/);
    const firstName = parts[0] || "";
    const lastName = parts.slice(1).join(" ") || "";
    return {
      id: u.id,
      email: u.email,
      name: u.name,
      firstName,
      lastName,
      workspaceName: u.companyName || "ComprameLaFoto",
      role: u.role,
      referralCode: u.referralCodeOwned?.code ?? null,
      unsubscribeToken: u.unsubscribeToken,
    };
  });
}

export async function countAudienceRecipients(filters: AudienceFilters): Promise<number> {
  const roles = filters.roles?.length ? filters.roles.map((r) => ROLE_MAP[r]) : [Role.PHOTOGRAPHER, Role.LAB, Role.CUSTOMER];
  const createdAtFrom = filters.createdAtFrom ? new Date(filters.createdAtFrom) : undefined;
  const createdAtTo = filters.createdAtTo ? new Date(filters.createdAtTo) : undefined;
  const lastLoginAtFrom = filters.lastLoginAtFrom ? new Date(filters.lastLoginAtFrom) : undefined;
  const lastLoginAtTo = filters.lastLoginAtTo ? new Date(filters.lastLoginAtTo) : undefined;

  const where: Record<string, unknown> = {
    marketingOptIn: true,
    unsubscribedAt: null,
    role: { in: roles },
  };
  if (createdAtFrom || createdAtTo) {
    where.createdAt = {};
    if (createdAtFrom) (where.createdAt as Record<string, Date>).gte = createdAtFrom;
    if (createdAtTo) (where.createdAt as Record<string, Date>).lte = createdAtTo;
  }
  if (filters.country) where.country = filters.country;
  if (filters.province) where.province = filters.province;
  if (typeof filters.isActive === "boolean") {
    if (filters.isActive) where.blockedAt = null;
    else where.blockedAt = { not: null };
  }
  if (lastLoginAtFrom || lastLoginAtTo) {
    where.lastLoginAt = {};
    if (lastLoginAtFrom) (where.lastLoginAt as Record<string, Date>).gte = lastLoginAtFrom;
    if (lastLoginAtTo) (where.lastLoginAt as Record<string, Date>).lte = lastLoginAtTo;
  }
  if (typeof filters.isVerifiedEmail === "boolean") {
    if (filters.isVerifiedEmail) where.emailVerifiedAt = { not: null };
    else where.emailVerifiedAt = null;
  }
  if (filters.hasOrders === true) {
    where.OR = [{ buyerOrders: { some: {} } }, { clientOrders: { some: {} } }];
  }

  return prisma.user.count({ where: where as any });
}
