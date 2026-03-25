import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { claimOrdersForVerifiedUser } from "@/lib/order-claims";
import { prisma } from "@/lib/prisma";

const AUTH_ME_TIMEOUT_MS = 5000;

/**
 * GET /api/auth/me
 *
 * Obtiene el usuario autenticado actual desde las cookies.
 * Timeout para no colgar si la DB o cookies() tardan.
 */
export async function GET() {
  try {
    const user = await Promise.race([
      getAuthUser(),
      new Promise<null>((_, reject) =>
        setTimeout(() => reject(new Error("auth/me timeout")), AUTH_ME_TIMEOUT_MS)
      ),
    ]);

    if (!user) {
      return NextResponse.json({ user: null }, { status: 200 });
    }

    // Reclamar pedidos pendientes en segundo plano (no bloquear la respuesta)
    if (user.emailVerifiedAt && user.email) {
      claimOrdersForVerifiedUser({
        userId: user.id,
        email: user.email,
      }).catch((err) => console.warn("claimOrders error:", err));
    }

    const extra = await prisma.user.findUnique({
      where: { id: user.id },
      select: { faceConsent: true },
    });

    return NextResponse.json({
      user: { ...user, faceConsent: extra?.faceConsent ?? false },
    });
  } catch (error: any) {
    if (error?.message === "auth/me timeout") {
      console.warn("GET /api/auth/me: timeout");
    } else {
      console.error("Error obteniendo usuario:", error);
    }
    return NextResponse.json({ user: null }, { status: 200 });
  }
}
