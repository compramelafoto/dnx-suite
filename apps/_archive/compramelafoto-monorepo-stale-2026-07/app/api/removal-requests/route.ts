import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST: Crear solicitud de remoción (público, sin autenticación)
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    // Validar campos requeridos
    const { albumId, photoId, requesterName, requesterEmail, requesterPhone, reason, declarationOk } = body;

    if (!albumId || !Number.isFinite(Number(albumId))) {
      return NextResponse.json(
        { error: "albumId es requerido" },
        { status: 400 }
      );
    }

    if (!photoId || !Number.isFinite(Number(photoId))) {
      return NextResponse.json(
        { error: "photoId es requerido" },
        { status: 400 }
      );
    }

    if (!requesterName || typeof requesterName !== "string" || requesterName.trim().length < 2) {
      return NextResponse.json(
        { error: "El nombre es requerido (mínimo 2 caracteres)" },
        { status: 400 }
      );
    }

    if (!requesterEmail || typeof requesterEmail !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(requesterEmail)) {
      return NextResponse.json(
        { error: "El email es requerido y debe ser válido" },
        { status: 400 }
      );
    }

    if (!requesterPhone || typeof requesterPhone !== "string" || requesterPhone.trim().length < 8) {
      return NextResponse.json(
        { error: "El teléfono/WhatsApp es requerido (mínimo 8 caracteres)" },
        { status: 400 }
      );
    }

    if (!reason || typeof reason !== "string" || reason.trim().length < 10) {
      return NextResponse.json(
        { error: "El motivo es requerido (mínimo 10 caracteres)" },
        { status: 400 }
      );
    }

    if (declarationOk !== true) {
      return NextResponse.json(
        { error: "Debés confirmar que la solicitud es real y que sos la persona afectada o su representante" },
        { status: 400 }
      );
    }

    // Verificar que la foto existe y pertenece al álbum
    let photo: any;
    try {
      photo = await prisma.photo.findUnique({
        where: { id: Number(photoId) },
        select: {
          id: true,
          albumId: true,
          isRemoved: true,
          album: {
            select: {
              userId: true,
            },
          },
        },
      });
    } catch (err: any) {
      // Si falla por campo desconocido (isRemoved), intentar sin él
      if (err?.message?.includes("isRemoved") || err?.message?.includes("Unknown field")) {
        photo = await prisma.photo.findUnique({
          where: { id: Number(photoId) },
          select: {
            id: true,
            albumId: true,
            album: {
              select: {
                userId: true,
              },
            },
          },
        });
        // Asignar isRemoved como false si no existe
        if (photo) {
          photo.isRemoved = false;
        }
      } else {
        throw err;
      }
    }

    if (!photo) {
      return NextResponse.json(
        { error: "La foto no existe" },
        { status: 404 }
      );
    }

    if (photo.albumId !== Number(albumId)) {
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

    // Crear la solicitud
    // Verificar si el modelo RemovalRequest existe en Prisma Client
    const prismaAny = prisma as any;
    if (!prismaAny.removalRequest) {
      return NextResponse.json(
        { error: "La funcionalidad de solicitudes de remoción aún no está disponible. Por favor, ejecutá la migración de la base de datos: npx prisma migrate dev --name add_removal_requests && npx prisma generate" },
        { status: 503 }
      );
    }

    let request: any;
    try {
      request = await prismaAny.removalRequest.create({
        data: {
          albumId: Number(albumId),
          photoId: Number(photoId),
          photographerId: photo.album.userId,
          requesterName: requesterName.trim(),
          requesterEmail: requesterEmail.trim().toLowerCase(),
          requesterPhone: requesterPhone.trim(),
          reason: reason.trim(),
          declarationOk: true,
          status: "PENDING",
        },
        select: {
          id: true,
          createdAt: true,
        },
      });
    } catch (createError: any) {
      // Si el modelo RemovalRequest no existe aún, devolver error informativo
      if (createError?.message?.includes("Unknown model") || 
          createError?.message?.includes("removalRequest") ||
          createError?.message?.includes("Cannot read properties")) {
        return NextResponse.json(
          { error: "La funcionalidad de solicitudes de remoción aún no está disponible. Por favor, ejecutá la migración de la base de datos: npx prisma migrate dev --name add_removal_requests && npx prisma generate" },
          { status: 503 }
        );
      }
      throw createError;
    }

    return NextResponse.json(
      {
        success: true,
        message: "Recibimos tu solicitud. El fotógrafo la revisará.",
        requestId: request.id,
      },
      { status: 201 }
    );
  } catch (err: any) {
    console.error("POST /api/removal-requests ERROR >>>", err);
    return NextResponse.json(
      { error: "Error al procesar la solicitud", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
