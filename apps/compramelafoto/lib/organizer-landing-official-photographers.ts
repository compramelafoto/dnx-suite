import { Role } from "@prisma/client";
import { loadOrganizerPhotographerAggs } from "@/lib/organizer-public-landing-data";
import { parseSortOrder } from "@/lib/organizer-landing-sponsors";
import { publicPhotographerProfilePath } from "@/lib/public-site-url";
import { prisma } from "@/lib/prisma";

export type OrganizerOfficialPhotographerDto = {
  id: number;
  photographerUserId: number;
  sortOrder: number;
  isActive: boolean;
  name: string;
  city: string | null;
  logoUrl: string | null;
  profileUrl: string | null;
  eventsWithOrganizer: number;
  createdAt: string;
  updatedAt: string;
};

const photographerSelect = {
  id: true,
  name: true,
  companyName: true,
  city: true,
  province: true,
  logoUrl: true,
  publicPageHandler: true,
  isPublicPageEnabled: true,
  role: true,
  isBlocked: true,
} as const;

function normalizeLogoUrl(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  const trimmed = raw.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

function displayName(user: {
  name: string | null;
  companyName: string | null;
}): string {
  return (user.companyName || user.name || "Fotógrafo").trim();
}

export function mapOrganizerOfficialPhotographerRow(
  row: {
    id: number;
    photographerUserId: number;
    sortOrder: number;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    photographer: {
      name: string | null;
      companyName: string | null;
      city: string | null;
      province: string | null;
      logoUrl: string | null;
      publicPageHandler: string | null;
      isPublicPageEnabled: boolean;
    };
  },
  eventsWithOrganizer: number
): OrganizerOfficialPhotographerDto {
  const handler = row.photographer.isPublicPageEnabled ? row.photographer.publicPageHandler : null;
  return {
    id: row.id,
    photographerUserId: row.photographerUserId,
    sortOrder: row.sortOrder,
    isActive: row.isActive,
    name: displayName(row.photographer),
    city: [row.photographer.city, row.photographer.province].filter(Boolean).join(" · ") || null,
    logoUrl: normalizeLogoUrl(row.photographer.logoUrl),
    profileUrl: handler ? publicPhotographerProfilePath(handler) : null,
    eventsWithOrganizer,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function loadOfficialPhotographerEventCounts(
  organizerUserId: number
): Promise<Map<number, number>> {
  const aggs = await loadOrganizerPhotographerAggs(organizerUserId);
  return new Map(aggs.map((a) => [a.userId, a.eventCount]));
}

export async function listOrganizerOfficialPhotographers(
  profileId: number,
  organizerUserId: number
): Promise<OrganizerOfficialPhotographerDto[]> {
  const [rows, eventCounts] = await Promise.all([
    prisma.organizerOfficialPhotographer.findMany({
      where: { profileId },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      include: { photographer: { select: photographerSelect } },
    }),
    loadOfficialPhotographerEventCounts(organizerUserId),
  ]);

  return rows.map((row) =>
    mapOrganizerOfficialPhotographerRow(row, eventCounts.get(row.photographerUserId) ?? 0)
  );
}

export async function validatePhotographerForOfficialListing(
  photographerUserId: number
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!Number.isInteger(photographerUserId) || photographerUserId <= 0) {
    return { ok: false, error: "Fotógrafo inválido." };
  }

  const user = await prisma.user.findUnique({
    where: { id: photographerUserId },
    select: { id: true, role: true, isBlocked: true },
  });

  if (!user) {
    return { ok: false, error: "Fotógrafo no encontrado." };
  }
  if (user.isBlocked) {
    return { ok: false, error: "Ese fotógrafo no está disponible." };
  }
  if (user.role !== Role.PHOTOGRAPHER && user.role !== Role.LAB_PHOTOGRAPHER) {
    return { ok: false, error: "El usuario seleccionado no es fotógrafo." };
  }

  return { ok: true };
}

export { parseSortOrder };
