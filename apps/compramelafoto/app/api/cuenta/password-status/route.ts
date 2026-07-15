import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildPasswordStatus } from "@/lib/cuenta/password-status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/cuenta/password-status
 * Indica si el usuario puede cambiar contraseña local o solo usa Google.
 * No expone hash ni googleId.
 */
export async function GET() {
  try {
    const { error, user } = await requireAuth();
    if (error || !user) {
      return NextResponse.json(
        { error: error || "No autorizado" },
        { status: 401 }
      );
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { password: true, googleId: true },
    });

    if (!dbUser) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }

    return NextResponse.json(buildPasswordStatus(dbUser));
  } catch (err: unknown) {
    console.error("GET /api/cuenta/password-status ERROR >>>", err);
    return NextResponse.json(
      { error: "Error al verificar la cuenta" },
      { status: 500 }
    );
  }
}
