import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { requireAuth } from "@/lib/auth";
import { rehacerHistoriasPendientes } from "@/lib/social/album-stories";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** «Rehacer pendientes»: vuelve a armar las historias en cola con el diseño actual. Solo admin. */
export async function POST() {
  const { error, user } = await requireAuth([Role.ADMIN]);
  if (error || !user) return NextResponse.json({ error: error ?? "No autorizado" }, { status: 401 });
  return NextResponse.json(await rehacerHistoriasPendientes());
}
