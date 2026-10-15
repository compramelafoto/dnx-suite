import "server-only";
import { prisma } from "@repo/db";
import { puedeEnContexto } from "@/lib/access/policy";
import { hasModuleLevel } from "@/lib/permissions/module-access";
import { SERVICE_LEADS_MODULE_KEY } from "@/lib/service-leads/constants";
import type { CtxConsultas } from "./catalogo";

/**
 * Ajustes del aviso de consulta nueva (spec §3.4, pestaña Avisos): una fila por organización.
 * Sin fila valen los de fábrica: sin responsable (avisa al dueño), con correo y con tarea.
 */
export type AjustesConsultas = {
  /** Responsable de las consultas nuevas; null = el dueño. */
  responsableUserId: number | null;
  notificarCorreo: boolean;
  crearTarea: boolean;
};

export const AJUSTES_DE_FABRICA: AjustesConsultas = { responsableUserId: null, notificarCorreo: true, crearTarea: true };

export const MENSAJES_AJUSTES = {
  sinPermiso: "Sólo un administrador puede configurar las consultas.",
  datosInvalidos: "Los datos no son válidos.",
  responsable: "El responsable tiene que ser alguien del equipo con permiso para gestionar Consultas.",
} as const;

export type DepsAjustes = {
  /** ¿Tiene "Gestionar" en Consultas? Inyectable en las pruebas; por omisión, los niveles de main. */
  tieneGestionar?: (userId: number, workspaceId: string) => Promise<boolean>;
};

const tieneGestionarPorDefecto = (userId: number, workspaceId: string) =>
  hasModuleLevel(userId, workspaceId, SERVICE_LEADS_MODULE_KEY, "MANAGE");

export async function leerAjustes(workspaceId: string): Promise<AjustesConsultas> {
  const f = await prisma.fotofficeConsultaAjustes.findUnique({
    where: { workspaceId },
    select: { defaultOwnerUserId: true, notifyEmail: true, createTask: true },
  });
  if (!f) return { ...AJUSTES_DE_FABRICA };
  return { responsableUserId: f.defaultOwnerUserId, notificarCorreo: f.notifyEmail, crearTarea: f.createTask };
}

/** ¿Puede ser responsable de consultas? Del equipo del workspace y con "Gestionar" en Consultas. */
export async function puedeSerResponsable(workspaceId: string, userId: unknown, deps: DepsAjustes = {}): Promise<boolean> {
  if (typeof userId !== "number" || !Number.isSafeInteger(userId) || userId <= 0) return false;
  const miembro = await prisma.workspaceMembership.findFirst({ where: { userId, workspaceId }, select: { id: true } });
  if (!miembro) return false;
  return (deps.tieneGestionar ?? tieneGestionarPorDefecto)(userId, workspaceId);
}

/** Guarda los tres ajustes. Exige `configurar`; el responsable se valida contra el equipo. */
export async function guardarAjustes(
  ctx: CtxConsultas,
  datos: { responsableUserId: unknown; notificarCorreo: unknown; crearTarea: unknown },
  deps: DepsAjustes = {},
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!puedeEnContexto(ctx, "configurar")) return { ok: false, error: MENSAJES_AJUSTES.sinPermiso };
  if (!datos || typeof datos !== "object") return { ok: false, error: MENSAJES_AJUSTES.datosInvalidos };
  if (typeof datos.notificarCorreo !== "boolean" || typeof datos.crearTarea !== "boolean") {
    return { ok: false, error: MENSAJES_AJUSTES.datosInvalidos };
  }
  const responsable = datos.responsableUserId ?? null;
  if (responsable !== null && !(await puedeSerResponsable(ctx.workspaceId, responsable, deps))) {
    return { ok: false, error: MENSAJES_AJUSTES.responsable };
  }
  const valores = {
    defaultOwnerUserId: responsable as number | null,
    notifyEmail: datos.notificarCorreo,
    createTask: datos.crearTarea,
  };
  try {
    await prisma.fotofficeConsultaAjustes.upsert({
      where: { workspaceId: ctx.workspaceId },
      create: { workspaceId: ctx.workspaceId, ...valores },
      update: valores,
      select: { id: true },
    });
  } catch (e) {
    // Dos pestañas guardaron la primera vez a la vez: el único frena a una; gana la última.
    if ((e as { code?: unknown } | null)?.code !== "P2002") throw e;
    await prisma.fotofficeConsultaAjustes.updateMany({ where: { workspaceId: ctx.workspaceId }, data: valores });
  }
  return { ok: true };
}
