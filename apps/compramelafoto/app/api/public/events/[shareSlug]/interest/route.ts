import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  canAccessEventByShareSlug,
  sanitizeEventInterestPayload,
} from "@/lib/public/public-events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return req.headers.get("x-real-ip") ?? "unknown";
}

/**
 * POST /api/public/events/[shareSlug]/interest
 * Captación de interesados (galería). Upsert por email; no lista interesados.
 * Distinto de join/leave (inscripción de fotógrafos autenticados).
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
      key: `event-interest:${shareSlug}:${ip}`,
      limit: 20,
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

    const body = await req.json().catch(() => ({}));
    const parsed = sanitizeEventInterestPayload(body);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: parsed.status });
    }

    await prisma.eventInterest.upsert({
      where: {
        eventId_email: {
          eventId: event.id,
          email: parsed.email,
        },
      },
      update: {
        name: parsed.name,
        lastName: parsed.lastName,
        whatsapp: parsed.whatsapp,
      },
      create: {
        eventId: event.id,
        email: parsed.email,
        name: parsed.name,
        lastName: parsed.lastName,
        whatsapp: parsed.whatsapp,
      },
    });

    return NextResponse.json({
      success: true,
      message: "¡Listo! Te avisaremos cuando la galería esté disponible.",
    });
  } catch (err: unknown) {
    console.error("POST /api/public/events/[shareSlug]/interest ERROR >>>", err);
    return NextResponse.json(
      { error: "Error guardando interés" },
      { status: 500 }
    );
  }
}
