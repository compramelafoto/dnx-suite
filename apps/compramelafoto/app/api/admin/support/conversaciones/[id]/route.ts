import { NextRequest, NextResponse } from "next/server";
import { soloAdmin } from "@/lib/soporte/admin-auth";
import { leerConversacion } from "@/lib/soporte/resumen-bot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await soloAdmin();
  if (!auth.ok) return auth.res;
  const { id } = await params;
  const conv = await leerConversacion(id);
  if (!conv) return NextResponse.json({ error: "Conversación no encontrada" }, { status: 404 });
  return NextResponse.json(conv);
}
