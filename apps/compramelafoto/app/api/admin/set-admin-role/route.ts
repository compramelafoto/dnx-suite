import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Endpoint temporal para establecer rol ADMIN
// IMPORTANTE: Eliminar este endpoint después de usarlo por seguridad
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = body.email || "cuart.daniel@gmail.com";
    
    // Buscar el usuario
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, name: true, role: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: `Usuario con email ${email} no encontrado` },
        { status: 404 }
      );
    }

    if (user.role === Role.ADMIN) {
      return NextResponse.json({
        success: true,
        message: "El usuario ya tiene rol ADMIN",
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
      });
    }

    // Actualizar el rol a ADMIN
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { role: Role.ADMIN },
      select: { id: true, email: true, name: true, role: true },
    });

    return NextResponse.json({
      success: true,
      message: "Rol actualizado exitosamente a ADMIN",
      user: updated,
      warning: "IMPORTANTE: Cerrá sesión y volvé a iniciar sesión para que los cambios surtan efecto.",
    });
  } catch (error: any) {
    console.error("POST /api/admin/set-admin-role ERROR >>>", error);
    return NextResponse.json(
      { error: "Error actualizando rol", detail: String(error?.message ?? error) },
      { status: 500 }
    );
  }
}
