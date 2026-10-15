"use server";

import { revalidatePath } from "next/cache";
import { requireActiveWorkspaceRole } from "@/lib/access/active-context";
import { puede } from "@/lib/access/policy";
import { etiquetaDeUsuario } from "@/lib/listado/acceso";
import { configurarSecuencia } from "@/lib/numeracion/secuencias";

/** Estado del formulario de cada secuencia (`useActionState`). */
export type EstadoNumeracion = { error: string | null; ok?: string };

const RUTA = "/workspace/configuracion/numeracion";
const SIN_PERMISO: EstadoNumeracion = { error: "Sólo el dueño o un administrador pueden cambiar la numeración." };
const DATOS_INVALIDOS: EstadoNumeracion = { error: "Los datos no son válidos." };

/**
 * Sesión, workspace activo y rol salen siempre de la sesión, nunca del formulario. Sin
 * `configurar` no se lee ni se escribe nada.
 */
async function contexto() {
  const { user, workspace, role } = await requireActiveWorkspaceRole();
  if (!puede(role, "configurar")) return null;
  return { workspaceId: workspace.id, userId: user.id, userLabel: etiquetaDeUsuario(user), role };
}

function texto(fd: FormData, nombre: string, max: number): string | null {
  const v = fd.get(nombre);
  if (v === null) return "";
  if (typeof v !== "string" || v.length > max) return null;
  return v;
}

/** Prefijo, año, dígitos y próximo número de una secuencia. Las reglas las aplica el catálogo. */
export async function configurarSecuenciaAction(_prev: EstadoNumeracion | undefined, fd: FormData): Promise<EstadoNumeracion> {
  const ctx = await contexto();
  if (!ctx) return SIN_PERMISO;
  const clave = texto(fd, "clave", 20);
  const prefijo = texto(fd, "prefijo", 50);
  const digitos = texto(fd, "digitos", 20);
  const proximo = texto(fd, "proximo", 20);
  if (clave === null || prefijo === null || digitos === null || proximo === null) return DATOS_INVALIDOS;
  const r = await configurarSecuencia(ctx, clave, {
    prefix: prefijo,
    withYear: fd.get("conAnio") === "1",
    digits: digitos,
    nextValue: proximo,
  });
  if (!r.ok) return { error: r.error };
  revalidatePath(RUTA);
  return { error: null, ok: "Numeración guardada." };
}
