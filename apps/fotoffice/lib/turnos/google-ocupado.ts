import "server-only";
import { getGoogleAccessToken } from "@/lib/integrations/access-token";
import { GOOGLE_CALENDAR_INTEGRATION_KEY } from "@/lib/integrations/registry";
import type { Interval } from "@/lib/bookings/time";

/**
 * Lo ocupado en el Google Calendar principal de la cuenta conectada (freeBusy, permiso
 * `calendar.readonly`). Sólo horarios: nunca títulos ni detalles de los eventos.
 *
 * - Sin cuenta conectada: `SIN_GOOGLE` (el negocio eligió no conectarla; se usa sólo la Agenda).
 * - Conectada pero sin respuesta, con permiso vencido o con error: `FALLA`, y quien llama no ofrece
 *   horarios (nunca a ciegas).
 */
export type OcupadoGoogle = { estado: "OK"; ocupado: Interval[] } | { estado: "SIN_GOOGLE" } | { estado: "FALLA" };

export type DepsGoogle = { fetchImpl?: typeof fetch; token?: typeof getGoogleAccessToken };

export async function ocupadoEnGoogle(workspaceId: string, desde: Date, hasta: Date, deps: DepsGoogle = {}): Promise<OcupadoGoogle> {
  const token = await (deps.token ?? getGoogleAccessToken)(workspaceId, GOOGLE_CALENDAR_INTEGRATION_KEY);
  if (!token.ok) return token.reason === "NOT_CONNECTED" ? { estado: "SIN_GOOGLE" } : { estado: "FALLA" };
  try {
    const res = await (deps.fetchImpl ?? fetch)("https://www.googleapis.com/calendar/v3/freeBusy", {
      method: "POST",
      headers: { Authorization: `Bearer ${token.accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ timeMin: desde.toISOString(), timeMax: hasta.toISOString(), items: [{ id: "primary" }] }),
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) {
      console.error("[turnos][google] freeBusy falló", { codigo: `HTTP_${res.status}` });
      return { estado: "FALLA" };
    }
    const cuerpo = (await res.json()) as { calendars?: Record<string, { busy?: { start: string; end: string }[]; errors?: unknown[] }> };
    const primario = cuerpo.calendars?.primary;
    if (!primario || (primario.errors && primario.errors.length > 0)) return { estado: "FALLA" };
    const ocupado = (primario.busy ?? [])
      .map((b) => ({ startAt: new Date(b.start), endAt: new Date(b.end) }))
      .filter((b) => !Number.isNaN(b.startAt.getTime()) && !Number.isNaN(b.endAt.getTime()));
    return { estado: "OK", ocupado };
  } catch (error) {
    console.error("[turnos][google] freeBusy sin respuesta", { error: (error as { name?: string } | null)?.name ?? "desconocido" });
    return { estado: "FALLA" };
  }
}
