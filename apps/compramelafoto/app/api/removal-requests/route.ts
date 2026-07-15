import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { sanitizeRemovalRequestBody } from "@/lib/public/removal-request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

/**
 * POST /api/removal-requests
 * Crea solicitud PENDING. No elimina fotos ni concede acceso.
 */
export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const rl = checkRateLimit({
      key: `removal:${ip}`,
      limit: 10,
      windowMs: 60 * 60 * 1000,
    });
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Demasiadas solicitudes. Intentá más tarde." },
        { status: 429 }
      );
    }

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const parsed = sanitizeRemovalRequestBody(body);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: parsed.status });
    }

    const data = parsed.data;

    const photo = await prisma.photo.findUnique({
      where: { id: data.photoId },
      select: {
        id: true,
        albumId: true,
        isRemoved: true,
        album: { select: { userId: true } },
      },
    });

    if (!photo) {
      return NextResponse.json({ error: "La foto no existe" }, { status: 404 });
    }

    if (photo.albumId !== data.albumId) {
      return NextResponse.json(
        { error: "La foto no pertenece a este álbum" },
        { status: 400 }
      );
    }

    if (photo.isRemoved) {
      return NextResponse.json(
        { error: "La foto ya no está disponible" },
        { status: 400 }
      );
    }

    const existing = await prisma.removalRequest.findFirst({
      where: {
        albumId: data.albumId,
        photoId: data.photoId,
        requesterEmail: data.requesterEmail,
        status: "PENDING",
      },
      select: { id: true, createdAt: true },
    });

    if (existing) {
      return NextResponse.json(
        {
          success: true,
          message: "Ya tenemos una solicitud pendiente para esta foto.",
          requestId: existing.id,
          duplicate: true,
        },
        { status: 200 }
      );
    }

    const request = await prisma.removalRequest.create({
      data: {
        albumId: data.albumId,
        photoId: data.photoId,
        photographerId: photo.album.userId,
        requesterName: data.requesterName,
        requesterEmail: data.requesterEmail,
        requesterPhone: data.requesterPhone,
        reason: data.reason,
        declarationOk: true,
        status: "PENDING",
      },
      select: { id: true, createdAt: true },
    });

    return NextResponse.json(
      {
        success: true,
        message: "Recibimos tu solicitud. El fotógrafo la revisará.",
        requestId: request.id,
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    console.error("POST /api/removal-requests ERROR >>>", err);
    return NextResponse.json(
      { error: "Error al procesar la solicitud" },
      { status: 500 }
    );
  }
}
