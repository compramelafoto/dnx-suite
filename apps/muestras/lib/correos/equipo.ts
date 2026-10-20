import "server-only";
import { TEAM_INVITATION_TTL_DAYS, type TeamRole } from "@repo/muestras";
import { APP_URL, enviar } from "./enviar";
import { textoInvitacionEquipo } from "./textos-equipo";

/** Enlace que acepta la invitación al equipo: el mismo que va en el correo. */
export const enlaceDeInvitacionEquipo = (token: string) => `${APP_URL}/panel/equipo/invitacion/${token}`;

/**
 * Devuelve si el correo salió y el enlace: si no salió (hoy el correo está apagado en
 * producción), quien invita lo recibe para mandarlo a mano. Nunca tira.
 */
export async function avisarInvitacionEquipo(p: { email: string; token: string; muestra: string; rol: TeamRole; invita: string; invitedAt: Date }): Promise<{ enviado: boolean; url: string }> {
  const url = enlaceDeInvitacionEquipo(p.token);
  try {
    const vence = new Date(p.invitedAt.getTime() + TEAM_INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000);
    const t = textoInvitacionEquipo({ muestra: p.muestra, invita: p.invita, rol: p.rol, vence, url });
    return { enviado: await enviar(p.email, t.subject, t.parrafos, t.enlace), url };
  } catch (err) {
    console.error("[muestras] falló la invitación al equipo", err);
    return { enviado: false, url };
  }
}
