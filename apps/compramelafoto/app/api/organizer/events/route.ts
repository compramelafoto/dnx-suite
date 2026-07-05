import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { Role, EventPhotoPricingMode } from "@/lib/prisma";
import { prisma } from "@/lib/prisma";
import { encodeGeohash } from "@/lib/geo";
import { getR2PublicUrl } from "@/lib/r2-client";
import { resolveEventOrganizerCommissionForCreate } from "@/lib/event-organizer-commission";
import { resolveEventPhotoPricingForCreate } from "@/lib/event-photo-pricing";
import { triggerAutoNearbyPhotographerInviteIfNeeded } from "@/lib/event-nearby-photographer-invite";
import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/organizer/events
 * Lista los eventos creados por el organizador.
 */
export async function GET() {
  try {
    const { error, user } = await requireAuth([Role.ORGANIZER]);
    if (error || !user) {
      return NextResponse.json({ error: error || "No autorizado" }, { status: 401 });
    }

    const events = await prisma.event.findMany({
      where: { creatorId: user.id },
      orderBy: { startsAt: "desc" },
      include: {
        _count: { select: { albums: true, members: true } },
      },
    });

    const eventsWithSlug = await Promise.all(
      events.map(async (e) => {
        if (e.shareSlug) return e;
        let slug: string;
        let attempts = 0;
        do {
          slug = `e-${crypto.randomBytes(8).toString("base64url").replace(/[_-]/g, "").slice(0, 12)}`;
          attempts++;
          if (attempts > 5) {
            slug = `e-${e.id}-${crypto.randomBytes(4).toString("hex")}`;
            break;
          }
        } while (await prisma.event.findUnique({ where: { shareSlug: slug } }));
        return prisma.event.update({
          where: { id: e.id },
          data: { shareSlug: slug },
          include: { _count: { select: { albums: true, members: true } } },
        });
      })
    );

    return NextResponse.json(
      eventsWithSlug.map((e) => ({
        id: e.id,
        title: e.title,
        description: e.description,
        type: e.type,
        status: e.status,
        startsAt: e.startsAt,
        endsAt: e.endsAt,
        latitude: e.latitude,
        longitude: e.longitude,
        locationName: e.locationName,
        city: e.city,
        visibility: e.visibility,
        joinPolicy: e.joinPolicy,
        uploadsEnabled: e.uploadsEnabled,
        photographerTerms: e.photographerTerms,
        maxPhotographers: e.maxPhotographers,
        expectedAttendees: e.expectedAttendees,
        accreditationNotes: e.accreditationNotes,
        coverUrl: e.coverImageKey ? getR2PublicUrl(e.coverImageKey) : null,
        shareSlug: e.shareSlug ?? null,
        createdAt: e.createdAt,
        albumsCount: e._count.albums,
        membersCount: e._count.members,
      }))
    );
  } catch (err: any) {
    console.error("GET /api/organizer/events ERROR >>>", err);
    return NextResponse.json(
      { error: "Error listando eventos", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}

/**
 * POST /api/organizer/events
 * Crea un nuevo evento.
 */
export async function POST(req: NextRequest) {
  try {
    const { error, user } = await requireAuth([Role.ORGANIZER]);
    if (error || !user) {
      return NextResponse.json({ error: error || "No autorizado" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const {
      title,
      description,
      accreditationNotes,
      type,
      startsAt,
      endsAt,
      latitude,
      longitude,
      locationName,
      city,
      maxPhotographers,
      expectedAttendees,
      visibility,
      joinPolicy,
      photographerTerms,
      uploadsEnabled,
      status,
      invitedUserIds,
      organizerCommissionEnabled,
      organizerCommissionPercentage,
      photoPricingMode,
      fixedPhotoPrice,
      minimumPhotoPrice,
    } = body;

    if (!title || !String(title).trim()) {
      return NextResponse.json({ error: "El título es requerido" }, { status: 400 });
    }
    const VALID_EVENT_TYPES = ["PUBLIC_SESSION", "PRIVATE_SESSION", "SPORTS", "PUBLIC_PHOTOGRAPHY", "THEMATIC_SESSIONS", "COMMERCIAL_SESSIONS", "SCHOOL", "RELIGIOUS", "FESTIVAL", "CONFERENCE", "CONCERT", "CORPORATE", "OTHER", "WEDDING", "BIRTHDAY", "GRADUATION"];
    if (!type || !VALID_EVENT_TYPES.includes(type)) {
      return NextResponse.json({ error: "Tipo de evento inválido" }, { status: 400 });
    }
    const parsedStartsAt = startsAt ? new Date(startsAt) : null;
    if (!parsedStartsAt || isNaN(parsedStartsAt.getTime())) {
      return NextResponse.json({ error: "Fecha de inicio requerida" }, { status: 400 });
    }
    const lat = latitude != null ? parseFloat(String(latitude)) : NaN;
    const lng = longitude != null ? parseFloat(String(longitude)) : NaN;
    if (isNaN(lat) || isNaN(lng)) {
      return NextResponse.json({ error: "Ubicación (lat/lng) requerida" }, { status: 400 });
    }
    const cityStr = city != null ? String(city).trim() : "";
    if (!cityStr) {
      return NextResponse.json({ error: "Ciudad requerida" }, { status: 400 });
    }

    const geohash = encodeGeohash(lat, lng);
    const endsAtDate = endsAt ? new Date(endsAt) : null;

    const rawJp = joinPolicy != null ? String(joinPolicy) : "OPEN";
    const jp = ["OPEN", "REQUEST", "INVITE_ONLY"].includes(rawJp) ? rawJp : "OPEN";
    let vis = visibility != null ? String(visibility) : "PUBLIC";
    if (!["PUBLIC", "UNLISTED", "PRIVATE"].includes(vis)) vis = "PUBLIC";

    if (jp === "INVITE_ONLY") {
      if (vis !== "PRIVATE" && vis !== "UNLISTED") {
        return NextResponse.json(
          {
            error:
              "Los eventos solo por invitación deben usar visibilidad «solo con el link» o «lista cerrada», no pública en listados.",
          },
          { status: 400 }
        );
      }
    } else {
      vis = "PUBLIC";
    }

    const commission = resolveEventOrganizerCommissionForCreate({
      organizerCommissionEnabled,
      organizerCommissionPercentage,
    });
    if (!commission.ok) {
      return NextResponse.json({ error: commission.error }, { status: 400 });
    }

    const photoPricing = resolveEventPhotoPricingForCreate({
      photoPricingMode,
      fixedPhotoPrice,
      minimumPhotoPrice,
    });
    if (!photoPricing.ok) {
      return NextResponse.json({ error: photoPricing.error }, { status: 400 });
    }

    const photoPricingUpdated =
      photoPricing.value.photoPricingMode !== EventPhotoPricingMode.PHOTOGRAPHER_DECIDES;

    const event = await prisma.event.create({
      data: {
        title: String(title).trim(),
        description: description != null ? String(description).trim() || null : null,
        accreditationNotes: accreditationNotes != null ? String(accreditationNotes).trim() || null : null,
        type,
        status: status === "CLOSED" ? "CLOSED" : "ACTIVE",
        startsAt: parsedStartsAt,
        endsAt: endsAtDate && !isNaN(endsAtDate.getTime()) ? endsAtDate : null,
        latitude: lat,
        longitude: lng,
        locationName: locationName != null ? String(locationName).trim() || null : null,
        city: cityStr,
        geohash,
        visibility: vis as "PUBLIC" | "UNLISTED" | "PRIVATE",
        joinPolicy: jp as "OPEN" | "REQUEST" | "INVITE_ONLY",
        maxPhotographers:
          maxPhotographers != null && Number.isFinite(Number(maxPhotographers)) && Number(maxPhotographers) > 0
            ? Number(maxPhotographers)
            : null,
        expectedAttendees:
          expectedAttendees != null && Number.isFinite(Number(expectedAttendees)) && Number(expectedAttendees) > 0
            ? Number(expectedAttendees)
            : null,
        photographerTerms: photographerTerms != null ? String(photographerTerms).trim() || null : null,
        uploadsEnabled: uploadsEnabled === true,
        creatorId: user.id,
        organizerCommissionEnabled: commission.value.enabled,
        organizerCommissionPercentage: commission.value.percentage,
        organizerCommissionUpdatedAt: commission.value.enabled ? new Date() : null,
        organizerCommissionUpdatedById: commission.value.enabled ? user.id : null,
        photoPricingMode: photoPricing.value.photoPricingMode,
        fixedPhotoPrice: photoPricing.value.fixedPhotoPrice,
        minimumPhotoPrice: photoPricing.value.minimumPhotoPrice,
        photoPricingUpdatedAt: photoPricingUpdated ? new Date() : null,
        photoPricingUpdatedById: photoPricingUpdated ? user.id : null,
      },
    });

    const invitedIds = Array.isArray(invitedUserIds)
      ? invitedUserIds.filter((id: unknown) => Number.isFinite(Number(id))).map((id: unknown) => Number(id))
      : [];
    const uniqueInvited = [...new Set(invitedIds)];
    if (uniqueInvited.length > 0) {
      await prisma.eventInvitation.createMany({
        data: uniqueInvited.map((userId) => ({ eventId: event.id, userId })),
        skipDuplicates: true,
      });
    }

    if (vis === "PUBLIC") {
      const creatorName = user.name || user.email || "El organizador";
      void triggerAutoNearbyPhotographerInviteIfNeeded(event.id, user.id, creatorName);
    }

    return NextResponse.json(event);
  } catch (err: any) {
    console.error("POST /api/organizer/events ERROR >>>", err);
    return NextResponse.json(
      { error: "Error creando evento", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
