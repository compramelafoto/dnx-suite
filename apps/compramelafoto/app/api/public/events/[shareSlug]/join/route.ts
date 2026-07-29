import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import {
  EventJoinPolicy,
  EventMemberRole,
  EventMemberStatus,
  EventStatus,
  Role,
} from "@/lib/prisma";
import { prisma } from "@/lib/prisma";
import { enrollPhotographerInEvent } from "@/lib/events/enroll-event-photographer";
import { resolveEventPhotographerTerms } from "@/lib/events/terms";
import { attributeApplicationFromCookie } from "@/lib/notifications/tracking";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/public/events/[shareSlug]/join
 * Inscripción pública de fotógrafos. Reutiliza enrollPhotographerInEvent para OPEN.
 * REQUEST → PENDING. INVITE_ONLY / PRIVATE requieren invitación.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ shareSlug: string }> },
) {
  try {
    const { error, user } = await requireAuth([Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER]);
    if (error || !user) {
      return NextResponse.json(
        { error: error || "Debés iniciar sesión como fotógrafo", outcome: "unauthorized" },
        { status: 401 },
      );
    }

    const { shareSlug } = await Promise.resolve(params);
    if (!shareSlug?.trim()) {
      return NextResponse.json({ error: "Slug inválido" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    if (body?.acceptTerms !== true) {
      return NextResponse.json(
        { error: "Debés aceptar las condiciones para inscribirte." },
        { status: 400 },
      );
    }

    const event = await prisma.event.findUnique({
      where: { shareSlug },
      include: {
        invitedPhotographers: { select: { userId: true } },
      },
    });
    if (!event || event.archivedAt) {
      return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });
    }
    if (event.status === EventStatus.CLOSED) {
      return NextResponse.json(
        { error: "Este evento ya no admite inscripciones.", outcome: "closed" },
        { status: 400 },
      );
    }

    const isPrivateOrInviteOnly =
      event.visibility === "PRIVATE" || event.joinPolicy === EventJoinPolicy.INVITE_ONLY;
    if (isPrivateOrInviteOnly) {
      const invited = (event.invitedPhotographers ?? []).some((i) => i.userId === user.id);
      if (!invited) {
        return NextResponse.json(
          {
            error: "Este evento es privado. Solo los fotógrafos invitados pueden inscribirse.",
            outcome: "not_invited",
          },
          { status: 403 },
        );
      }
    }

    const existing = await prisma.eventMember.findUnique({
      where: { eventId_userId: { eventId: event.id, userId: user.id } },
    });

    if (existing?.status === EventMemberStatus.ACTIVE) {
      return NextResponse.json({
        success: true,
        alreadyMember: true,
        outcome: "already_active",
        message: "Ya estás inscrito en este evento",
      });
    }
    if (existing?.status === EventMemberStatus.PENDING) {
      return NextResponse.json({
        success: true,
        outcome: "already_pending",
        message: "Tu solicitud ya está pendiente de aprobación.",
      });
    }
    if (existing?.status === EventMemberStatus.REJECTED && event.joinPolicy !== EventJoinPolicy.REQUEST) {
      return NextResponse.json(
        { success: false, outcome: "rejected", message: "Tu solicitud fue rechazada." },
        { status: 403 },
      );
    }

    // REQUEST → PENDING (no ACTIVE)
    if (event.joinPolicy === EventJoinPolicy.REQUEST && !isPrivateOrInviteOnly) {
      const termsText = resolveEventPhotographerTerms(event);
      if (existing) {
        await prisma.eventMember.update({
          where: { id: existing.id },
          data: {
            status: EventMemberStatus.PENDING,
            termsAcceptedAt: new Date(),
            termsAcceptedText: termsText,
          },
        });
      } else {
        await prisma.eventMember.create({
          data: {
            eventId: event.id,
            userId: user.id,
            role: EventMemberRole.PHOTOGRAPHER,
            status: EventMemberStatus.PENDING,
            termsAcceptedAt: new Date(),
            termsAcceptedText: termsText,
          },
        });
      }
      const member = await prisma.eventMember.findUnique({
        where: { eventId_userId: { eventId: event.id, userId: user.id } },
        select: { id: true },
      });
      await attributeApplicationFromCookie({
        userId: user.id,
        clfEventId: event.id,
        eventMemberId: member?.id ?? null,
      });
      return NextResponse.json({
        success: true,
        outcome: "request_pending",
        message: "Solicitud enviada. El organizador debe aprobarla.",
      });
    }

    const enroll = await enrollPhotographerInEvent({
      event: {
        id: event.id,
        title: event.title,
        locationName: event.locationName,
        city: event.city,
        startsAt: event.startsAt,
        endsAt: event.endsAt,
        type: event.type,
        latitude: event.latitude,
        longitude: event.longitude,
        uploadsEnabled: event.uploadsEnabled,
        joinPolicy: event.joinPolicy,
        photographerTerms: event.photographerTerms,
        maxPhotographers: event.maxPhotographers,
      },
      userId: user.id,
      byOrganizer: false,
    });

    if (!enroll.ok) {
      return NextResponse.json({ error: enroll.message }, { status: enroll.status });
    }

    const member = await prisma.eventMember.findUnique({
      where: { eventId_userId: { eventId: event.id, userId: user.id } },
      select: { id: true },
    });
    if (enroll.outcome !== "already_active") {
      await attributeApplicationFromCookie({
        userId: user.id,
        clfEventId: event.id,
        eventMemberId: member?.id ?? null,
      });
    }

    const outcome =
      enroll.outcome === "already_active"
        ? "already_active"
        : enroll.outcome === "reactivated"
          ? "joined_active"
          : "joined_active";

    return NextResponse.json({
      success: true,
      outcome,
      alreadyMember: enroll.outcome === "already_active",
      message: "Te inscribiste correctamente al evento",
      albumId: enroll.albumId,
    });
  } catch (err: unknown) {
    console.error("POST /api/public/events/[shareSlug]/join ERROR >>>", err);
    return NextResponse.json(
      { error: "Error al inscribirse", detail: String(err instanceof Error ? err.message : err) },
      { status: 500 },
    );
  }
}
