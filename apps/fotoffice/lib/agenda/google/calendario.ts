import "server-only";
import { prisma } from "@repo/db";
import { getGoogleAccessToken } from "@/lib/integrations/access-token";
import { GOOGLE_CALENDAR_INTEGRATION_KEY } from "@/lib/integrations/registry";
import { puedeConfigurarAgenda, MENSAJES_AGENDA, type CtxAgenda } from "../acceso";
import { codigoDeError, crearClienteAgenda, esFaltaDePermiso } from "./cliente";

/**
 * Configuración → Agenda → «Crear calendario». Crea en la cuenta de Google conectada (la misma integración
 * de Reservas) un calendario propio «<organización> Agenda» y guarda su id. Sólo `configurar`. Si ya hay
 * uno no crea otro (cambiar de calendario dejaría los eventos viejos huérfanos).
 */
export const MENSAJES_CALENDARIO = {
  sinCuenta: "Conectá la cuenta de Google en Integraciones antes de crear el calendario.",
  yaExiste: "La Agenda ya tiene su calendario.",
  sinPermisoGoogle: "La cuenta de Google conectada no tiene permiso para crear calendarios. Volvé a conectarla en Integraciones.",
  fallo: "No pudimos crear el calendario. Probá de nuevo en un rato.",
} as const;

export type ResultadoCalendario = { ok: true } | { ok: false; error: string };

const NOMBRE_MAX = 120;

export function nombreDelCalendario(organizacion: string): string {
  return `${organizacion.trim().slice(0, NOMBRE_MAX)} Agenda`.trim();
}

export async function crearCalendarioDeAgenda(ctx: CtxAgenda, organizacion: string): Promise<ResultadoCalendario> {
  if (!puedeConfigurarAgenda(ctx)) return { ok: false, error: MENSAJES_AGENDA.sinPermiso };
  const { workspaceId } = ctx;

  const actual = await prisma.fotofficeAgendaAjustes.findUnique({ where: { workspaceId }, select: { googleCalendarId: true } });
  if (actual?.googleCalendarId) return { ok: false, error: MENSAJES_CALENDARIO.yaExiste };

  const token = await getGoogleAccessToken(workspaceId, GOOGLE_CALENDAR_INTEGRATION_KEY);
  if (!token.ok) return { ok: false, error: MENSAJES_CALENDARIO.sinCuenta };

  let calendarId: string;
  try {
    calendarId = await crearClienteAgenda(token.accessToken).crearCalendario(nombreDelCalendario(organizacion));
  } catch (error) {
    console.error("[agenda][google] no se pudo crear el calendario", { codigo: codigoDeError(error) });
    return { ok: false, error: esFaltaDePermiso(error) ? MENSAJES_CALENDARIO.sinPermisoGoogle : MENSAJES_CALENDARIO.fallo };
  }

  try {
    await prisma.fotofficeAgendaAjustes.upsert({
      where: { workspaceId },
      create: { workspaceId, googleCalendarId: calendarId, googleSyncToken: null },
      update: { googleCalendarId: calendarId, googleSyncToken: null },
    });
  } catch (error) {
    console.error("[agenda][google] no se pudo guardar el calendario", { codigo: codigoDeError(error) });
    return { ok: false, error: MENSAJES_CALENDARIO.fallo };
  }
  return { ok: true };
}
