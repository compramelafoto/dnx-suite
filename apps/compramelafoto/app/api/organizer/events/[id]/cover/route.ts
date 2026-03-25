import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { uploadToR2, generateR2Key, getR2PublicUrl } from "@/lib/r2-client";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

/**
 * POST /api/organizer/events/[id]/cover
 * Sube la imagen de portada del evento (solo organizador dueño del evento).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  try {
    const { error, user } = await requireAuth([Role.ORGANIZER]);
    if (error || !user) {
      return NextResponse.json({ error: error || "No autorizado" }, { status: 401 });
    }
    const { id } = await Promise.resolve(params);
    const eventId = parseInt(id, 10);
    if (!Number.isFinite(eventId)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    const event = await prisma.event.findFirst({
      where: { id: eventId, creatorId: user.id },
    });
    if (!event) {
      return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No se envió ningún archivo" }, { status: 400 });
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Solo se permiten imágenes JPG, PNG o WebP" },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const key = generateR2Key(`cover_${file.name}`, `event-covers/${eventId}`);
    const contentType = file.type || "image/jpeg";
    await uploadToR2(buffer, key, contentType, { type: "event_cover", eventId: String(eventId) });

    await prisma.event.update({
      where: { id: eventId },
      data: { coverImageKey: key },
    });

    const coverUrl = getR2PublicUrl(key);
    return NextResponse.json({ coverImageKey: key, coverUrl });
  } catch (e: any) {
    console.error("POST /api/organizer/events/[id]/cover", e);
    return NextResponse.json(
      { error: "Error subiendo portada", detail: e?.message },
      { status: 500 }
    );
  }
}
