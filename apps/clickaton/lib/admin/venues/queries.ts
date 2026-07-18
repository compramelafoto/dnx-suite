import { prisma, withClickatonDb, type ClickatonDbResult } from "@/lib/admin/db";
import type { ClickatonVenueRecord } from "./types";

const venueSelect = {
  id: true,
  editionId: true,
  name: true,
  slug: true,
  city: true,
  provinceOrState: true,
  country: true,
  address: true,
  meetingPoint: true,
  capacity: true,
  contactName: true,
  contactEmail: true,
  contactPhone: true,
  startsAt: true,
  endsAt: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  edition: {
    select: { id: true, name: true, slug: true, status: true },
  },
} as const;

function mapVenue(row: Omit<ClickatonVenueRecord, "edition"> & {
  edition?: ClickatonVenueRecord["edition"];
}): ClickatonVenueRecord {
  return row;
}

export type VenueListFilters = {
  editionId?: string;
  active?: "all" | "active" | "inactive";
};

export async function listVenues(
  filters: VenueListFilters = {},
): Promise<ClickatonDbResult<ClickatonVenueRecord[]>> {
  return withClickatonDb(async () => {
    const where: {
      editionId?: string;
      isActive?: boolean;
    } = {};

    if (filters.editionId) where.editionId = filters.editionId;
    if (filters.active === "active") where.isActive = true;
    if (filters.active === "inactive") where.isActive = false;

    const rows = await prisma.clickatonVenue.findMany({
      where,
      select: venueSelect,
      orderBy: [{ edition: { name: "asc" } }, { city: "asc" }, { name: "asc" }],
    });
    return rows.map(mapVenue);
  });
}

export async function getVenueById(
  venueId: string,
): Promise<ClickatonDbResult<ClickatonVenueRecord | null>> {
  return withClickatonDb(async () => {
    const row = await prisma.clickatonVenue.findUnique({
      where: { id: venueId },
      select: venueSelect,
    });
    return row ? mapVenue(row) : null;
  });
}

export async function venueSlugExistsInEdition(
  editionId: string,
  slug: string,
  excludeVenueId?: string,
): Promise<ClickatonDbResult<boolean>> {
  return withClickatonDb(async () => {
    const existing = await prisma.clickatonVenue.findUnique({
      where: { editionId_slug: { editionId, slug } },
      select: { id: true },
    });
    if (!existing) return false;
    if (excludeVenueId && existing.id === excludeVenueId) return false;
    return true;
  });
}

export async function listVenuesByEditionId(
  editionId: string,
): Promise<ClickatonDbResult<ClickatonVenueRecord[]>> {
  return listVenues({ editionId });
}
