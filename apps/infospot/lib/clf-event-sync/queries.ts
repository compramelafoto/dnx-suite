/**
 * Lectura de eventos CLF para sync de agenda (solo lectura).
 * Separado del flujo createDraftFromClfEventAction (artículos).
 */

import { getClfReadonlyClient, probeClfReadonlyConnection } from "../clf-readonly-db";
import type { ClfEventForSync } from "./types";

const eventSelect = {
  id: true,
  title: true,
  description: true,
  type: true,
  startsAt: true,
  endsAt: true,
  latitude: true,
  longitude: true,
  locationName: true,
  city: true,
  visibility: true,
  joinPolicy: true,
  maxPhotographers: true,
  shareSlug: true,
  coverImageKey: true,
  status: true,
  archivedAt: true,
  updatedAt: true,
  createdAt: true,
  creator: {
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      website: true,
      city: true,
      province: true,
      companyName: true,
    },
  },
  members: {
    where: { role: "PHOTOGRAPHER" as const, status: "ACTIVE" as const },
    select: { id: true },
  },
} as const;

function mapRow(row: {
  id: number;
  title: string;
  description: string | null;
  type: string;
  startsAt: Date;
  endsAt: Date | null;
  latitude: number;
  longitude: number;
  locationName: string | null;
  city: string;
  visibility: string;
  joinPolicy: string;
  maxPhotographers: number | null;
  shareSlug: string | null;
  coverImageKey: string | null;
  status: string;
  archivedAt: Date | null;
  updatedAt: Date;
  createdAt: Date;
  creator: ClfEventForSync["creator"];
  members: Array<{ id: number }>;
}): ClfEventForSync {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    type: row.type,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    latitude: row.latitude,
    longitude: row.longitude,
    locationName: row.locationName,
    city: row.city,
    visibility: row.visibility,
    joinPolicy: row.joinPolicy,
    maxPhotographers: row.maxPhotographers,
    shareSlug: row.shareSlug,
    coverImageKey: row.coverImageKey,
    status: row.status,
    archivedAt: row.archivedAt,
    updatedAt: row.updatedAt,
    createdAt: row.createdAt,
    creator: row.creator,
    activePhotographerCount: row.members.length,
  };
}

export async function listPublicClfEventsForSync(options?: {
  take?: number;
  includeNonPublic?: boolean;
}): Promise<ClfEventForSync[]> {
  const probe = await probeClfReadonlyConnection();
  if (!probe.ok) {
    throw new Error(probe.error || probe.info.reason || "CLF readonly no disponible");
  }

  const take = Math.min(Math.max(options?.take ?? 100, 1), 500);
  const client = getClfReadonlyClient();

  const where = options?.includeNonPublic
    ? { shareSlug: { not: null as string | null } }
    : {
        visibility: "PUBLIC" as const,
        archivedAt: null,
        shareSlug: { not: null as string | null },
      };

  const rows = await client.event.findMany({
    where,
    orderBy: [{ startsAt: "desc" }, { id: "desc" }],
    take,
    select: eventSelect,
  });

  return rows.map(mapRow);
}

export async function getPublicClfEventForSync(
  eventId: number,
): Promise<ClfEventForSync | null> {
  const probe = await probeClfReadonlyConnection();
  if (!probe.ok) {
    throw new Error(probe.error || probe.info.reason || "CLF readonly no disponible");
  }

  const client = getClfReadonlyClient();
  const row = await client.event.findUnique({
    where: { id: eventId },
    select: eventSelect,
  });
  return row ? mapRow(row) : null;
}
