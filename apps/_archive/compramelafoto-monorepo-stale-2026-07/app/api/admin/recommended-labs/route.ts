/**
 * GET /api/admin/recommended-labs
 * Lista de laboratorios recomendados por fotógrafos (solo admin).
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { Role } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { error } = await requireAuth([Role.ADMIN]);
    if (error) {
      return NextResponse.json({ error: error || "No autorizado" }, { status: 401 });
    }

    const list = await prisma.labRecommendation.findMany({
      orderBy: { createdAt: "desc" },
      take: 500,
    });

    return NextResponse.json(list);
  } catch (err: any) {
    console.error("GET /api/admin/recommended-labs ERROR >>>", err);
    return NextResponse.json(
      { error: "Error listando recomendaciones", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
