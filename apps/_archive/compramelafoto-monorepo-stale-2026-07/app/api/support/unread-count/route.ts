import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET: Cantidad de notificaciones de soporte sin leer (respuestas a incidencias) */
export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ count: 0 });
    }

    const count = await prisma.dashboardNotification.count({
      where: {
        userId: user.id,
        type: "SUPPORT_REPLY",
        readAt: null,
      },
    });

    return NextResponse.json({ count });
  } catch (err: unknown) {
    console.error("GET /api/support/unread-count ERROR >>>", err);
    return NextResponse.json({ count: 0 });
  }
}
