import { NextResponse } from "next/server";
import { requireActiveWorkspaceRole } from "@/lib/access/active-context";
import { puede } from "@/lib/access/policy";
import { secretoCompartido } from "@/lib/clf/api";
import { urlDeAutorizacion } from "@/lib/clf/conexion";
import { COOKIE_ESTADO_CLF, nuevoEstado, valorDeCookie, VIDA_ESTADO_CLF_S } from "@/lib/clf/estado-oauth";

export const dynamic = "force-dynamic";

const PAGINA = "/workspace/configuracion/compramelafoto";

/**
 * Configuración → CompraMeLaFoto → «Conectar» (etapa 2). Sólo dueño o administrador. Guarda un `state` de un solo
 * uso en una cookie y manda a la persona a CLF, donde autoriza con su sesión de CLF. Nunca se empareja por correo.
 */
export async function GET(request: Request) {
  const { workspace, role } = await requireActiveWorkspaceRole();
  const base = new URL(request.url);
  if (!puede(role, "configurar")) return NextResponse.redirect(new URL(`${PAGINA}?r=permiso`, base));
  if (!secretoCompartido()) return NextResponse.redirect(new URL(`${PAGINA}?r=no-configurada`, base));

  const state = nuevoEstado();
  const res = NextResponse.redirect(urlDeAutorizacion(state, workspace.name ?? "Mi espacio"));
  res.cookies.set(COOKIE_ESTADO_CLF, valorDeCookie(state, workspace.id), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/api/integraciones/clf",
    maxAge: VIDA_ESTADO_CLF_S,
  });
  return res;
}
