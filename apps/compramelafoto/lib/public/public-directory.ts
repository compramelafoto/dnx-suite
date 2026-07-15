/**
 * Directorio público (Home / Directorio / Comunidad).
 * Contratos alineados a legacy; contactos de directorio (phone/whatsapp/instagram)
 * se mantienen porque las páginas ya los consumen. No se expone User.email.
 */

import type { PrismaClient } from "@prisma/client";
import {
  CommunityProfileType,
  LabApprovalStatus,
  Role,
} from "@prisma/client";
import { getR2PublicUrl } from "../r2-public-url";

export type DirectoryCounts = {
  photographers: number;
  labs: number;
  photographerServices: number;
  eventVendors: number;
  organizers: number;
};

export const DIRECTORY_COUNTS_KEYS = [
  "photographers",
  "labs",
  "photographerServices",
  "eventVendors",
  "organizers",
] as const;

/** Fotógrafos visibles en directorio / conteos. */
export function buildDirectoryPhotographersWhere() {
  return {
    role: { in: [Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER] as Role[] },
    isPublicPageEnabled: true,
    isBlocked: false,
  };
}

/** Labs del directorio: aprobados, activos, no suspendidos. */
export function buildDirectoryLabsWhere() {
  return {
    approvalStatus: LabApprovalStatus.APPROVED,
    isActive: true as const,
    isSuspended: false as const,
  };
}

/** Perfiles de comunidad ACTIVE con logo (conteos Home). */
export function buildDirectoryCommunityCountWhere(
  type: (typeof CommunityProfileType)[keyof typeof CommunityProfileType]
) {
  return {
    type,
    status: "ACTIVE" as const,
    AND: [{ logoUrl: { not: null } }, { logoUrl: { not: "" } }],
  };
}

/** Organizadores con landing publicada y logo. */
export function buildDirectoryOrganizersWhere() {
  return {
    isPublished: true,
    logoR2Key: { not: null },
    NOT: { logoR2Key: "" },
    user: { role: { in: [Role.ORGANIZER, Role.SCHOOL_ORGANIZER] as Role[] } },
  };
}

export const DIRECTORY_PHOTOGRAPHER_PUBLIC_FIELDS = [
  "id",
  "name",
  "companyName",
  "logoUrl",
  "phone",
  "city",
  "province",
  "instagram",
  "facebook",
  "whatsapp",
  "publicPageHandler",
] as const;

export const DIRECTORY_LAB_PUBLIC_FIELDS = [
  "id",
  "name",
  "logoUrl",
  "phone",
  "city",
  "province",
  "instagram",
  "facebook",
  "whatsapp",
  "publicPageHandler",
] as const;

export const DIRECTORY_ORGANIZER_PUBLIC_FIELDS = [
  "id",
  "displayName",
  "tagline",
  "publicSlug",
  "logoUrl",
  "city",
  "zone",
  "website",
  "instagram",
  "whatsapp",
  "publicEmail",
] as const;

/** Campos que nunca deben salir en directory (allowlist negativa). */
export const DIRECTORY_FORBIDDEN_FIELDS = [
  "email",
  "password",
  "mpAccessToken",
  "mpRefreshToken",
  "cbu",
  "alias",
  "internalNotes",
  "isBlocked",
  "approvalStatus",
] as const;

function resolveAssetUrl(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  const value = raw.trim();
  if (value.startsWith("http://") || value.startsWith("https://")) return value;
  return getR2PublicUrl(value.replace(/^\//, ""));
}

export async function getDirectoryCounts(
  prisma: PrismaClient
): Promise<DirectoryCounts> {
  const [
    photographers,
    labs,
    photographerServices,
    eventVendors,
    organizers,
  ] = await Promise.all([
    prisma.user.count({ where: buildDirectoryPhotographersWhere() }),
    prisma.lab.count({ where: buildDirectoryLabsWhere() }),
    prisma.communityProfile.count({
      where: buildDirectoryCommunityCountWhere(
        CommunityProfileType.PHOTOGRAPHER_SERVICE
      ),
    }),
    prisma.communityProfile.count({
      where: buildDirectoryCommunityCountWhere(CommunityProfileType.EVENT_VENDOR),
    }),
    prisma.organizerPublicProfile.count({
      where: buildDirectoryOrganizersWhere(),
    }),
  ]);

  return {
    photographers,
    labs,
    photographerServices,
    eventVendors,
    organizers,
  };
}

export async function listDirectoryLabs(prisma: PrismaClient) {
  const labs = await prisma.lab.findMany({
    where: buildDirectoryLabsWhere(),
    select: {
      id: true,
      name: true,
      logoUrl: true,
      phone: true,
      city: true,
      province: true,
      publicPageHandler: true,
      user: {
        select: {
          instagram: true,
          facebook: true,
          whatsapp: true,
        },
      },
    },
    orderBy: { name: "asc" },
  });

  return labs.map((lab) => ({
    id: lab.id,
    name: lab.name,
    logoUrl: resolveAssetUrl(lab.logoUrl),
    phone: lab.phone ?? null,
    city: lab.city ?? null,
    province: lab.province ?? null,
    instagram: lab.user?.instagram ?? null,
    facebook: lab.user?.facebook ?? null,
    whatsapp: lab.user?.whatsapp ?? null,
    publicPageHandler: lab.publicPageHandler ?? null,
  }));
}

export async function listDirectoryPhotographers(prisma: PrismaClient) {
  const users = await prisma.user.findMany({
    where: buildDirectoryPhotographersWhere(),
    select: {
      id: true,
      name: true,
      companyName: true,
      logoUrl: true,
      phone: true,
      city: true,
      province: true,
      instagram: true,
      facebook: true,
      whatsapp: true,
      publicPageHandler: true,
    },
    orderBy: [{ companyName: "asc" }, { name: "asc" }],
  });

  return users.map((u) => ({
    id: u.id,
    name: u.name ?? null,
    companyName: u.companyName ?? null,
    logoUrl: resolveAssetUrl(u.logoUrl),
    phone: u.phone ?? null,
    city: u.city ?? null,
    province: u.province ?? null,
    instagram: u.instagram ?? null,
    facebook: u.facebook ?? null,
    whatsapp: u.whatsapp ?? null,
    publicPageHandler: u.publicPageHandler ?? null,
  }));
}

export async function listDirectoryOrganizers(prisma: PrismaClient) {
  const rows = await prisma.organizerPublicProfile.findMany({
    where: buildDirectoryOrganizersWhere(),
    select: {
      id: true,
      displayName: true,
      tagline: true,
      publicSlug: true,
      logoR2Key: true,
      city: true,
      zone: true,
      website: true,
      instagram: true,
      whatsapp: true,
      publicEmail: true,
    },
    orderBy: { displayName: "asc" },
  });

  return rows.map((p) => ({
    id: p.id,
    displayName: p.displayName,
    tagline: p.tagline,
    publicSlug: p.publicSlug,
    logoUrl: resolveAssetUrl(p.logoR2Key),
    city: p.city,
    zone: p.zone,
    website: p.website,
    instagram: p.instagram,
    whatsapp: p.whatsapp,
    publicEmail: p.publicEmail,
  }));
}
