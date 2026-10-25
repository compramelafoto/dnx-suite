import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Desconectar borra el permiso guardado y los mails de esa cuenta. En la Tanda 1 ningún mail
 * está aplicado a un gasto, así que no se pierde nada cargado. La Tanda 2 tiene que revisar
 * esto antes de que existan mails CARGADOS.
 */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, user } = await requireAuth([Role.ADMIN]);
  if (error || !user) return NextResponse.json({ error: error || "No autorizado." }, { status: 401 });
  const id = Number((await params).id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "Identificador inválido." }, { status: 400 });
  const r = await prisma.expenseMailAccount.deleteMany({ where: { id } });
  if (r.count === 0) return NextResponse.json({ error: "La cuenta no existe." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
