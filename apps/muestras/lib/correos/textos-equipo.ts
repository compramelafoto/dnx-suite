import { ACTIVITY_ROLE_LABELS, TEAM_ROLE_DESCRIPTIONS, formatArDay, type TeamRole } from "@repo/muestras";
import type { Texto } from "./textos-convocatoria";

/** Invitación al equipo de una muestra (etapa 5, D5). Puro, para poder probar el tono. */
export function textoInvitacionEquipo(p: { muestra: string; invita: string; rol: TeamRole; url: string; vence: Date }): Texto {
  return {
    subject: `Te invitaron al equipo de «${p.muestra}»`,
    parrafos: [
      "¡Hola!",
      `${p.invita} te invitó a sumarte al equipo de la muestra «${p.muestra}» en Muestras Fotográficas, con el rol ${ACTIVITY_ROLE_LABELS[p.rol]}.`,
      `Qué permite ese rol: ${TEAM_ROLE_DESCRIPTIONS[p.rol]}`,
      "Para aceptar, entrá con la cuenta de Google de este mail.",
      `La invitación sirve una sola vez y vence el ${formatArDay(p.vence)}.`,
    ],
    enlace: { texto: "Aceptar la invitación", url: p.url },
  };
}
