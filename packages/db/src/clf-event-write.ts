/**
 * Escritura de Event CLF (create/update/close) reutilizable.
 * Usa un PrismaClient apuntando a la DB CLF.
 */

import { createHash, randomBytes } from "node:crypto";
import type { PrismaClient } from "@prisma/client";

const VALID_EVENT_TYPES = [
  "PUBLIC_SESSION",
  "PRIVATE_SESSION",
  "SPORTS",
  "PUBLIC_PHOTOGRAPHY",
  "THEMATIC_SESSIONS",
  "COMMERCIAL_SESSIONS",
  "SCHOOL",
  "RELIGIOUS",
  "FESTIVAL",
  "CONFERENCE",
  "CONCERT",
  "CORPORATE",
  "OTHER",
  "WEDDING",
  "BIRTHDAY",
  "GRADUATION",
] as const;

export type ClfEventWriteInput = {
  title: string;
  description?: string | null;
  type: string;
  startsAt: Date;
  endsAt?: Date | null;
  latitude: number;
  longitude: number;
  locationName?: string | null;
  city: string;
  visibility: "PUBLIC" | "UNLISTED" | "PRIVATE";
  joinPolicy: "OPEN" | "REQUEST" | "INVITE_ONLY";
  maxPhotographers?: number | null;
  photographerTerms?: string | null;
  coverImageKey?: string | null;
  status?: "ACTIVE" | "CLOSED";
  creatorId: number;
};

function encodeGeohash(lat: number, lng: number, precision = 8): string {
  const BASE32 = "0123456789bcdefghjkmnpqrstuvwxyz";
  const idx: number[] = [];
  let latMin = -90;
  let latMax = 90;
  let lngMin = -180;
  let lngMax = 180;
  let isEven = true;
  while (idx.length < precision * 5) {
    if (isEven) {
      const mid = (lngMin + lngMax) / 2;
      idx.push(lng >= mid ? 1 : 0);
      if (lng >= mid) lngMin = mid;
      else lngMax = mid;
    } else {
      const mid = (latMin + latMax) / 2;
      idx.push(lat >= mid ? 1 : 0);
      if (lat >= mid) latMin = mid;
      else latMax = mid;
    }
    isEven = !isEven;
  }
  let hash = "";
  for (let c = 0; c < precision; c++) {
    let n = 0;
    for (let b = 0; b < 5; b++) n = (n << 1) | (idx[c * 5 + b] ?? 0);
    hash += BASE32[n];
  }
  return hash;
}

export function normalizeVisibilityJoinPolicy(input: {
  visibility: string;
  joinPolicy: string;
}): { visibility: "PUBLIC" | "UNLISTED" | "PRIVATE"; joinPolicy: "OPEN" | "REQUEST" | "INVITE_ONLY" } {
  let jp = ["OPEN", "REQUEST", "INVITE_ONLY"].includes(input.joinPolicy)
    ? (input.joinPolicy as "OPEN" | "REQUEST" | "INVITE_ONLY")
    : "OPEN";
  let vis = ["PUBLIC", "UNLISTED", "PRIVATE"].includes(input.visibility)
    ? (input.visibility as "PUBLIC" | "UNLISTED" | "PRIVATE")
    : "PUBLIC";
  if (jp === "INVITE_ONLY") {
    if (vis !== "PRIVATE" && vis !== "UNLISTED") vis = "UNLISTED";
  } else {
    vis = "PUBLIC";
  }
  return { visibility: vis, joinPolicy: jp };
}

export function validateClfEventWriteInput(
  input: ClfEventWriteInput,
): { ok: true } | { ok: false; error: string } {
  if (!input.title?.trim()) return { ok: false, error: "El título es requerido" };
  if (!VALID_EVENT_TYPES.includes(input.type as (typeof VALID_EVENT_TYPES)[number])) {
    return { ok: false, error: "Tipo de evento inválido" };
  }
  if (!(input.startsAt instanceof Date) || Number.isNaN(input.startsAt.getTime())) {
    return { ok: false, error: "Fecha de inicio requerida" };
  }
  if (!Number.isFinite(input.latitude) || !Number.isFinite(input.longitude)) {
    return { ok: false, error: "Ubicación (lat/lng) requerida" };
  }
  if (input.latitude === 0 && input.longitude === 0) {
    return { ok: false, error: "Coordenadas inválidas (0,0)" };
  }
  if (!input.city?.trim()) return { ok: false, error: "Ciudad requerida" };
  if (!input.creatorId || !Number.isFinite(input.creatorId)) {
    return { ok: false, error: "creatorId requerido" };
  }
  return { ok: true };
}

async function ensureShareSlug(client: PrismaClient, eventId: number): Promise<string> {
  const existing = await client.event.findUnique({
    where: { id: eventId },
    select: { shareSlug: true },
  });
  if (existing?.shareSlug) return existing.shareSlug;

  let slug: string;
  let attempts = 0;
  do {
    slug = `e-${randomBytes(8).toString("base64url").replace(/[_-]/g, "").slice(0, 12)}`;
    attempts += 1;
    if (attempts > 5) {
      slug = `e-${eventId}-${randomBytes(4).toString("hex")}`;
      break;
    }
  } while (await client.event.findUnique({ where: { shareSlug: slug } }));

  const updated = await client.event.update({
    where: { id: eventId },
    data: { shareSlug: slug },
    select: { shareSlug: true },
  });
  return updated.shareSlug!;
}

export type ClfEventWriteResult = {
  id: number;
  shareSlug: string;
  status: string;
  visibility: string;
  joinPolicy: string;
  maxPhotographers: number | null;
  updatedAt: Date;
};

export async function createClfEvent(
  client: PrismaClient,
  input: ClfEventWriteInput,
): Promise<ClfEventWriteResult> {
  const validated = validateClfEventWriteInput(input);
  if (!validated.ok) throw new Error(validated.error);

  const { visibility, joinPolicy } = normalizeVisibilityJoinPolicy(input);
  const geohash = encodeGeohash(input.latitude, input.longitude);

  const created = await client.event.create({
    data: {
      title: input.title.trim(),
      description: input.description?.trim() || null,
      type: input.type as never,
      status: input.status === "CLOSED" ? "CLOSED" : "ACTIVE",
      startsAt: input.startsAt,
      endsAt: input.endsAt && !Number.isNaN(input.endsAt.getTime()) ? input.endsAt : null,
      latitude: input.latitude,
      longitude: input.longitude,
      locationName: input.locationName?.trim() || null,
      city: input.city.trim(),
      geohash,
      visibility,
      joinPolicy,
      maxPhotographers:
        input.maxPhotographers != null &&
        Number.isFinite(input.maxPhotographers) &&
        input.maxPhotographers > 0
          ? Math.trunc(input.maxPhotographers)
          : null,
      photographerTerms: input.photographerTerms?.trim() || null,
      coverImageKey: input.coverImageKey?.trim() || null,
      creatorId: input.creatorId,
    },
    select: {
      id: true,
      status: true,
      visibility: true,
      joinPolicy: true,
      maxPhotographers: true,
      updatedAt: true,
    },
  });

  const shareSlug = await ensureShareSlug(client, created.id);
  return { ...created, shareSlug };
}

export async function updateClfEvent(
  client: PrismaClient,
  eventId: number,
  input: Partial<ClfEventWriteInput> & { status?: "ACTIVE" | "CLOSED" },
): Promise<ClfEventWriteResult> {
  const existing = await client.event.findUnique({ where: { id: eventId } });
  if (!existing) throw new Error(`Event CLF ${eventId} no encontrado`);

  const merged: ClfEventWriteInput = {
    title: input.title ?? existing.title,
    description: input.description !== undefined ? input.description : existing.description,
    type: input.type ?? existing.type,
    startsAt: input.startsAt ?? existing.startsAt,
    endsAt: input.endsAt !== undefined ? input.endsAt : existing.endsAt,
    latitude: input.latitude ?? existing.latitude,
    longitude: input.longitude ?? existing.longitude,
    locationName:
      input.locationName !== undefined ? input.locationName : existing.locationName,
    city: input.city ?? existing.city,
    visibility: (input.visibility ?? existing.visibility) as ClfEventWriteInput["visibility"],
    joinPolicy: (input.joinPolicy ?? existing.joinPolicy) as ClfEventWriteInput["joinPolicy"],
    maxPhotographers:
      input.maxPhotographers !== undefined
        ? input.maxPhotographers
        : existing.maxPhotographers,
    photographerTerms:
      input.photographerTerms !== undefined
        ? input.photographerTerms
        : existing.photographerTerms,
    coverImageKey:
      input.coverImageKey !== undefined ? input.coverImageKey : existing.coverImageKey,
    status: input.status ?? (existing.status as "ACTIVE" | "CLOSED"),
    creatorId: existing.creatorId,
  };

  const validated = validateClfEventWriteInput(merged);
  if (!validated.ok) throw new Error(validated.error);
  const { visibility, joinPolicy } = normalizeVisibilityJoinPolicy(merged);

  const updated = await client.event.update({
    where: { id: eventId },
    data: {
      title: merged.title.trim(),
      description: merged.description?.trim() || null,
      type: merged.type as never,
      status: merged.status === "CLOSED" ? "CLOSED" : "ACTIVE",
      startsAt: merged.startsAt,
      endsAt: merged.endsAt,
      latitude: merged.latitude,
      longitude: merged.longitude,
      locationName: merged.locationName?.trim() || null,
      city: merged.city.trim(),
      geohash: encodeGeohash(merged.latitude, merged.longitude),
      visibility,
      joinPolicy,
      maxPhotographers:
        merged.maxPhotographers != null && merged.maxPhotographers > 0
          ? Math.trunc(merged.maxPhotographers)
          : null,
      photographerTerms: merged.photographerTerms?.trim() || null,
      coverImageKey: merged.coverImageKey?.trim() || null,
    },
    select: {
      id: true,
      status: true,
      visibility: true,
      joinPolicy: true,
      maxPhotographers: true,
      updatedAt: true,
      shareSlug: true,
    },
  });

  const shareSlug = updated.shareSlug ?? (await ensureShareSlug(client, eventId));
  return { ...updated, shareSlug };
}

export async function closeClfEventCall(
  client: PrismaClient,
  eventId: number,
): Promise<ClfEventWriteResult> {
  return updateClfEvent(client, eventId, { status: "CLOSED" });
}

export function hashOperationalSnapshot(payload: Record<string, unknown>): string {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex").slice(0, 32);
}
