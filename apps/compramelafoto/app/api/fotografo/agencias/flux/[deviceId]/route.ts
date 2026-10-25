import { NextRequest, NextResponse } from "next/server";
import { Role } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { revokeDeviceKey } from "@/lib/agencies/flux-keys";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Desvincula una computadora: su llave deja de servir en el acto. */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ deviceId: string }> }) {
  const { error, user } = await requireAuth([Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER]);
  if (error || !user) return NextResponse.json({ error: error || "No autorizado" }, { status: 401 });
  const id = Number((await params).deviceId);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: "Computadora inválida." }, { status: 400 });
  if (!(await revokeDeviceKey(user.id, id))) {
    return NextResponse.json({ error: "No encontramos esa computadora (quizás ya estaba desvinculada)." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
