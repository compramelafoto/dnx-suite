import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { claimOrdersForVerifiedUser } from "@/lib/order-claims";
import { prisma } from "@/lib/prisma";
import { randomUUID } from "crypto";

const AUTH_ME_TIMEOUT_MS = 5000;

/**
 * GET /api/auth/me
 *
 * Obtiene el usuario autenticado actual desde las cookies.
 * Timeout para no colgar si la DB o cookies() tardan.
 */
export async function GET() {
  const requestId = randomUUID();
  const startedAt = Date.now();
  console.log("[auth_timing] auth_me_start", { requestId, ts: startedAt });
  try {
    const sessionValidationStart = Date.now();
    console.log("[auth_timing] auth_me_stage", {
      requestId,
      stage: "session_validation_start",
      durationMs: Date.now() - startedAt,
    });
    const user = await Promise.race([
      getAuthUser(),
      new Promise<null>((_, reject) =>
        setTimeout(() => reject(new Error("auth/me timeout")), AUTH_ME_TIMEOUT_MS)
      ),
    ]);
    console.log("[auth_timing] auth_me_stage", {
      requestId,
      stage: "session_validation_done",
      durationMs: Date.now() - sessionValidationStart,
      hasUser: Boolean(user),
    });

    if (!user) {
      console.log("[auth_timing] auth_me_done", {
        requestId,
        durationMs: Date.now() - startedAt,
        hasUser: false,
      });
      return NextResponse.json({ user: null }, { status: 200 });
    }

    // Reclamar pedidos pendientes en segundo plano (no bloquear la respuesta)
    if (user.emailVerifiedAt && user.email) {
      claimOrdersForVerifiedUser({
        userId: user.id,
        email: user.email,
      }).catch((err) => console.warn("claimOrders error:", err));
    }

    const userQueryStart = Date.now();
    const extra = await prisma.user.findUnique({
      where: { id: user.id },
      select: { faceConsent: true },
    });
    console.log("[auth_timing] auth_me_stage", {
      requestId,
      stage: "user_query_done",
      durationMs: Date.now() - userQueryStart,
      userId: user.id,
    });

    console.log("[auth_timing] auth_me_done", {
      requestId,
      durationMs: Date.now() - startedAt,
      hasUser: true,
      userId: user.id,
    });
    return NextResponse.json({
      user: { ...user, faceConsent: extra?.faceConsent ?? false },
    });
  } catch (error: any) {
    console.error("[auth_timing] auth_me_error", {
      requestId,
      durationMs: Date.now() - startedAt,
      error: String(error?.message ?? error),
    });
    if (error?.message === "auth/me timeout") {
      console.warn("GET /api/auth/me: timeout");
    } else {
      console.error("Error obteniendo usuario:", error);
    }
    return NextResponse.json({ user: null }, { status: 200 });
  }
}
