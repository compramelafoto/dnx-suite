import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST: Marcar notificaciones de soporte como leídas */
export async function POST() {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    await prisma.dashboardNotification.updateMany({
      where: {
        userId: user.id,
        type: "SUPPORT_REPLY",
        readAt: null,
      },
      data: { readAt: new Date() },
    });

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    console.error("POST /api/support/mark-read ERROR >>>", err);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}
