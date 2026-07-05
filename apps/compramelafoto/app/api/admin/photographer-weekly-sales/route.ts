import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { Role } from "@prisma/client";
import { computePhotographerWeeklySales } from "@/lib/admin/photographer-weekly-sales";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { error, user } = await requireAuth([Role.ADMIN]);
    if (error || !user) {
      return NextResponse.json({ error: error || "No autorizado" }, { status: 401 });
    }

    const photographerId = Number(req.nextUrl.searchParams.get("photographerId"));
    if (!Number.isFinite(photographerId) || photographerId <= 0) {
      return NextResponse.json(
        { error: "photographerId inválido" },
        { status: 400 }
      );
    }

    const daysParam = Number(req.nextUrl.searchParams.get("days") ?? "90");
    const days = Number.isFinite(daysParam) && daysParam > 0 ? Math.min(daysParam, 365) : 90;

    const weeklySales = await computePhotographerWeeklySales(prisma, photographerId, days);

    return NextResponse.json({ photographerId, days, weeklySales });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    console.error("GET /api/admin/photographer-weekly-sales ERROR >>>", err);
    return NextResponse.json(
      { error: "Error obteniendo ventas semanales", detail: message },
      { status: 500 }
    );
  }
}
