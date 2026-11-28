import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function leerId(params: Promise<{ id: string }>): Promise<number | null> {
  const n = Number((await params).id);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/** El correo completo, la conversación con esa persona y las respuestas. Al abrirlo queda leído. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, user } = await requireAuth([Role.ADMIN]);
  if (error || !user) return NextResponse.json({ error: error || "No autorizado" }, { status: 401 });
  const id = await leerId(params);
  if (!id) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  const correo = await prisma.clfInboundEmail.findUnique({
    where: { id },
    include: { replies: { orderBy: { createdAt: "asc" } } },
  });
  if (!correo) return NextResponse.json({ error: "No existe" }, { status: 404 });
  if (!correo.readAt) {
    correo.readAt = new Date();
    await prisma.clfInboundEmail.update({ where: { id }, data: { readAt: correo.readAt } });
  }

  // Lo anterior de la misma persona: para ver el contexto sin salir del correo.
  const anteriores = await prisma.clfInboundEmail.findMany({
    where: { fromEmail: correo.fromEmail, id: { not: id } },
    orderBy: { receivedAt: "desc" },
    take: 20,
    select: { id: true, subject: true, receivedAt: true, repliedAt: true, archivedAt: true },
  });

  return NextResponse.json({ item: correo, anteriores });
}

/** `{ leido?: boolean, archivado?: boolean }` */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, user } = await requireAuth([Role.ADMIN]);
  if (error || !user) return NextResponse.json({ error: error || "No autorizado" }, { status: 401 });
  const id = await leerId(params);
  if (!id) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  const body = (await req.json().catch(() => ({}))) as { leido?: unknown; archivado?: unknown };
  const data: { readAt?: Date | null; archivedAt?: Date | null } = {};
  if (typeof body.leido === "boolean") data.readAt = body.leido ? new Date() : null;
  if (typeof body.archivado === "boolean") data.archivedAt = body.archivado ? new Date() : null;
  if (Object.keys(data).length === 0) return NextResponse.json({ error: "Nada para cambiar" }, { status: 400 });

  const r = await prisma.clfInboundEmail.updateMany({ where: { id }, data });
  if (r.count === 0) return NextResponse.json({ error: "No existe" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
