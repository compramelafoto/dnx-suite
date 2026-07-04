import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  const { error, user } = await requireAuth([Role.ADMIN]);
  if (error || !user) {
    return NextResponse.json({ error: error || "No autorizado" }, { status: 401 });
  }

  const { id } = await Promise.resolve(params);
  const messageId = Number(id);
  if (!Number.isFinite(messageId)) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const isRead = body.isRead === true;

  const updated = await prisma.adminSystemMessage.update({
    where: { id: messageId },
    data: { isRead },
  });

  return NextResponse.json({ item: updated });
}
