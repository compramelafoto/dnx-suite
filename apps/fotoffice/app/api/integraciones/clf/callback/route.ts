import { NextResponse, type NextRequest } from "next/server";
import { requireActiveWorkspaceRole } from "@/lib/access/active-context";
import { puede } from "@/lib/access/policy";
import { canjearCodigo } from "@/lib/clf/api";
import { guardarConexion } from "@/lib/clf/conexion";
import { COOKIE_ESTADO_CLF, estadoValido } from "@/lib/clf/estado-oauth";
import { sincronizarEspacio } from "@/lib/clf/sincronizar";
import { sanitizeError } from "@/lib/payments/connect/log";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const PAGINA = "/workspace/configuracion/compramelafoto";

/**
 * Vuelta desde CLF (etapa 2). Valida el `state` contra la cookie y el workspace de la sesión, canjea el código de
 * servidor a servidor por la llave, la guarda cifrada y hace una primera sincronización. Sin datos en la URL de vuelta.
 */
export async function GET(request: NextRequest) {
  const base = new URL(request.url);
  const ir = (r: string) => {
    const res = NextResponse.redirect(new URL(`${PAGINA}?r=${r}`, base));
    res.cookies.delete({ name: COOKIE_ESTADO_CLF, path: "/api/integraciones/clf" });
    return res;
  };

  const { user, workspace, role } = await requireActiveWorkspaceRole();
  if (!puede(role, "configurar")) return ir("permiso");
  const state = base.searchParams.get("state");
  if (!estadoValido(request.cookies.get(COOKIE_ESTADO_CLF)?.value, state, workspace.id)) return ir("error");
  if (base.searchParams.get("error") === "cancelado") return ir("cancelado");
  const codigo = base.searchParams.get("code");
  if (!codigo || codigo.length > 200) return ir("error");

  const r = await canjearCodigo(codigo);
  if (!r.ok) return ir(r.codigo === "NO_CONFIGURADA" ? "no-configurada" : "error");
  try {
    await guardarConexion(workspace.id, user.id, { llave: r.llave, cuenta: r.cuenta });
  } catch (error) {
    console.error("[fotoffice][clf] no se pudo guardar la conexión", { detalle: sanitizeError(error) });
    return ir("error");
  }
  // Primera sincronización corta (la función tiene 60 s); el resto lo sigue el cron cada 15 minutos.
  await sincronizarEspacio(workspace.id, { topes: { validaciones: 20, revalidaciones: 0 } }).catch((error) => console.error("[fotoffice][clf] primera sincronización", { detalle: sanitizeError(error) }));
  return ir("ok");
}
