/**
 * GET /api/admin/fraud-alerts
 * Lista alertas de fraude para el panel admin
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { Role } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { error, user } = await requireAuth([Role.ADMIN]);
    if (error || !user) {
      return NextResponse.json(
        { error: error || "No autorizado. Se requiere rol ADMIN." },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status")?.trim();
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = Math.min(parseInt(searchParams.get("pageSize") || "30"), 100);

    const where: { status?: string } = {};
    if (status && status !== "ALL") {
      where.status = status;
    }

    const skip = (page - 1) * pageSize;
    const total = await prisma.fraudAlert.count({ where });

    const alerts = await prisma.fraudAlert.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
    });

    // Enriquecer con datos de usuario y lab
    const alertsWithUser = await Promise.all(
      alerts.map(async (a) => {
        let userData = null;
        if (a.userId) {
          const u = await prisma.user.findUnique({
            where: { id: a.userId },
            select: { id: true, email: true, name: true },
          });
          userData = u;
        }
        let labData = null;
        if (a.labId) {
          const l = await prisma.lab.findUnique({
            where: { id: a.labId },
            select: { id: true, name: true },
          });
          labData = l;
        }
        return { ...a, user: userData, lab: labData };
      })
    );

    return NextResponse.json({
      alerts: alertsWithUser,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (err: unknown) {
    console.error("GET /api/admin/fraud-alerts ERROR >>>", err);
    return NextResponse.json(
      {
        error: "Error obteniendo alertas de fraude",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
