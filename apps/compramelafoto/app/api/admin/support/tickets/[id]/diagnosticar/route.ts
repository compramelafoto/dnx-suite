import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { soloAdmin } from "@/lib/soporte/admin-auth";
import { lanzarDiagnostico } from "@/lib/soporte/diagnostico/lanzar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** POST — "Volver a diagnosticar": rehace el diagnóstico aunque ya esté listo y devuelve el nuevo. */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await soloAdmin();
  if (!auth.ok) return auth.res;
  const ticketId = Number((await params).id);
  if (!Number.isFinite(ticketId)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  await lanzarDiagnostico(ticketId, { forzar: true });
  const diagnostico = await prisma.supportDiagnosis.findUnique({ where: { ticketId } });
  return NextResponse.json({ diagnostico });
}
