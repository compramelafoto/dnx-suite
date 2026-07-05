import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { Role } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET: Obtener todos los mensajes de contacto
export async function GET(req: Request) {
  try {
    const { error, user } = await requireAuth([Role.ADMIN]);
    if (error || !user) {
      return NextResponse.json(
        { error: error || "No autorizado. Se requiere rol ADMIN." },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const isRead = searchParams.get("isRead");
    const limit = parseInt(searchParams.get("limit") || "100");
    const offset = parseInt(searchParams.get("offset") || "0");

    const where: any = {};
    if (isRead !== null) {
      where.isRead = isRead === "true";
    }

    // Verificar si el modelo existe antes de usarlo
    if (!prisma.contactMessage) {
      console.error("ERROR: prisma.contactMessage no está disponible. Ejecutá: npx prisma generate");
      return NextResponse.json(
        { 
          error: "Modelo ContactMessage no disponible", 
          detail: "Ejecutá: npx prisma generate && npx prisma db push",
          messages: [],
          total: 0,
          unread: 0,
        },
        { status: 500 }
      );
    }

    let messages: any[] = [];
    let total = 0;
    let unread = 0;

    try {
      [messages, total] = await Promise.all([
        prisma.contactMessage.findMany({
          where,
          include: {
            photographer: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
          orderBy: {
            createdAt: "desc",
          },
          take: limit,
          skip: offset,
        }),
        prisma.contactMessage.count({ where }),
      ]);

      unread = await prisma.contactMessage.count({ where: { isRead: false } });
    } catch (dbErr: any) {
      // Si la tabla no existe, devolver array vacío con mensaje informativo
      if (dbErr?.code === "P2021" || dbErr?.code === "P2022" || dbErr?.message?.includes("does not exist") || dbErr?.message?.includes("Unknown table")) {
        console.error("La tabla ContactMessage no existe en la base de datos. Ejecutá: npx prisma db push");
        return NextResponse.json(
          {
            messages: [],
            total: 0,
            unread: 0,
            warning: "La tabla ContactMessage no existe. Ejecutá: npx prisma db push",
          },
          { status: 200 }
        );
      }
      throw dbErr;
    }

    return NextResponse.json(
      {
        messages,
        total,
        unread,
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("GET /api/admin/contact-messages ERROR >>>", err);
    return NextResponse.json(
      { 
        error: "Error obteniendo mensajes", 
        detail: String(err?.message ?? err),
        messages: [],
        total: 0,
        unread: 0,
      },
      { status: 500 }
    );
  }
}

// PATCH: Marcar mensaje como leído
export async function PATCH(req: Request) {
  try {
    const { error, user } = await requireAuth([Role.ADMIN]);
    if (error || !user) {
      return NextResponse.json(
        { error: error || "No autorizado. Se requiere rol ADMIN." },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const id = body.id ? Number(body.id) : null;
    const isRead = body.isRead !== undefined ? Boolean(body.isRead) : true;

    if (!id || !Number.isFinite(id)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    const message = await prisma.contactMessage.update({
      where: { id },
      data: {
        isRead,
        readAt: isRead ? new Date() : null,
      },
    });

    return NextResponse.json({ success: true, message }, { status: 200 });
  } catch (err: any) {
    console.error("PATCH /api/admin/contact-messages ERROR >>>", err);
    return NextResponse.json(
      { error: "Error actualizando mensaje", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}

// DELETE: Eliminar mensaje
export async function DELETE(req: Request) {
  try {
    const { error, user } = await requireAuth([Role.ADMIN]);
    if (error || !user) {
      return NextResponse.json(
        { error: error || "No autorizado. Se requiere rol ADMIN." },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const messageId = id ? Number(id) : null;

    if (!messageId || !Number.isFinite(messageId)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    await prisma.contactMessage.delete({
      where: { id: messageId },
    });

    return NextResponse.json({ success: true, message: "Mensaje eliminado correctamente" }, { status: 200 });
  } catch (err: any) {
    console.error("DELETE /api/admin/contact-messages ERROR >>>", err);
    
    if (err?.code === "P2025") {
      // El mensaje ya no existe
      return NextResponse.json(
        { error: "El mensaje no existe o ya fue eliminado" },
        { status: 404 }
      );
    }
    
    return NextResponse.json(
      { error: "Error eliminando mensaje", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
