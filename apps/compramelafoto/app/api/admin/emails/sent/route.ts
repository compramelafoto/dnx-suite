import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { Role } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { error, user } = await requireAuth([Role.ADMIN]);
  if (error || !user) {
    return NextResponse.json({ error: error || "No autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get("page") || 1));
  const pageSize = Math.min(50, Math.max(10, Number(searchParams.get("pageSize") || 20)));
  const templateKey = searchParams.get("templateKey") || "";
  const to = searchParams.get("to") || "";

  const where: any = {};
  if (templateKey) where.templateKey = templateKey;
  if (to) where.to = { contains: to, mode: "insensitive" };

  const [items, total] = await Promise.all([
    prisma.sentEmailLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.sentEmailLog.count({ where }),
  ]);

  return NextResponse.json({ items, total, page, pageSize });
}
