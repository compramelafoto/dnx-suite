"use server";

import { revalidatePath } from "next/cache";
import { requireActiveWorkspaceRole } from "@/lib/access/active-context";
import { puede } from "@/lib/access/policy";
import { etiquetaDeUsuario } from "@/lib/listado/acceso";
import { guardarAjustes } from "@/lib/presupuestos/ajustes";
import type { CtxPresupuestos } from "@/lib/presupuestos/acceso";

/** Estado del formulario de Configuración → Presupuestos (`useActionState`). */
export type EstadoPresupuestosConfig = { error: string | null; ok?: string };

const RUTA = "/workspace/configuracion/presupuestos";
const SIN_PERMISO: EstadoPresupuestosConfig = { error: "Sólo el dueño o un administrador pueden configurar los presupuestos." };
const DATOS_INVALIDOS: EstadoPresupuestosConfig = { error: "Los datos no son válidos." };

/**
 * Sesión, workspace activo y rol salen siempre de la sesión, nunca del formulario. Sin
 * `configurar` no se lee ni se escribe nada.
 *
 * A diferencia de Configuración → Consultas, NO exige el módulo `quotes` encendido: los ajustes
 * se pueden dejar listos antes de encenderlo (revisión de la Task 3).
 */
async function contexto(): Promise<CtxPresupuestos | null> {
  const { user, workspace, role } = await requireActiveWorkspaceRole();
  if (!puede(role, "configurar")) return null;
  return { workspaceId: workspace.id, userId: user.id, userLabel: etiquetaDeUsuario(user), role };
}

function texto(fd: FormData, nombre: string): string | null {
  const v = fd.get(nombre);
  return typeof v === "string" ? v : null;
}

/** Validez, condiciones, propuesta de pago y seguimiento. `guardarAjustes` valida rangos y largos. */
export async function guardarAjustesPresupuestosAction(
  _prev: EstadoPresupuestosConfig | undefined,
  fd: FormData,
): Promise<EstadoPresupuestosConfig> {
  const ctx = await contexto();
  if (!ctx) return SIN_PERMISO;
  const validezDias = texto(fd, "validez");
  const seguimientoDias = texto(fd, "seguimiento");
  if (validezDias === null || seguimientoDias === null) return DATOS_INVALIDOS;
  const r = await guardarAjustes(ctx, {
    validezDias,
    condiciones: texto(fd, "condiciones"),
    propuestaPago: texto(fd, "propuestaPago"),
    seguimientoDias,
    seguimientoActivo: fd.get("seguimientoActivo") === "1",
  });
  if (!r.ok) return { error: r.error };
  revalidatePath(RUTA);
  return { error: null, ok: "Ajustes guardados." };
}
