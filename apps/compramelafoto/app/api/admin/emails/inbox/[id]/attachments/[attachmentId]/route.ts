import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { enlaceAdjunto } from "@/lib/inbound-email/resend-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Lleva al enlace temporal de Resend para bajar un adjunto (vence: se pide uno nuevo cada vez). */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string; attachmentId: string }> }) {
  const { error, user } = await requireAuth([Role.ADMIN]);
  if (error || !user) return NextResponse.json({ error: error || "No autorizado" }, { status: 401 });
  const { id, attachmentId } = await params;
  const n = Number(id);
  if (!Number.isInteger(n) || n <= 0) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  const correo = await prisma.clfInboundEmail.findUnique({ where: { id: n }, select: { resendId: true, attachments: true } });
  if (!correo) return NextResponse.json({ error: "No existe" }, { status: 404 });
  const adjuntos = Array.isArray(correo.attachments) ? (correo.attachments as Array<{ id?: unknown }>) : [];
  if (!adjuntos.some((a) => a?.id === attachmentId)) return NextResponse.json({ error: "Adjunto inexistente" }, { status: 404 });

  const r = await enlaceAdjunto(correo.resendId, attachmentId);
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: 502 });
  return NextResponse.redirect(r.url);
}
