import "server-only";
import { GOOGLE_CALENDAR_INTEGRATION_KEY } from "@/lib/integrations/registry";
import { getIntegrationSummary } from "@/lib/integrations/store";

/**
 * El estado de la conexión con Google Calendar que muestra Configuración → Agenda. Sólo lectura de la base
 * (no llama a Google). Los avisos son frases para el dueño; no llevan códigos de error ni datos de la cuenta.
 */
export type EstadoGoogleAgenda = {
  cuenta: "NO_CONECTADA" | "CONECTADA" | "REQUIERE_RECONEXION";
  email: string | null;
  calendarioCreado: boolean;
  avisos: string[];
};

const PERMISO_CALENDARIOS_PROPIOS = "https://www.googleapis.com/auth/calendar.app.created";
/** Pasado este tiempo sin sincronizar (el cron corre cada 10 minutos) se avisa. */
const MINUTOS_SIN_SINCRONIZAR = 45;

export async function estadoDeGoogleAgenda(workspaceId: string, calendarId: string | null, ultimaSync: Date | null, ahora: Date): Promise<EstadoGoogleAgenda> {
  const resumen = await getIntegrationSummary(workspaceId, GOOGLE_CALENDAR_INTEGRATION_KEY).catch(() => null);
  const avisos: string[] = [];
  const cuenta: EstadoGoogleAgenda["cuenta"] =
    !resumen || resumen.status === "REVOKED" ? "NO_CONECTADA" : resumen.status === "NEEDS_RECONSENT" ? "REQUIERE_RECONEXION" : "CONECTADA";

  if (cuenta === "NO_CONECTADA") avisos.push("Para usar Google Calendar, primero conectá la cuenta de Google en Integraciones (es la misma que usa Reservas).");
  if (cuenta === "REQUIERE_RECONEXION") avisos.push("Google dejó de aceptar el permiso. Reconectá la cuenta en Integraciones: mientras tanto la Agenda no se sincroniza.");
  if (cuenta === "CONECTADA" && resumen && !resumen.grantedScopes.includes(PERMISO_CALENDARIOS_PROPIOS)) {
    avisos.push("La cuenta se conectó antes de que la Agenda pudiera crear calendarios. Volvé a conectarla en Integraciones para darle ese permiso.");
  }
  if (calendarId && cuenta === "CONECTADA") {
    const hace = ultimaSync ? (ahora.getTime() - ultimaSync.getTime()) / 60_000 : null;
    if (hace === null) avisos.push("El calendario está creado y la primera sincronización todavía no corrió. Se hace sola cada 10 minutos.");
    else if (hace > MINUTOS_SIN_SINCRONIZAR) avisos.push("Hace un buen rato que no se sincroniza. Si sigue así, revisá la conexión en Integraciones.");
  }
  return { cuenta, email: resumen?.accountEmail ?? null, calendarioCreado: calendarId !== null, avisos };
}
