import "server-only";
import { prisma } from "@repo/db";
import type { Interval } from "@/lib/bookings/time";
import type { AjustesTurnos } from "./constantes";
import { agruparPorDia, horariosLibres, ventanaDeBusqueda, type DiaConHorarios } from "./disponibilidad";
import { ocupadoEnGoogle } from "./google-ocupado";
import { ocupadoEnAgenda, type NegocioPublico, type TipoPublicado } from "./publico";

/**
 * Lo que necesita la página pública: los horarios libres de un tipo, juntando Agenda y Google.
 * Si Google está conectado y no responde, no se ofrece nada (`ok: false`).
 */
export type HorariosPublicos = { ok: true; dias: DiaConHorarios[]; ocupadoGoogle: Interval[] } | { ok: false };

export async function ocupadoGoogleDeLaVentana(workspaceId: string, ajustes: AjustesTurnos, ahora: Date): Promise<{ ok: true; ocupado: Interval[] } | { ok: false }> {
  const v = ventanaDeBusqueda(ahora, ajustes.maxAdvanceDays);
  const g = await ocupadoEnGoogle(workspaceId, v.startAt, v.endAt);
  if (g.estado === "FALLA") return { ok: false };
  return { ok: true, ocupado: g.estado === "OK" ? g.ocupado : [] };
}

export async function horariosPublicos(
  negocio: NegocioPublico,
  tipo: TipoPublicado,
  ajustes: AjustesTurnos,
  ahora: Date,
  excluirCitaId: string | null = null,
): Promise<HorariosPublicos> {
  const v = ventanaDeBusqueda(ahora, ajustes.maxAdvanceDays);
  const [google, agenda] = await Promise.all([
    ocupadoGoogleDeLaVentana(negocio.workspaceId, ajustes, ahora),
    ocupadoEnAgenda(prisma, { workspaceId: negocio.workspaceId, hostUserId: negocio.hostUserId, desde: v.startAt, hasta: v.endAt, excluirCitaId }),
  ]);
  if (!google.ok) return { ok: false };
  const libres = horariosLibres({
    reglas: { durationMinutes: tipo.durationMinutes, bufferMinutes: ajustes.bufferMinutes, minAdvanceHours: ajustes.minAdvanceHours, maxAdvanceDays: ajustes.maxAdvanceDays },
    franjas: tipo.franjas,
    ocupado: [...agenda, ...google.ocupado],
    ahora,
  });
  return { ok: true, dias: agruparPorDia(libres), ocupadoGoogle: google.ocupado };
}
