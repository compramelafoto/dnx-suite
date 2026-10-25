"use server";

import { revalidatePath } from "next/cache";
import { requireActiveWorkspaceRole } from "@/lib/access/active-context";
import { puede } from "@/lib/access/policy";
import { etiquetaDeUsuario } from "@/lib/listado/acceso";
import { guardarPerfilPrecios } from "@/lib/precios/perfil";
import { copiarPerfilDelPortal } from "@/lib/cuanto-cobro-socio/perfil";
import type { CtxPresupuestos } from "@/lib/presupuestos/acceso";

export type ResultadoPerfilPrecios = { ok: true; actualizado: string } | { ok: false; error: string };

const RUTA = "/workspace/configuracion/precios";
const SIN_PERMISO: ResultadoPerfilPrecios = { ok: false, error: "Sólo el dueño o un administrador pueden configurar los precios." };

/** Sesión, workspace activo y rol salen siempre de la sesión, nunca de los datos recibidos. */
async function contexto(): Promise<CtxPresupuestos | null> {
  const { user, workspace, role } = await requireActiveWorkspaceRole();
  if (!puede(role, "configurar")) return null;
  return { workspaceId: workspace.id, userId: user.id, userLabel: etiquetaDeUsuario(user), role };
}

/**
 * Guarda el perfil de precios del workspace. `guardarPerfilPrecios` valida todo.
 *
 * `versionCargada`: la fecha (ISO) en que se guardó el perfil que mostró el formulario, o null si no
 * había. Si el perfil cambió desde entonces (por ejemplo, lo guardó DNX Bot), no se pisa.
 */
export async function guardarPerfilPreciosAction(perfil: unknown, versionCargada?: string | null): Promise<ResultadoPerfilPrecios> {
  const ctx = await contexto();
  if (!ctx) return SIN_PERMISO;
  let esperado: Date | null | undefined;
  if (typeof versionCargada === "string") {
    esperado = new Date(versionCargada);
    if (Number.isNaN(esperado.getTime())) return { ok: false, error: "Los datos del perfil no son válidos." };
  } else if (versionCargada === null) {
    esperado = null;
  }
  const r = esperado === undefined ? await guardarPerfilPrecios(ctx, perfil) : await guardarPerfilPrecios(ctx, perfil, { esperado });
  if (!r.ok) return { ok: false, error: r.error };
  revalidatePath(RUTA);
  return { ok: true, actualizado: r.actualizado.toISOString() };
}

/**
 * Copia al negocio el perfil de ¿Cuánto Cobro? que la persona armó en su portal de socio. Para quien
 * acaba de crear su negocio: no vuelve a cargar todo. Nunca pisa un perfil que el negocio ya tenga.
 */
export async function copiarPerfilDelPortalAction(): Promise<ResultadoPerfilPrecios> {
  const ctx = await contexto();
  if (!ctx) return SIN_PERMISO;
  const r = await copiarPerfilDelPortal(ctx);
  if (!r.ok) return { ok: false, error: r.error };
  revalidatePath(RUTA);
  return { ok: true, actualizado: r.actualizado.toISOString() };
}
