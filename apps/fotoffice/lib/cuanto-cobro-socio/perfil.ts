import "server-only";
import { prisma } from "@repo/db";
import type { CuantoCobroProfileInput } from "@repo/cuanto-cobro-core";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";
import { loadPortalContext, type PortalContext } from "@/lib/portal/access";
import { normalizarPerfil, validarPerfil } from "@/lib/precios/perfil-datos";
import { guardarPerfilPrecios, leerPerfilPrecios, type ResultadoGuardado } from "@/lib/precios/perfil";
import { veCostos, type CtxPresupuestos } from "@/lib/presupuestos/acceso";
import { CUANTO_COBRO_SOCIO_MODULE_KEY } from "./constants";

/**
 * El perfil de ¿Cuánto Cobro? del socio: una fila por PERSONA (`userId`), en
 * `FotofficePerfilPreciosSocio`.
 *
 * Todo sale de la sesión: nadie lee ni guarda el perfil de otro, y ninguna función de acá recibe un
 * workspace para leerlo. La institución decide si el socio ve la sección (el módulo); lo que el
 * socio carga no lo ve nadie más.
 */

export type PerfilSocioGuardado = { perfil: CuantoCobroProfileInput; actualizado: Date };

/**
 * El portal del socio, si puede usar ¿Cuánto Cobro?: socio activo de una institución que encendió
 * el módulo. `null` en cualquier otro caso (y quien llama lo manda a `/portal`).
 */
export async function accesoCuantoCobroSocio(userId: number): Promise<PortalContext | null> {
  const context = await loadPortalContext(userId);
  if (!context) return null;
  if (!(await isModuleEnabledForWorkspace(context.workspace.id, CUANTO_COBRO_SOCIO_MODULE_KEY))) return null;
  return context;
}

export async function leerPerfilSocio(userId: number): Promise<PerfilSocioGuardado | null> {
  const fila = await prisma.fotofficePerfilPreciosSocio.findUnique({
    where: { userId },
    select: { profileData: true, updatedAt: true },
  });
  if (!fila) return null;
  const perfil = normalizarPerfil(fila.profileData);
  return perfil ? { perfil, actualizado: fila.updatedAt } : null;
}

const CAMBIO = "Tu perfil cambió mientras lo tenías abierto (quizás en otra pestaña). Recargá para ver los datos nuevos.";

/**
 * Guarda el perfil del socio. Con `esperado`, la misma concurrencia optimista que el perfil del
 * workspace: sólo guarda si el perfil sigue siendo el que se cargó (`null`: no había ninguno).
 *
 * «Mi estudio» no va: es la estructura de un estudio con equipo, y en el portal no se ofrece.
 */
export async function guardarPerfilSocio(
  userId: number,
  datos: unknown,
  opciones: { esperado?: Date | null } = {},
): Promise<ResultadoGuardado> {
  const v = validarPerfil(datos);
  if (!v.ok) return { ok: false, error: v.error };
  const perfil = { ...v.perfil };
  delete perfil.studioStructure;
  try {
    const profileData = JSON.parse(JSON.stringify(perfil));
    const actualizado = new Date();
    const campos = { schemaVersion: 1, profileData, updatedAt: actualizado };
    if (opciones.esperado === undefined) {
      await prisma.fotofficePerfilPreciosSocio.upsert({ where: { userId }, create: { userId, ...campos }, update: campos });
    } else if (opciones.esperado === null) {
      try {
        await prisma.fotofficePerfilPreciosSocio.create({ data: { userId, ...campos }, select: { id: true } });
      } catch (e) {
        if ((e as { code?: unknown } | null)?.code === "P2002") return { ok: false, error: CAMBIO, conflicto: true };
        throw e;
      }
    } else {
      const r = await prisma.fotofficePerfilPreciosSocio.updateMany({ where: { userId, updatedAt: opciones.esperado }, data: campos });
      if (r.count !== 1) return { ok: false, error: CAMBIO, conflicto: true };
    }
    return { ok: true, actualizado };
  } catch (e) {
    // Sin datos del perfil en el registro: son los gastos de vida de alguien.
    console.error("[cuanto-cobro-socio] no se pudo guardar el perfil", {
      userId,
      error: e instanceof Error ? e.message : String(e),
    });
    return { ok: false, error: "No se pudo guardar tu perfil." };
  }
}

/**
 * Lo que la pantalla de Configuración → Precios le ofrece a quien acaba de crear su negocio: copiar
 * el perfil que armó en su portal de socio. Sólo cuando el negocio todavía no tiene perfil (no se
 * pisa uno armado) y la persona tiene el suyo. Exige `configurar`, como todo lo de Precios.
 */
export async function hayPerfilDelPortalParaCopiar(ctx: CtxPresupuestos): Promise<boolean> {
  if (!veCostos(ctx) || ctx.userId === null) return false;
  if (await leerPerfilPrecios(ctx)) return false;
  return (await leerPerfilSocio(ctx.userId)) !== null;
}

/** Copia el perfil del portal de quien está en sesión al negocio. Nunca pisa un perfil existente. */
export async function copiarPerfilDelPortal(ctx: CtxPresupuestos): Promise<ResultadoGuardado> {
  if (!veCostos(ctx) || ctx.userId === null) return { ok: false, error: "Sólo el dueño o un administrador pueden configurar los precios." };
  const propio = await leerPerfilSocio(ctx.userId);
  if (!propio) return { ok: false, error: "No encontramos tu perfil de ¿Cuánto Cobro? del portal." };
  const r = await guardarPerfilPrecios(ctx, propio.perfil, { source: "portal", esperado: null });
  if (!r.ok && r.conflicto) return { ok: false, error: "Tu negocio ya tiene un perfil de precios: no lo pisamos." };
  return r;
}
