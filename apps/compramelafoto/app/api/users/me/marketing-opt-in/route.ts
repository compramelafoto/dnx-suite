import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { randomBytes } from "crypto";

export const dynamic = "force-dynamic";

function getClientIp(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
}

/**
 * PATCH /api/users/me/marketing-opt-in
 * Actualiza la preferencia de marketing del usuario autenticado.
 * Body: { marketingOptIn: boolean }
 */
export async function PATCH(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const marketingOptIn = !!body.marketingOptIn;
    const ip = getClientIp(req);
    const source = (body.source ?? "profile").toString().slice(0, 50);

    const updateData: Record<string, unknown> = {
      marketingOptIn,
    };

    if (marketingOptIn) {
      updateData.marketingOptInAt = new Date();
      updateData.marketingOptInIp = ip;
      updateData.marketingOptInSource = source;
      updateData.unsubscribedAt = null; // Limpiar baja si vuelve a opt-in
      // Generar token si no tiene (para link unsubscribe en emails)
      const existing = await prisma.user.findUnique({
        where: { id: user.id },
        select: { unsubscribeToken: true },
      });
      if (!existing?.unsubscribeToken) {
        updateData.unsubscribeToken = randomBytes(24).toString("hex");
      }
    } else {
      updateData.unsubscribedAt = new Date();
    }

    await prisma.user.update({
      where: { id: user.id },
      data: updateData as any,
    });

    return NextResponse.json({ success: true, marketingOptIn });
  } catch (err: any) {
    console.error("PATCH /api/users/me/marketing-opt-in ERROR >>>", err);
    return NextResponse.json(
      { error: "Error al actualizar preferencias", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
