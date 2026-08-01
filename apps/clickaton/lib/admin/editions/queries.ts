import { prisma, withClickatonDb, type ClickatonDbResult } from "@/lib/admin/db";
import type { ClickatonEditionRecord } from "./types";

const editionSelect = {
  id: true,
  name: true,
  slug: true,
  shortDescription: true,
  description: true,
  status: true,
  isPublished: true,
  registrationEnabled: true,
  timezone: true,
  startAt: true,
  endAt: true,
  registrationOpenAt: true,
  registrationCloseAt: true,
  defaultCapacity: true,
  location: true,
  city: true,
  provinceOrState: true,
  country: true,
  currency: true,
  fotorankContestId: true,
  fotoRankSyncEnabled: true,
  fotoRankSyncMode: true,
  fotoRankValidationStatus: true,
  fotoRankLastValidatedAt: true,
  fotoRankValidationError: true,
  coverImageUrl: true,
  coverImageVerticalUrl: true,
  paymentBeneficiaryConfig: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { venues: true } },
} as const;

function mapEdition(row: {
  id: string;
  name: string;
  slug: string;
  shortDescription: string | null;
  description: string | null;
  status: ClickatonEditionRecord["status"];
  isPublished: boolean;
  registrationEnabled: boolean;
  timezone: string | null;
  startAt: Date | null;
  endAt: Date | null;
  registrationOpenAt: Date | null;
  registrationCloseAt: Date | null;
  defaultCapacity: number | null;
  location: string | null;
  city: string | null;
  provinceOrState: string | null;
  country: string;
  currency: string;
  fotorankContestId: string | null;
  fotoRankSyncEnabled: boolean;
  fotoRankSyncMode: ClickatonEditionRecord["fotoRankSyncMode"];
  fotoRankValidationStatus: ClickatonEditionRecord["fotoRankValidationStatus"];
  fotoRankLastValidatedAt: Date | null;
  fotoRankValidationError: string | null;
  coverImageUrl: string | null;
  coverImageVerticalUrl: string | null;
  paymentBeneficiaryConfig: unknown;
  createdAt: Date;
  updatedAt: Date;
  _count?: { venues: number };
}): ClickatonEditionRecord {
  const { _count, ...rest } = row;
  return {
    ...rest,
    venueCount: _count?.venues ?? 0,
  };
}

export async function listEditions(): Promise<ClickatonDbResult<ClickatonEditionRecord[]>> {
  return withClickatonDb(async () => {
    const rows = await prisma.clickatonEdition.findMany({
      select: editionSelect,
      orderBy: [{ startAt: "asc" }, { createdAt: "desc" }],
    });
    return rows.map(mapEdition);
  });
}

export async function getEditionById(
  editionId: string,
): Promise<ClickatonDbResult<ClickatonEditionRecord | null>> {
  return withClickatonDb(async () => {
    const row = await prisma.clickatonEdition.findUnique({
      where: { id: editionId },
      select: editionSelect,
    });
    return row ? mapEdition(row) : null;
  });
}

/** Resuelve por id (cuid) o slug — evita 404 si la URL usa el slug público. */
export async function getEditionByIdOrSlug(
  editionIdOrSlug: string,
): Promise<ClickatonDbResult<ClickatonEditionRecord | null>> {
  return withClickatonDb(async () => {
    const byId = await prisma.clickatonEdition.findUnique({
      where: { id: editionIdOrSlug },
      select: editionSelect,
    });
    if (byId) return mapEdition(byId);
    const bySlug = await prisma.clickatonEdition.findUnique({
      where: { slug: editionIdOrSlug },
      select: editionSelect,
    });
    return bySlug ? mapEdition(bySlug) : null;
  });
}

export async function getEditionBySlug(
  slug: string,
): Promise<ClickatonDbResult<ClickatonEditionRecord | null>> {
  return withClickatonDb(async () => {
    const row = await prisma.clickatonEdition.findUnique({
      where: { slug },
      select: editionSelect,
    });
    return row ? mapEdition(row) : null;
  });
}

export async function editionSlugExists(
  slug: string,
  excludeId?: string,
): Promise<ClickatonDbResult<boolean>> {
  return withClickatonDb(async () => {
    const existing = await prisma.clickatonEdition.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!existing) return false;
    if (excludeId && existing.id === excludeId) return false;
    return true;
  });
}

export async function listEditionOptions(): Promise<
  ClickatonDbResult<Array<{ id: string; name: string; slug: string; status: string }>>
> {
  return withClickatonDb(async () => {
    return prisma.clickatonEdition.findMany({
      select: { id: true, name: true, slug: true, status: true },
      orderBy: { name: "asc" },
    });
  });
}

export type EditionDashboardMetrics = {
  totalEditions: number;
  operativeEditions: number;
  nextEdition: ClickatonEditionRecord | null;
  totalVenues: number;
  totalCapacity: number;
};

export async function getEditionDashboardMetrics(): Promise<
  ClickatonDbResult<EditionDashboardMetrics>
> {
  return withClickatonDb(async () => {
    const [editions, venueAgg, capacityAgg] = await Promise.all([
      prisma.clickatonEdition.findMany({
        select: editionSelect,
        orderBy: { startAt: "asc" },
      }),
      prisma.clickatonVenue.count(),
      prisma.clickatonVenue.aggregate({
        _sum: { capacity: true },
      }),
    ]);

    const mapped = editions.map(mapEdition);
    const now = Date.now();
    const operativeEditions = mapped.filter(
      (e) => e.status === "REGISTRATION_OPEN" || e.status === "IN_PROGRESS",
    ).length;

    const nextEdition =
      mapped.find((e) => e.startAt && e.startAt.getTime() >= now) ??
      mapped.find((e) => e.startAt) ??
      mapped[0] ??
      null;

    const venueCapacity = capacityAgg._sum.capacity ?? 0;
    const defaultCapacitySum = mapped.reduce((sum, e) => sum + (e.defaultCapacity ?? 0), 0);
    const totalCapacity = venueCapacity > 0 ? venueCapacity : defaultCapacitySum;

    return {
      totalEditions: mapped.length,
      operativeEditions,
      nextEdition,
      totalVenues: venueAgg,
      totalCapacity,
    };
  });
}
