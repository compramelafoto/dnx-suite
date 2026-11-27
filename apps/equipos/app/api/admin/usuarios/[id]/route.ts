import { getCurrentUser, isSuperAdmin } from "@repo/auth-guards";
import { NextResponse } from "next/server";
import { EquipoError } from "@/lib/inventario/equipos";
import { blockAccount, unblockAccount } from "@/lib/usuarios/bloqueo";
import { resolveUserReport } from "@/lib/usuarios/reportes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Acciones del admin sobre una cuenta del portal (`id` = la cuenta): bloquear (con motivo
 * interno), desbloquear o resolver un reporte sobre ella.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !(await isSuperAdmin(user))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "Cuenta inválida" }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Pedido inválido" }, { status: 400 });
  }
  const accion = body.accion;
  if (accion !== "bloquear" && accion !== "desbloquear" && accion !== "resolver") {
    return NextResponse.json({ error: "Acción inválida" }, { status: 400 });
  }
  const reportId =
    Number.isInteger(body.reportId) && Number(body.reportId) > 0 ? Number(body.reportId) : undefined;
  if (accion === "resolver" && !reportId) {
    return NextResponse.json({ error: "Reporte inválido" }, { status: 400 });
  }
  const texto = (k: string) => (typeof body[k] === "string" ? (body[k] as string) : "");

  try {
    if (accion === "bloquear") await blockAccount(user.id, id, texto("motivo"));
    else if (accion === "desbloquear") await unblockAccount(user.id, id);
    else await resolveUserReport(user.id, reportId!, texto("resolucion"));
  } catch (err) {
    if (err instanceof EquipoError) {
      if (err.code === "NO_ENCONTRADO") {
        return NextResponse.json({ error: err.message === "NO_ENCONTRADO" ? "No existe" : err.message }, { status: 404 });
      }
      // Textos fijos de la librería (motivo corto, ya bloqueada, ya resuelto): sólo los ve el admin.
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    console.error("[admin-usuarios] Error inesperado:", err);
    return NextResponse.json({ error: "No se pudo guardar el cambio" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
