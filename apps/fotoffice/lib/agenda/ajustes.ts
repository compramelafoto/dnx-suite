import "server-only";
import { prisma } from "@repo/db";
import { MENSAJES_AGENDA, puedeConfigurarAgenda, type CtxAgenda } from "./acceso";
import { HORAS_RECORDATORIO_MAX, HORAS_RECORDATORIO_MIN, HORAS_RECORDATORIO_POR_OMISION } from "./constantes";

/**
 * Ajustes del recordatorio de citas (Configuración → Agenda, `FotofficeAgendaAjustes`): una fila por
 * organización. Sin fila valen los de fábrica: apagado, 24 horas antes. Permiso: `configurar`.
 */
export type AjustesRecordatorio = { activo: boolean; horas: number };

export const AJUSTES_RECORDATORIO_DE_FABRICA: AjustesRecordatorio = { activo: false, horas: HORAS_RECORDATORIO_POR_OMISION };

export const MENSAJES_AJUSTES_AGENDA = {
  horas: `Las horas del recordatorio tienen que ser un número entero de ${HORAS_RECORDATORIO_MIN} a ${HORAS_RECORDATORIO_MAX}.`,
} as const;

export async function leerAjustesRecordatorio(workspaceId: string): Promise<AjustesRecordatorio> {
  const f = await prisma.fotofficeAgendaAjustes.findUnique({ where: { workspaceId }, select: { reminderEnabled: true, reminderHours: true } });
  return f ? { activo: f.reminderEnabled, horas: f.reminderHours } : { ...AJUSTES_RECORDATORIO_DE_FABRICA };
}

export type ResultadoAjustes = { ok: true } | { ok: false; error: string };

function entero(v: unknown, min: number, max: number): number | null {
  const n = typeof v === "string" && v.trim() !== "" ? Number(v) : v;
  return typeof n === "number" && Number.isInteger(n) && n >= min && n <= max ? n : null;
}

/** Guarda encendido y horas de anticipación. Exige `configurar`; no toca las columnas de Google. */
export async function guardarAjustesRecordatorio(ctx: CtxAgenda, datos: unknown): Promise<ResultadoAjustes> {
  if (!puedeConfigurarAgenda(ctx)) return { ok: false, error: MENSAJES_AGENDA.sinPermiso };
  if (!datos || typeof datos !== "object") return { ok: false, error: MENSAJES_AGENDA.datosInvalidos };
  const d = datos as Record<string, unknown>;
  if (typeof d.activo !== "boolean") return { ok: false, error: MENSAJES_AGENDA.datosInvalidos };
  const horas = entero(d.horas, HORAS_RECORDATORIO_MIN, HORAS_RECORDATORIO_MAX);
  if (horas === null) return { ok: false, error: MENSAJES_AJUSTES_AGENDA.horas };
  const valores = { reminderEnabled: d.activo, reminderHours: horas };
  try {
    await prisma.fotofficeAgendaAjustes.upsert({
      where: { workspaceId: ctx.workspaceId },
      create: { workspaceId: ctx.workspaceId, ...valores },
      update: valores,
      select: { id: true },
    });
  } catch (e) {
    // Dos pestañas guardaron la primera vez a la vez: el único frena a una; gana la última.
    if ((e as { code?: unknown } | null)?.code !== "P2002") throw e;
    await prisma.fotofficeAgendaAjustes.updateMany({ where: { workspaceId: ctx.workspaceId }, data: valores });
  }
  return { ok: true };
}
