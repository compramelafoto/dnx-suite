/**
 * Una imagen del ZIP para redes: la foto (`?tipo=foto`) o su ficha (`?tipo=ficha`).
 *
 * Son obras en concurso: se sirven sólo con sesión de administración, sin caché
 * compartida, y nunca la de quien no autorizó publicar en redes.
 */
import { NextResponse } from "next/server";

import { getClickatonAuthUser, hasClickatonAdminAccess } from "@/lib/admin/auth";
import { imagenParaRedes } from "@/lib/edition-results/redes-paquete";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

type Params = { params: Promise<{ editionId: string; snapshotId: string }> };

export async function GET(request: Request, { params }: Params) {
  const user = await getClickatonAuthUser();
  if (!user) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  if (!hasClickatonAdminAccess(user)) {
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }

  const { editionId, snapshotId } = await params;
  const tipo = new URL(request.url).searchParams.get("tipo") === "ficha" ? "ficha" : "foto";
  const jpeg = await imagenParaRedes(editionId, snapshotId, tipo);
  if (!jpeg) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });

  return new NextResponse(new Uint8Array(jpeg), {
    status: 200,
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
