import "server-only";
import { prisma } from "@repo/db";
import type { CuantoCobroProfileInput } from "@repo/cuanto-cobro-core";
import { veCostos, type CtxPresupuestos } from "../presupuestos/acceso";
import { normalizarPerfil, validarPerfil } from "./perfil-datos";

/**
 * Perfil de precios (¿Cuánto Cobro?) del workspace: una fila por organización. Leer y guardar
 * exigen `configurar` (dueño y administradores), igual que cualquier costo.
 */
export type PerfilGuardado = { perfil: CuantoCobroProfileInput; source: string | null; actualizado: Date };

const SIN_PERMISO = "Sólo el dueño o un administrador pueden configurar los precios.";

export async function leerPerfilPrecios(ctx: CtxPresupuestos): Promise<PerfilGuardado | null> {
  if (!veCostos(ctx)) return null;
  const fila = await prisma.fotofficePerfilPrecios.findUnique({
    where: { workspaceId: ctx.workspaceId },
    select: { profileData: true, source: true, updatedAt: true },
  });
  if (!fila) return null;
  const perfil = normalizarPerfil(fila.profileData);
  if (!perfil) return null;
  return { perfil, source: fila.source, actualizado: fila.updatedAt };
}

export async function guardarPerfilPrecios(
  ctx: CtxPresupuestos,
  datos: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!veCostos(ctx)) return { ok: false, error: SIN_PERMISO };
  const v = validarPerfil(datos);
  if (!v.ok) return { ok: false, error: v.error };
  try {
    const profileData = JSON.parse(JSON.stringify(v.perfil));
    await prisma.fotofficePerfilPrecios.upsert({
      where: { workspaceId: ctx.workspaceId },
      create: { workspaceId: ctx.workspaceId, schemaVersion: 1, profileData, source: "manual", updatedByUserId: ctx.userId },
      update: { schemaVersion: 1, profileData, source: "manual", updatedByUserId: ctx.userId },
    });
    return { ok: true };
  } catch (e) {
    console.error("[precios] no se pudo guardar el perfil", {
      workspaceId: ctx.workspaceId,
      error: e instanceof Error ? e.message : String(e),
    });
    return { ok: false, error: "No se pudo guardar el perfil." };
  }
}

/**
 * El perfil para el sistema (envío automático de propuestas): sin permisos de persona. Sólo
 * servidor; nunca devolver al navegador sin veCostos.
 */
export async function leerPerfilPreciosDelSistema(workspaceId: string): Promise<CuantoCobroProfileInput | null> {
  const fila = await prisma.fotofficePerfilPrecios.findUnique({ where: { workspaceId }, select: { profileData: true } });
  return fila ? normalizarPerfil(fila.profileData) : null;
}
