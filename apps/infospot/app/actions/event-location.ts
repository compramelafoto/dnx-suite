"use server";

import { z } from "zod";
import { prisma } from "@repo/db";
import {
  requireInfoSpotRedaccionAccess,
  canEditInfoSpotEvent,
  canModerateInfoSpotEvents,
} from "@/lib/infospot-access";
import { confirmEventLocation } from "@/lib/geolocation";
import { revalidateEventPaths } from "@/lib/event-revalidate";

const confirmSchema = z.object({
  eventId: z.string().min(1),
  latitude: z.coerce.number(),
  longitude: z.coerce.number(),
  city: z.string().trim().min(1).max(120),
  province: z.string().trim().min(1).max(120),
  address: z.string().trim().max(240).optional().nullable(),
  venueName: z.string().trim().max(240).optional().nullable(),
  postalCode: z.string().trim().max(32).optional().nullable(),
  countryCode: z.string().trim().max(8).optional().nullable(),
  countryName: z.string().trim().max(120).optional().nullable(),
  locationVisibility: z
    .enum(["EXACT", "APPROXIMATE", "CITY_ONLY", "HIDDEN"])
    .optional(),
  geocodingProvider: z.string().trim().max(64).optional().nullable(),
  geocodingPlaceId: z.string().trim().max(120).optional().nullable(),
});

export async function confirmEventLocationAction(
  input: z.infer<typeof confirmSchema>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const access = await requireInfoSpotRedaccionAccess();
  const canEdit =
    canEditInfoSpotEvent(access.subject) ||
    canModerateInfoSpotEvents(access.subject);
  if (!canEdit) return { ok: false, error: "Sin permiso." };

  const parsed = confirmSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Datos inválidos." };

  const event = await prisma.infoSpotEvent.findUnique({
    where: { id: parsed.data.eventId },
    select: { id: true, slug: true, originKind: true },
  });
  if (!event) return { ok: false, error: "Evento no encontrado." };

  const result = await confirmEventLocation({
    eventId: event.id,
    userId: access.user.id,
    latitude: parsed.data.latitude,
    longitude: parsed.data.longitude,
    city: parsed.data.city,
    province: parsed.data.province,
    address: parsed.data.address,
    venueName: parsed.data.venueName,
    postalCode: parsed.data.postalCode,
    countryCode: parsed.data.countryCode,
    countryName: parsed.data.countryName,
    locationVisibility: parsed.data.locationVisibility,
    geocodingProvider: parsed.data.geocodingProvider,
    geocodingPlaceId: parsed.data.geocodingPlaceId,
    setOverride: event.originKind === "IMPORTED" || event.originKind === "SYNCED_EXTERNAL",
  });

  if (!result.ok) return result;
  revalidateEventPaths(event.slug, event.id);
  return { ok: true };
}
