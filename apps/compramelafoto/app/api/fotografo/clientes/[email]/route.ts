import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * PATCH /api/fotografo/clientes/[email]
 * Actualizar datos de un cliente (actualiza todos sus pedidos)
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { email: string } | Promise<{ email: string }> }
) {
  try {
    const { email } = await Promise.resolve(params);
    const decodedEmail = decodeURIComponent(email);
    const body = await req.json().catch(() => ({}));
    const { photographerId, name, phone } = body;

    if (!photographerId || !Number.isFinite(Number(photographerId))) {
      return NextResponse.json(
        { error: "photographerId es requerido" },
        { status: 400 }
      );
    }

    const id = Number(photographerId);

    // Actualizar todos los pedidos del cliente con este email
    const result = await prisma.printOrder.updateMany({
      where: {
        photographerId: id,
        customerEmail: decodedEmail,
      },
      data: {
        ...(name !== undefined && { customerName: name.trim() || null }),
        ...(phone !== undefined && { customerPhone: phone.trim() || null }),
      },
    });

    // También actualizar las notificaciones de álbum si existen
    const albums = await prisma.album.findMany({
      where: { userId: id },
      select: { id: true },
    });

    if (albums.length > 0) {
      await prisma.albumNotification.updateMany({
        where: {
          albumId: { in: albums.map((a) => a.id) },
          email: decodedEmail,
        },
        data: {
          ...(name !== undefined && { name: name.trim() || null }),
        },
      });
    }

    return NextResponse.json(
      { success: true, updated: result.count },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("PATCH /api/fotografo/clientes/[email] ERROR >>>", err);
    return NextResponse.json(
      { error: "Error actualizando cliente", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/fotografo/clientes/[email]
 * Eliminar registros de notificaciones de un cliente (solo elimina pedidos CANCELED con total 0)
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { email: string } | Promise<{ email: string }> }
) {
  try {
    const { email } = await Promise.resolve(params);
    const decodedEmail = decodeURIComponent(email);
    const body = await req.json().catch(() => ({}));
    const { photographerId } = body;

    if (!photographerId || !Number.isFinite(Number(photographerId))) {
      return NextResponse.json(
        { error: "photographerId es requerido" },
        { status: 400 }
      );
    }

    const id = Number(photographerId);

    // Eliminar solo pedidos CANCELED con total 0 (los "fantasma" creados para notificaciones)
    const deletedOrders = await prisma.printOrder.deleteMany({
      where: {
        photographerId: id,
        customerEmail: decodedEmail,
        status: "CANCELED",
        total: 0,
      },
    });

    // Eliminar notificaciones de álbum
    const albums = await prisma.album.findMany({
      where: { userId: id },
      select: { id: true },
    });

    let deletedNotifications = 0;
    if (albums.length > 0) {
      const result = await prisma.albumNotification.deleteMany({
        where: {
          albumId: { in: albums.map((a) => a.id) },
          email: decodedEmail,
        },
      });
      deletedNotifications = result.count;
    }

    return NextResponse.json(
      { 
        success: true, 
        deletedOrders: deletedOrders.count,
        deletedNotifications 
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("DELETE /api/fotografo/clientes/[email] ERROR >>>", err);
    return NextResponse.json(
      { error: "Error eliminando cliente", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
