import { NextRequest, NextResponse } from "next/server";
import { prisma, Role } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Bootstrap de rol ADMIN — solo staging explícito.
 * - Requiere ENABLE_STAGING_ADMIN_BOOTSTRAP=true
 * - Requiere sesión autenticada
 * - Solo puede elevar el propio usuario (no emails ajenos)
 * - No hardcodea emails personales
 */
export async function POST(_req: NextRequest) {
  if (process.env.ENABLE_STAGING_ADMIN_BOOTSTRAP !== "true") {
    return NextResponse.json({ error: "No disponible" }, { status: 404 });
  }

  try {
    const authUser = await getAuthUser();
    if (!authUser?.email) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: authUser.id },
      select: { id: true, email: true, name: true, role: true },
    });

    if (!user) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }

    if (user.role === Role.ADMIN) {
      return NextResponse.json({
        success: true,
        message: "El usuario ya tiene rol ADMIN",
        user,
      });
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { role: Role.ADMIN },
      select: { id: true, email: true, name: true, role: true },
    });

    return NextResponse.json({
      success: true,
      message: "Rol actualizado a ADMIN. Cerrá sesión y volvé a iniciar sesión.",
      user: updated,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("POST /api/admin/set-admin-role ERROR >>>", message);
    return NextResponse.json(
      { error: "Error actualizando rol", detail: message },
      { status: 500 },
    );
  }
}
