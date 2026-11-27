import { getCurrentUser, isSuperAdmin } from "@repo/auth-guards";
import { NextResponse } from "next/server";
import { EquipoError } from "@/lib/inventario/equipos";
import {
  approveListing,
  dismissFlag,
  rejectListing,
  reviewFlaggedListing,
} from "@/lib/publicaciones/moderacion";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Decide una publicación en revisión: aprobar o rechazar (con nota interna obligatoria). */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !(await isSuperAdmin(user))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "Publicación inválida" }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Pedido inválido" }, { status: 400 });
  }
  const accion = body.accion;
  if (
    accion !== "aprobar" &&
    accion !== "rechazar" &&
    accion !== "revisar" &&
    accion !== "descartar"
  ) {
    return NextResponse.json({ error: "Acción inválida" }, { status: 400 });
  }
  const nota = typeof body.nota === "string" ? body.nota.trim() : "";
  if (accion === "rechazar" && !nota) {
    return NextResponse.json({ error: "Indicá el motivo del rechazo" }, { status: 400 });
  }

  const flagId =
    Number.isInteger(body.flagId) && Number(body.flagId) > 0 ? Number(body.flagId) : undefined;
  if (accion === "descartar" && !flagId) {
    return NextResponse.json({ error: "Reporte inválido" }, { status: 400 });
  }

  try {
    if (accion === "revisar") await reviewFlaggedListing(user.id, id, flagId);
    else if (accion === "descartar") await dismissFlag(id, flagId!);
    else if (accion === "aprobar") await approveListing(user.id, id);
    else await rejectListing(user.id, id, nota);
  } catch (err) {
    if (err instanceof EquipoError) {
      if (err.code === "NO_ENCONTRADO") {
        return NextResponse.json({ error: "No existe la publicación" }, { status: 404 });
      }
      return NextResponse.json(
        {
          error:
            accion === "revisar" || accion === "descartar"
              ? "El estado cambió: actualizá la pantalla"
              : "Esta publicación ya no está en revisión",
        },
        { status: 409 },
      );
    }
    console.error("[moderacion] Error inesperado:", err);
    return NextResponse.json({ error: "No se pudo guardar la decisión" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
