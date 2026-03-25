import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAlbumComplete, isAlbumPubliclyAccessible } from "@/lib/album-helpers";
import { getAuthUser } from "@/lib/auth";

/**
 * POST /api/a/[id]/notifications
 * Suscribir email a notificaciones del álbum (cuando se suben fotos, recordatorios antes de eliminación)
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  try {
    const { id } = await Promise.resolve(params);
    const albumId = parseInt(id, 10);
    if (!Number.isFinite(albumId)) {
      return NextResponse.json({ error: "ID de álbum inválido" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const { name, lastName, whatsapp, email } = body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "Nombre es requerido" }, { status: 400 });
    }

    if (!whatsapp || typeof whatsapp !== "string" || !whatsapp.trim()) {
      return NextResponse.json({ error: "WhatsApp es requerido" }, { status: 400 });
    }

    if (!email || typeof email !== "string" || !email.trim()) {
      return NextResponse.json({ error: "Email es requerido" }, { status: 400 });
    }

    const normalizedName = name.trim();
    const normalizedLastName = lastName ? lastName.trim() : "";
    const normalizedWhatsapp = whatsapp.trim();
    const normalizedEmail = email.trim().toLowerCase();

    // Validar formato básico de email
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return NextResponse.json({ error: "Email inválido" }, { status: 400 });
    }

    const finalEmail = normalizedEmail;

    // Verificar que el álbum existe y obtener userId del fotógrafo
    const album = await prisma.album.findUnique({
      where: { id: albumId },
      select: {
        id: true,
        userId: true,
        isHidden: true,
        isPublic: true,
        enablePrintedPhotos: true,
        enableDigitalPhotos: true,
        selectedLabId: true,
        albumProfitMarginPercent: true,
        pickupBy: true,
        digitalPhotoPriceCents: true,
        termsAcceptedAt: true,
        termsVersion: true,
      },
    });

    if (!album) {
      return NextResponse.json({ error: "Álbum no encontrado" }, { status: 404 });
    }

    if (!isAlbumComplete(album)) {
      return NextResponse.json({ error: "Álbum no disponible" }, { status: 404 });
    }

    if (!isAlbumPubliclyAccessible(album)) {
      const authUser = await getAuthUser();
      const isOwner = authUser?.id === album.userId;
      const hasAccess = authUser
        ? await prisma.albumAccess.findUnique({
            where: { albumId_userId: { albumId, userId: authUser.id } },
          })
        : null;
      if (!isOwner && !hasAccess) {
        return NextResponse.json({ error: "Álbum no disponible" }, { status: 404 });
      }
    }

    // Crear o actualizar notificación (upsert por albumId + email único)
    try {
      await prisma.albumNotification.upsert({
        where: {
          albumId_email: {
            albumId,
            email: finalEmail,
          },
        },
        update: {
          // Si ya existe, actualizar los datos
          name: normalizedName,
          lastName: normalizedLastName,
          whatsapp: normalizedWhatsapp,
          email: finalEmail,
        },
        create: {
          albumId,
          name: normalizedName,
          lastName: normalizedLastName,
          whatsapp: normalizedWhatsapp,
          email: finalEmail,
          notifiedWhenReady: false,
          notifiedAt3Weeks: false,
          notifiedAt2Weeks: false,
          notifiedAt1Week: false,
        },
      });
    } catch (notifErr: any) {
      // Si falla por campos desconocidos, intentar con campos básicos
      const errorMsg = String(notifErr?.message ?? "");
      if (errorMsg.includes("lastName") || errorMsg.includes("whatsapp") || errorMsg.includes("name") || errorMsg.includes("Unknown field")) {
        await prisma.albumNotification.upsert({
          where: {
            albumId_email: {
              albumId,
              email: finalEmail,
            },
          },
          update: {
            name: normalizedName,
          },
          create: {
            albumId,
            name: normalizedName,
            email: finalEmail,
            notifiedWhenReady: false,
            notifiedAt3Weeks: false,
            notifiedAt2Weeks: false,
            notifiedAt1Week: false,
          },
        });
      } else {
        throw notifErr;
      }
    }

    // Crear o actualizar interés para emails de recordatorio
    try {
      const now = new Date();
      await prisma.albumInterest.upsert({
        where: {
          albumId_email: {
            albumId,
            email: finalEmail,
          },
        },
        update: {
          name: normalizedName,
          firstName: normalizedName,
          lastName: normalizedLastName,
          whatsapp: normalizedWhatsapp,
          email: finalEmail,
          nextEmailAt: now,
        },
        create: {
          albumId,
          name: normalizedName,
          firstName: normalizedName,
          lastName: normalizedLastName,
          whatsapp: normalizedWhatsapp,
          email: finalEmail,
          nextEmailAt: now,
        },
      });
    } catch (interestErr: any) {
      console.warn("Error guardando interés de álbum:", interestErr);
    }

    // Crear un PrintOrder "fantasma" (CANCELED, total 0) para que el cliente aparezca en la lista del fotógrafo
    try {
      // Verificar si ya existe un PrintOrder con este email para este fotógrafo
      const existingOrder = await prisma.printOrder.findFirst({
        where: {
          photographerId: album.userId,
          customerEmail: normalizedEmail,
        },
        select: { id: true },
      });

      // Si no existe, crear uno "fantasma" para tener el cliente registrado
      if (!existingOrder) {
        await prisma.printOrder.create({
          data: {
            labId: 1, // Lab por defecto
            photographerId: album.userId,
            customerName: `${normalizedName} ${normalizedLastName}`.trim(),
            customerEmail: finalEmail,
            status: "CANCELED",
            total: 0,
            currency: "ARS",
          },
        });
      } else {
        // Si existe, actualizar el nombre si no tenía uno o si es diferente
        await prisma.printOrder.updateMany({
          where: {
            id: existingOrder.id,
            OR: [
              { customerName: null },
              { customerName: { not: `${normalizedName} ${normalizedLastName}`.trim() } },
            ],
          },
          data: {
            customerName: `${normalizedName} ${normalizedLastName}`.trim(),
          },
        });
      }
    } catch (clientErr: any) {
      // Si falla, solo loguear (no es crítico)
      console.warn("Error creando registro de cliente:", clientErr);
    }

    return NextResponse.json(
      { success: true, message: "Te notificaremos cuando las fotos estén disponibles" },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("POST /api/a/[id]/notifications ERROR >>>", err);
    return NextResponse.json(
      { error: "Error suscribiendo notificación", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
