import "server-only";
import { prisma } from "@repo/db";
import { getGoogleAccessToken } from "@/lib/integrations/access-token";
import { GOOGLE_CALENDAR_INTEGRATION_KEY } from "@/lib/integrations/registry";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";
import { AGENDA_MODULE_KEY } from "../acceso";
import { crearClienteAgenda, type ClienteAgenda } from "./cliente";

/**
 * Lo que hace falta para hablar con el calendario de la Agenda de una organización. Se evalúa en este
 * orden y cada paso corta antes de gastar el siguiente: módulo `agenda` encendido (sin él no se consulta
 * nada más), calendario creado, y la cuenta de Google conectada (la misma integración que usa Reservas).
 * Los motivos son códigos para los registros y la pantalla de Configuración: nunca datos de la cuenta.
 */
export type MotivoSinGoogle = "MODULO_APAGADO" | "SIN_CALENDARIO" | "NOT_CONNECTED" | "NEEDS_RECONSENT" | "CONFIG" | "UNAVAILABLE";

export type ContextoGoogle = { cliente: ClienteAgenda; calendarId: string };

export type ResultadoContextoGoogle = { ok: true; google: ContextoGoogle } | { ok: false; motivo: MotivoSinGoogle };

export async function contextoGoogle(workspaceId: string): Promise<ResultadoContextoGoogle> {
  if (!(await isModuleEnabledForWorkspace(workspaceId, AGENDA_MODULE_KEY))) return { ok: false, motivo: "MODULO_APAGADO" };
  const ajustes = await prisma.fotofficeAgendaAjustes.findUnique({ where: { workspaceId }, select: { googleCalendarId: true } });
  const calendarId = ajustes?.googleCalendarId ?? null;
  if (!calendarId) return { ok: false, motivo: "SIN_CALENDARIO" };
  const token = await getGoogleAccessToken(workspaceId, GOOGLE_CALENDAR_INTEGRATION_KEY);
  // Un permiso vencido o revocado queda marcado por `getGoogleAccessToken` (Integraciones muestra "Necesita reconexión").
  if (!token.ok) return { ok: false, motivo: token.reason };
  return { ok: true, google: { cliente: crearClienteAgenda(token.accessToken), calendarId } };
}
