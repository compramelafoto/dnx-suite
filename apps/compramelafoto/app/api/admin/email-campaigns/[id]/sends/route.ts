import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAuth([Role.ADMIN]);
  if (error) return NextResponse.json({ error: error || "No autorizado" }, { status: 401 });

  const id = parseInt((await params).id, 10);
  if (isNaN(id)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const perPage = Math.min(100, Math.max(10, parseInt(searchParams.get("perPage") ?? "50", 10)));

  const [sends, totals] = await Promise.all([
    prisma.emailSend.findMany({
      where: { campaignId: id },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.emailSend.groupBy({
      by: ["status"],
      where: { campaignId: id },
      _count: true,
    }),
  ]);

  const totalCount = await prisma.emailSend.count({ where: { campaignId: id } });
  const byStatus = Object.fromEntries(totals.map((t) => [t.status, t._count]));

  return NextResponse.json({
    sends,
    totalCount,
    byStatus,
    page,
    perPage,
  });
}
