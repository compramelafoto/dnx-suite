import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  requestAlbumExtension,
  resolveAlbumExtensionRequesterRole,
} from "@/lib/album-extensions/request-album-extension";
import { resolveEventGalleryPublicState } from "@/lib/events/resolve-event-gallery-public-state";
import { canAccessEventByShareSlug } from "@/lib/public/public-events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function clientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return req.headers.get("x-real-ip") ?? "unknown";
}

/**
 * POST /api/public/events/[shareSlug]/reactivation-request
 * Solicita reactivación de galerías ocultas/reactivables del evento.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ shareSlug: string }> }
) {
  try {
    const { shareSlug } = await Promise.resolve(params);
    if (!shareSlug || typeof shareSlug !== "string") {
      return NextResponse.json({ error: "Slug inválido" }, { status: 400 });
    }

    const ip = clientIp(req);
    const rate = checkRateLimit({
      key: `event-reactivation:${shareSlug}:${ip}`,
      limit: 5,
      windowMs: 60 * 60 * 1000,
    });
    if (!rate.allowed) {
      return NextResponse.json(
        { error: "Demasiadas solicitudes. Intentá nuevamente más tarde." },
        { status: 429 }
      );
    }

    const event = await prisma.event.findUnique({
      where: { shareSlug },
      select: { id: true, visibility: true, archivedAt: true },
    });
    if (!event || !canAccessEventByShareSlug(event)) {
      return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });
    }

    const galleryState = await resolveEventGalleryPublicState({
      eventId: event.id,
      availablePhotosCount: 0,
    });

    if (galleryState.state !== "EXPIRED_REACTIVABLE") {
      return NextResponse.json(
        {
          error:
            galleryState.state === "EMPTY_NEW"
              ? "Este evento todavía no tiene galerías para reactivar."
              : "Las galerías de este evento no pueden solicitarse para reactivación en este momento.",
        },
        { status: 400 }
      );
    }

    const albumIds = galleryState.reactivatableAlbums.map((a) => a.id);
    if (albumIds.length === 0) {
      return NextResponse.json(
        { error: "No hay galerías reactivables para este evento." },
        { status: 400 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const requesterName = String(body?.requesterName ?? "").trim();
    const requesterEmail = String(body?.requesterEmail ?? "").trim().toLowerCase();
    const requesterPhone = String(body?.requesterPhone ?? "").trim();
    const message = String(body?.message ?? "").trim();

    if (requesterEmail && !EMAIL_RE.test(requesterEmail)) {
      return NextResponse.json({ error: "Email inválido" }, { status: 400 });
    }

    if (requesterEmail) {
      const nameParts = requesterName.split(/\s+/).filter(Boolean);
      const firstName = nameParts[0] ?? (requesterName || null);
      const lastName =
        nameParts.length > 1 ? nameParts.slice(1).join(" ") : null;
      try {
        await prisma.eventInterest.upsert({
          where: {
            eventId_email: {
              eventId: event.id,
              email: requesterEmail,
            },
          },
          update: {
            name: firstName,
            lastName,
            whatsapp: requesterPhone || null,
          },
          create: {
            eventId: event.id,
            email: requesterEmail,
            name: firstName,
            lastName,
            whatsapp: requesterPhone || null,
          },
        });
      } catch (interestErr) {
        console.warn("No se pudo guardar contacto de reactivación:", interestErr);
      }
    }

    if (message) {
      console.info(
        `[event-reactivation-request] eventId=${event.id} shareSlug=${shareSlug} message=${message.slice(0, 500)}`
      );
    }

    const authUser = await getAuthUser();
    const { requestedByRole, requestedByUserId } =
      resolveAlbumExtensionRequesterRole(authUser);

    const failures: string[] = [];
    let requestedAlbumsCount = 0;

    for (const albumId of albumIds) {
      try {
        await requestAlbumExtension({
          albumId,
          daysToAdd: 30,
          requestedByRole,
          requestedByUserId,
        });
        requestedAlbumsCount += 1;
      } catch (albumErr: unknown) {
        failures.push(
          `${albumId}: ${String((albumErr as Error)?.message ?? albumErr)}`
        );
      }
    }

    if (requestedAlbumsCount === 0) {
      return NextResponse.json(
        { error: "No se pudo procesar la solicitud de reactivación." },
        { status: 500 }
      );
    }

    if (failures.length > 0) {
      console.warn(
        `[event-reactivation-request] eventId=${event.id} partial failures:`,
        failures.join("; ")
      );
    }

    return NextResponse.json({
      ok: true,
      requestedAlbumsCount,
    });
  } catch (err: unknown) {
    console.error(
      "POST /api/public/events/[shareSlug]/reactivation-request ERROR >>>",
      err
    );
    return NextResponse.json(
      { error: "Error procesando la solicitud" },
      { status: 500 }
    );
  }
}
