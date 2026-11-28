import { NextRequest, NextResponse } from "next/server";
import { Prisma, Role } from "@prisma/client";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Bandeja de recibidos. `vista`: `entrada` (sin archivar, sin spam ni rebotes), `sin-leer`,
 * `archivados` o `otros` (spam, rebotes y respuestas automáticas).
 */
export async function GET(req: NextRequest) {
  const { error, user } = await requireAuth([Role.ADMIN]);
  if (error || !user) return NextResponse.json({ error: error || "No autorizado" }, { status: 401 });

  const sp = new URL(req.url).searchParams;
  const page = Math.max(1, Number(sp.get("page") || 1) || 1);
  const pageSize = Math.min(50, Math.max(10, Number(sp.get("pageSize") || 25) || 25));
  const vista = sp.get("vista") || "entrada";
  const q = (sp.get("q") || "").trim();

  const where: Prisma.ClfInboundEmailWhereInput = {};
  if (vista === "archivados") {
    where.archivedAt = { not: null };
  } else if (vista === "otros") {
    where.archivedAt = null;
    where.kind = { not: "NORMAL" };
  } else {
    where.archivedAt = null;
    where.kind = "NORMAL";
    if (vista === "sin-leer") where.readAt = null;
  }
  if (q) {
    where.OR = [
      { fromEmail: { contains: q, mode: "insensitive" } },
      { fromName: { contains: q, mode: "insensitive" } },
      { subject: { contains: q, mode: "insensitive" } },
      { text: { contains: q, mode: "insensitive" } },
    ];
  }

  const [items, total, sinLeer] = await Promise.all([
    prisma.clfInboundEmail.findMany({
      where,
      orderBy: { receivedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true, fromEmail: true, fromName: true, to: true, subject: true, text: true, kind: true,
        receivedAt: true, readAt: true, archivedAt: true, repliedAt: true, attachments: true,
      },
    }),
    prisma.clfInboundEmail.count({ where }),
    prisma.clfInboundEmail.count({ where: { archivedAt: null, kind: "NORMAL", readAt: null } }),
  ]);

  return NextResponse.json({
    items: items.map(({ text, attachments, ...r }) => ({
      ...r,
      preview: text.replace(/\s+/g, " ").trim().slice(0, 160),
      attachmentCount: Array.isArray(attachments) ? attachments.length : 0,
    })),
    total,
    page,
    pageSize,
    sinLeer,
  });
}
