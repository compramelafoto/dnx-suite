import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { Role, EventPhotoPricingMode } from "@/lib/prisma";
import { prisma } from "@/lib/prisma";
import { encodeGeohash } from "@/lib/geo";
import { getR2PublicUrl } from "@/lib/r2-client";
import { resolveEventOrganizerCommissionForPatch } from "@/lib/event-organizer-commission";
import {
  eventPhotoPricingFieldsTouched,
  resolveEventPhotoPricingForPatch,
} from "@/lib/event-photo-pricing";
import { triggerAutoNearbyPhotographerInviteOnVisibilityChange } from "@/lib/event-nearby-photographer-invite";
import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getEventAndCheck(req: NextRequest, id: number) {
  const { error, user } = await requireAuth([Role.ORGANIZER]);
  if (error || !user) return { error: true, status: 401 as const, message: error || "No autorizado" };
  const event = await prisma.event.findUnique({
    where: { id },
    include: {
      _count: { select: { albums: true, members: true } },
      members: { include: { user: { select: { id: true, name: true, email: true, companyName: true, phone: true } } } },
      invitedPhotographers: { include: { user: { select: { id: true, name: true, email: true, companyName: true, phone: true } } } },
    },
  });
  if (!event) return { error: true, status: 404 as const, message: "Evento no encontrado" };
  if (event.creatorId !== user.id) return { error: true, status: 403 as const, message: "No podés editar este evento" };
  return { error: false as const, user, event };
}

/**
 * GET /api/organizer/events/[id]
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await Promise.resolve(params);
    const eventId = parseInt(id, 10);
    if (!Number.isFinite(eventId)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }
    const check = await getEventAndCheck(req, eventId);
    if (check.error) {
      return NextResponse.json({ error: check.message }, { status: check.status });
    }
    let e = check.event!;
    if (!e.shareSlug) {
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
      e = await prisma.event.update({
        where: { id: e.id },
        data: { shareSlug: slug },
        include: {
          _count: { select: { albums: true, members: true } },
          members: { include: { user: { select: { id: true, name: true, email: true, companyName: true, phone: true } } } },
          invitedPhotographers: { include: { user: { select: { id: true, name: true, email: true, companyName: true, phone: true } } } },
        },
      }) as typeof e;
    }
    return NextResponse.json({
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
      shareSlug: e.shareSlug,
      coverImageKey: e.coverImageKey,
      coverUrl: e.coverImageKey ? getR2PublicUrl(e.coverImageKey) : null,
      createdAt: e.createdAt,
      albumsCount: e._count.albums,
      membersCount: e._count.members,
      photographers: e.members
        ?.filter((m) => m.role === "PHOTOGRAPHER" && m.status === "ACTIVE")
        .map((m) => ({
          userId: m.userId,
          name: m.user.name,
          email: m.user.email,
          companyName: m.user.companyName,
          phone: m.user.phone,
          joinedAt: m.createdAt,
        })) ?? [],
      invitedPhotographers: e.invitedPhotographers?.map((inv) => ({
        userId: inv.userId,
        name: inv.user.name,
        email: inv.user.email,
        companyName: inv.user.companyName,
        phone: inv.user.phone,
      })) ?? [],
      organizerCommissionEnabled: e.organizerCommissionEnabled,
      organizerCommissionPercentage: e.organizerCommissionPercentage,
      organizerCommissionUpdatedAt: e.organizerCommissionUpdatedAt?.toISOString() ?? null,
      organizerCommissionUpdatedById: e.organizerCommissionUpdatedById ?? null,
      photoPricingMode: e.photoPricingMode,
      fixedPhotoPrice: e.fixedPhotoPrice,
      minimumPhotoPrice: e.minimumPhotoPrice,
      photoPricingUpdatedAt: e.photoPricingUpdatedAt?.toISOString() ?? null,
      photoPricingUpdatedById: e.photoPricingUpdatedById ?? null,
    });
  } catch (err: any) {
    console.error("GET /api/organizer/events/[id] ERROR >>>", err);
    return NextResponse.json(
      { error: "Error obteniendo evento", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/organizer/events/[id]
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await Promise.resolve(params);
    const eventId = parseInt(id, 10);
    if (!Number.isFinite(eventId)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }
    const check = await getEventAndCheck(req, eventId);
    if (check.error) {
      return NextResponse.json({ error: check.message }, { status: check.status });
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
      uploadsEnabled,
      photographerTerms,
      status,
      organizerCommissionEnabled,
      organizerCommissionPercentage,
      photoPricingMode,
      fixedPhotoPrice,
      minimumPhotoPrice,
    } = body;

    const updateData: Record<string, unknown> = {};
    if (title !== undefined) updateData.title = String(title).trim();
    if (description !== undefined) updateData.description = description == null ? null : String(description).trim() || null;
    if (accreditationNotes !== undefined) updateData.accreditationNotes = accreditationNotes == null ? null : String(accreditationNotes).trim() || null;
    const VALID_EVENT_TYPES = ["PUBLIC_SESSION", "PRIVATE_SESSION", "SPORTS", "PUBLIC_PHOTOGRAPHY", "THEMATIC_SESSIONS", "COMMERCIAL_SESSIONS", "SCHOOL", "RELIGIOUS", "FESTIVAL", "CONFERENCE", "CONCERT", "CORPORATE", "OTHER", "WEDDING", "BIRTHDAY", "GRADUATION"];
    if (type !== undefined && VALID_EVENT_TYPES.includes(type)) updateData.type = type;
    if (startsAt !== undefined) {
      const d = new Date(startsAt);
      if (!isNaN(d.getTime())) updateData.startsAt = d;
    }
    if (endsAt !== undefined) {
      if (endsAt == null) updateData.endsAt = null;
      else {
        const d = new Date(endsAt);
        if (!isNaN(d.getTime())) updateData.endsAt = d;
      }
    }
    if (latitude !== undefined && longitude !== undefined) {
      const lat = parseFloat(String(latitude));
      const lng = parseFloat(String(longitude));
      if (!isNaN(lat) && !isNaN(lng)) {
        updateData.latitude = lat;
        updateData.longitude = lng;
        updateData.geohash = encodeGeohash(lat, lng);
      }
    }
    if (locationName !== undefined) updateData.locationName = locationName == null ? null : String(locationName).trim() || null;
    if (city !== undefined) updateData.city = String(city).trim();
    if (visibility !== undefined && ["PUBLIC", "UNLISTED", "PRIVATE"].includes(visibility)) updateData.visibility = visibility;
    if (joinPolicy !== undefined && ["OPEN", "REQUEST", "INVITE_ONLY"].includes(joinPolicy)) updateData.joinPolicy = joinPolicy;
    if (uploadsEnabled !== undefined) updateData.uploadsEnabled = uploadsEnabled === true;
    if (photographerTerms !== undefined) {
      updateData.photographerTerms = photographerTerms == null ? null : String(photographerTerms).trim() || null;
    }
    if (status !== undefined && ["ACTIVE", "CLOSED"].includes(status)) updateData.status = status;
    if (maxPhotographers !== undefined) {
      const n = Number(maxPhotographers);
      updateData.maxPhotographers = n > 0 ? n : null;
    }
    if (expectedAttendees !== undefined) {
      const n = Number(expectedAttendees);
      updateData.expectedAttendees = n > 0 ? n : null;
    }

    const current = check.event!;
    const nextVisibility = (updateData.visibility as string | undefined) ?? current.visibility;
    const nextJoinPolicy = (updateData.joinPolicy as string | undefined) ?? current.joinPolicy;

    if (nextJoinPolicy === "INVITE_ONLY") {
      if (nextVisibility !== "PRIVATE" && nextVisibility !== "UNLISTED") {
        return NextResponse.json(
          {
            error:
              "Los eventos solo por invitación deben tener visibilidad privada o solo con link (no públicos en listados).",
          },
          { status: 400 }
        );
      }
    }
    if (nextJoinPolicy === "OPEN" || nextJoinPolicy === "REQUEST") {
      if (nextVisibility !== "PUBLIC") {
        updateData.visibility = "PUBLIC";
      }
    }

    const commissionRes = resolveEventOrganizerCommissionForPatch(
      {
        organizerCommissionEnabled: Boolean(current.organizerCommissionEnabled),
        organizerCommissionPercentage: current.organizerCommissionPercentage,
      },
      { organizerCommissionEnabled, organizerCommissionPercentage }
    );
    if (!commissionRes.ok) {
      return NextResponse.json({ error: commissionRes.error }, { status: 400 });
    }
    if (commissionRes.ok && "value" in commissionRes) {
      updateData.organizerCommissionEnabled = commissionRes.value.enabled;
      updateData.organizerCommissionPercentage = commissionRes.value.percentage;
      updateData.organizerCommissionUpdatedAt = new Date();
      updateData.organizerCommissionUpdatedById = check.user!.id;
    }

    if (eventPhotoPricingFieldsTouched(body)) {
      const pricingRes = resolveEventPhotoPricingForPatch(
        {
          photoPricingMode: current.photoPricingMode,
          fixedPhotoPrice: current.fixedPhotoPrice,
          minimumPhotoPrice: current.minimumPhotoPrice,
        },
        {
          photoPricingMode,
          fixedPhotoPrice,
          minimumPhotoPrice,
        }
      );
      if (!pricingRes.ok) {
        return NextResponse.json({ error: pricingRes.error }, { status: 400 });
      }
      updateData.photoPricingMode = pricingRes.value.photoPricingMode;
      updateData.fixedPhotoPrice = pricingRes.value.fixedPhotoPrice;
      updateData.minimumPhotoPrice = pricingRes.value.minimumPhotoPrice;
      const pricingAudit =
        pricingRes.value.photoPricingMode !== EventPhotoPricingMode.PHOTOGRAPHER_DECIDES;
      updateData.photoPricingUpdatedAt = pricingAudit ? new Date() : null;
      updateData.photoPricingUpdatedById = pricingAudit ? check.user!.id : null;
    }

    const event = await prisma.event.update({
      where: { id: eventId },
      data: updateData as any,
    });

    const previousVisibility = current.visibility;
    const newVisibility = event.visibility;
    if (previousVisibility !== newVisibility) {
      const creatorName = check.user!.name || check.user!.email || "El organizador";
      void triggerAutoNearbyPhotographerInviteOnVisibilityChange(
        eventId,
        previousVisibility,
        newVisibility,
        creatorName
      );
    }

    return NextResponse.json(event);
  } catch (err: any) {
    console.error("PATCH /api/organizer/events/[id] ERROR >>>", err);
    return NextResponse.json(
      { error: "Error actualizando evento", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/organizer/events/[id]
 * Solo el creador del evento puede eliminarlo.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await Promise.resolve(params);
    const eventId = parseInt(id, 10);
    if (!Number.isFinite(eventId)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }
    const check = await getEventAndCheck(req, eventId);
    if (check.error) {
      return NextResponse.json({ error: check.message }, { status: check.status });
    }
    await prisma.event.delete({ where: { id: eventId } });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("DELETE /api/organizer/events/[id] ERROR >>>", err);
    return NextResponse.json(
      { error: "Error eliminando evento", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
