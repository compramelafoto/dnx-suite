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

  const request = await prisma.privacyRequest.findUnique({ where: { id } });
  if (!request) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  return NextResponse.json({ request });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAuth([Role.ADMIN]);
  if (error) return NextResponse.json({ error: error || "No autorizado" }, { status: 401 });

  const id = parseInt((await params).id, 10);
  if (isNaN(id)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  const request = await prisma.privacyRequest.findUnique({ where: { id } });
  if (!request) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const data: Record<string, unknown> = {};
  if (body.status) data.status = body.status;
  if (body.internalNote !== undefined) data.internalNote = body.internalNote;

  const updated = await prisma.privacyRequest.update({
    where: { id },
    data: data as any,
  });

  return NextResponse.json({ request: updated });
}
