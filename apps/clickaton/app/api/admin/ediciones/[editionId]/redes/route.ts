/**
 * La lista de lo que va al ZIP para redes: carpetas, nombres de archivo y copy.
 *
 * Usa el mismo filtro que la pantalla de Resultados (`?consigna=…&desde=…&hasta=…`).
 * Las imágenes se piden una por una a `./[snapshotId]`.
 */
import { NextResponse } from "next/server";

import { getClickatonAuthUser, hasClickatonAdminAccess } from "@/lib/admin/auth";
import { armarPaqueteParaRedes } from "@/lib/edition-results/redes-paquete";
import { leerFiltro } from "@/lib/edition-results/redes-seleccion";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Params = { params: Promise<{ editionId: string }> };

export async function GET(request: Request, { params }: Params) {
  const user = await getClickatonAuthUser();
  if (!user) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  if (!hasClickatonAdminAccess(user)) {
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }

  const { editionId } = await params;
  const url = new URL(request.url);
  const filtro = leerFiltro({
    consigna: url.searchParams.getAll("consigna"),
    desde: url.searchParams.get("desde") ?? undefined,
    hasta: url.searchParams.get("hasta") ?? undefined,
  });

  const paquete = await armarPaqueteParaRedes(editionId, filtro);
  if (!paquete) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
  return NextResponse.json({ ok: true, paquete }, { headers: { "Cache-Control": "private, no-store" } });
}
