import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Quienes pueden abrir el diseñador: a ellos se les puede asignar una plantilla. */
const DESIGNER_ROLES = [Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER, Role.ADMIN];

/** GET /api/admin/template-v2/photographers?q= — destinatarios posibles al mover o copiar. */
export async function GET(req: Request) {
  const { error } = await requireAuth([Role.ADMIN]);
  if (error) {
    return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
  }

  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) {
    return NextResponse.json({ ok: true, users: [] });
  }

  const asId = Number(q);
  const users = await prisma.user.findMany({
    where: {
      role: { in: DESIGNER_ROLES },
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
        ...(Number.isInteger(asId) && asId > 0 ? [{ id: asId }] : []),
      ],
    },
    orderBy: { name: "asc" },
    take: 20,
    select: { id: true, name: true, email: true, role: true },
  });

  return NextResponse.json({ ok: true, users });
}
