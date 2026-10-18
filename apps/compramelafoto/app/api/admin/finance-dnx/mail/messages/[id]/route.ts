import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, user } = await requireAuth([Role.ADMIN]);
  if (error || !user) return NextResponse.json({ error: error || "No autorizado." }, { status: 401 });
  const id = Number((await params).id);
  const body = (await req.json().catch(() => ({}))) as { status?: unknown };
  if (!Number.isInteger(id) || body.status !== "DESCARTADO") {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }
  const r = await prisma.expenseMailMessage.updateMany({
    where: { id, status: "PARA_REVISAR" },
    data: { status: "DESCARTADO" },
  });
  if (r.count === 0) return NextResponse.json({ error: "El mail ya no está para revisar." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
