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

/**
 * De dónde salió el perfil guardado: el formulario, DNX Bot o el ¿Cuánto Cobro? que la persona armó
 * en su portal de socio y copió al crear su negocio ("clf-import" lo escribe sólo el script de
 * importación).
 */
export const ORIGENES_DE_GUARDADO = ["manual", "dnx-bot", "portal"] as const;
export type OrigenDeGuardado = (typeof ORIGENES_DE_GUARDADO)[number];

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

export type ResultadoGuardado = { ok: true; actualizado: Date } | { ok: false; error: string; conflicto?: true };

const CAMBIO_POR_BOT = "El perfil cambió mientras lo tenías abierto (lo guardó DNX Bot). Recargá para ver los datos nuevos.";
const CAMBIO = "El perfil cambió mientras lo tenías abierto. Recargá para ver los datos nuevos.";

async function conflicto(workspaceId: string): Promise<ResultadoGuardado> {
  const actual = await prisma.fotofficePerfilPrecios.findUnique({ where: { workspaceId }, select: { source: true } });
  return { ok: false, error: actual?.source === "dnx-bot" ? CAMBIO_POR_BOT : CAMBIO, conflicto: true };
}

/**
 * Guarda el perfil. Con `esperado` (concurrencia optimista, sin migración: usa `updatedAt`) sólo
 * guarda si el perfil sigue siendo el que se cargó: la fecha de la última vez que se guardó, o
 * `null` si no había perfil. Si cambió mientras tanto (por ejemplo, lo guardó DNX Bot con el
 * formulario abierto), no pisa nada y lo dice. Sin `esperado`, guarda siempre.
 */
export async function guardarPerfilPrecios(
  ctx: CtxPresupuestos,
  datos: unknown,
  opciones: { source?: OrigenDeGuardado; esperado?: Date | null } = {},
): Promise<ResultadoGuardado> {
  if (!veCostos(ctx)) return { ok: false, error: SIN_PERMISO };
  const source = opciones.source ?? "manual";
  if (!ORIGENES_DE_GUARDADO.includes(source)) return { ok: false, error: "Los datos del perfil no son válidos." };
  const v = validarPerfil(datos);
  if (!v.ok) return { ok: false, error: v.error };
  const { workspaceId } = ctx;
  try {
    const profileData = JSON.parse(JSON.stringify(v.perfil));
    const actualizado = new Date();
    const campos = { schemaVersion: 1, profileData, source, updatedByUserId: ctx.userId, updatedAt: actualizado };
    if (opciones.esperado === undefined) {
      await prisma.fotofficePerfilPrecios.upsert({
        where: { workspaceId },
        create: { workspaceId, ...campos },
        update: campos,
      });
    } else if (opciones.esperado === null) {
      try {
        await prisma.fotofficePerfilPrecios.create({ data: { workspaceId, ...campos }, select: { id: true } });
      } catch (e) {
        if ((e as { code?: unknown } | null)?.code === "P2002") return conflicto(workspaceId);
        throw e;
      }
    } else {
      const r = await prisma.fotofficePerfilPrecios.updateMany({ where: { workspaceId, updatedAt: opciones.esperado }, data: campos });
      if (r.count !== 1) return conflicto(workspaceId);
    }
    return { ok: true, actualizado };
  } catch (e) {
    console.error("[precios] no se pudo guardar el perfil", {
      workspaceId,
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
