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
    const action = searchParams.get("action")?.trim();
    const entityType = searchParams.get("entityType")?.trim();
    const actorId = searchParams.get("actorId")?.trim();
    const search = searchParams.get("search")?.trim();
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = Math.min(parseInt(searchParams.get("pageSize") || "50"), 100);
    const fromDate = searchParams.get("fromDate")?.trim();
    const toDate = searchParams.get("toDate")?.trim();

    const andConditions: any[] = [];

    if (action) {
      andConditions.push({ action: { contains: action, mode: "insensitive" } });
    }
    if (entityType) {
      andConditions.push({ entity: { contains: entityType, mode: "insensitive" } });
    }
    if (actorId && /^\d+$/.test(actorId)) {
      andConditions.push({ actorId: parseInt(actorId) });
    }
    if (fromDate || toDate) {
      const createdAt: any = {};
      if (fromDate) createdAt.gte = new Date(fromDate);
      if (toDate) createdAt.lte = new Date(toDate);
      andConditions.push({ createdAt });
    }
    if (search) {
      andConditions.push({
        OR: [
          { description: { contains: search, mode: "insensitive" } },
          { entity: { contains: search, mode: "insensitive" } },
          { action: { contains: search, mode: "insensitive" } },
          { actor: { name: { contains: search, mode: "insensitive" } } },
          { actor: { email: { contains: search, mode: "insensitive" } } },
        ],
      });
    }

    const where = andConditions.length ? { AND: andConditions } : {};

    const skip = (page - 1) * pageSize;
    const total = await prisma.adminLog.count({ where });

    const logs = await prisma.adminLog.findMany({
      where,
      include: {
        actor: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
    });

    return NextResponse.json({
      logs,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (err: any) {
    console.error("GET /api/admin/audit ERROR >>>", err);
    return NextResponse.json(
      { error: "Error obteniendo auditoría", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
