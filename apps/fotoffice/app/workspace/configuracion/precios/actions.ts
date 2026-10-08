"use server";

import { revalidatePath } from "next/cache";
import { requireActiveWorkspaceRole } from "@/lib/access/active-context";
import { puede } from "@/lib/access/policy";
import { etiquetaDeUsuario } from "@/lib/listado/acceso";
import { guardarPerfilPrecios } from "@/lib/precios/perfil";
import type { CtxPresupuestos } from "@/lib/presupuestos/acceso";

export type ResultadoPerfilPrecios = { ok: true } | { ok: false; error: string };

const RUTA = "/workspace/configuracion/precios";
const SIN_PERMISO: ResultadoPerfilPrecios = { ok: false, error: "Sólo el dueño o un administrador pueden configurar los precios." };

/** Sesión, workspace activo y rol salen siempre de la sesión, nunca de los datos recibidos. */
async function contexto(): Promise<CtxPresupuestos | null> {
  const { user, workspace, role } = await requireActiveWorkspaceRole();
  if (!puede(role, "configurar")) return null;
  return { workspaceId: workspace.id, userId: user.id, userLabel: etiquetaDeUsuario(user), role };
}

/** Guarda el perfil de precios del workspace. `guardarPerfilPrecios` valida todo. */
export async function guardarPerfilPreciosAction(perfil: unknown): Promise<ResultadoPerfilPrecios> {
  const ctx = await contexto();
  if (!ctx) return SIN_PERMISO;
  const r = await guardarPerfilPrecios(ctx, perfil);
  if (!r.ok) return r;
  revalidatePath(RUTA);
  return { ok: true };
}
