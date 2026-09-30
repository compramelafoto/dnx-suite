import "server-only";

/**
 * Le cuenta a los fotógrafos de las otras plataformas de la casa que existe
 * Clickatón.
 *
 * **Va por tandas a propósito.** Son cientos de direcciones que nunca
 * interactuaron con Clickatón: mandarlas todas juntas es la forma más rápida
 * de juntar quejas de spam y arruinar la reputación del dominio. Y lo que se
 * cae con la reputación no es este correo, son las confirmaciones de pago y
 * las acreditaciones.
 *
 * Nunca se le escribe dos veces a la misma persona en la misma campaña, ni a
 * quien pidió no recibir más.
 */
import { prisma } from "@repo/db";

import { esCuentaTecnica } from "../domain/cuenta-tecnica";
import {
  sendOutreachInviteEmail,
} from "../notifications/outreach-invite-email";
import type { OrigenOutreach } from "../notifications/outreach-invite-content";

/** Tope por tanda. Con 666 contactos, el envío entero lleva varios días. */
export const TANDA_MAXIMA = 150;

export type EnvioOutreachResultado = {
  pendientesAntes: number;
  intentados: number;
  enviados: number;
  yaEnviados: number;
  fallados: number;
  pendientesDespues: number;
};

function primerNombre(name: string | null): string | null {
  const limpio = name?.trim();
  if (!limpio) return null;
  const primera = limpio.split(/\s+/)[0] ?? "";
  // Un "nombre" que en realidad es el email no sirve para saludar.
  if (primera.includes("@")) return null;
  return primera || null;
}

/** Cuántos quedan sin recibir esta campaña. */
export async function contarPendientesDeOutreach(campania: string): Promise<number> {
  return prisma.clickatonOutreachContact.count({
    where: {
      optedOutAt: null,
      OR: [{ lastCampaign: null }, { lastCampaign: { not: campania } }],
    },
  });
}

export async function enviarOutreach(input: {
  campania: string;
  limite: number;
  soloEmail?: string | null;
}): Promise<EnvioOutreachResultado> {
  const soloEmail = input.soloEmail?.trim().toLowerCase();
  const limite = Math.max(1, Math.min(input.limite, TANDA_MAXIMA));

  const pendientesAntes = await contarPendientesDeOutreach(input.campania);

  const contactos = await prisma.clickatonOutreachContact.findMany({
    where: soloEmail
      ? { email: soloEmail }
      : {
          optedOutAt: null,
          OR: [{ lastCampaign: null }, { lastCampaign: { not: input.campania } }],
        },
    // Los que nunca recibieron nada primero.
    orderBy: [{ lastSentAt: { sort: "asc", nulls: "first" } }, { email: "asc" }],
    take: soloEmail ? 1 : limite,
  });

  let enviados = 0;
  let yaEnviados = 0;
  let fallados = 0;

  for (const c of contactos) {
    if (esCuentaTecnica(c.email)) continue;
    try {
      const r = await sendOutreachInviteEmail({
        to: c.email,
        firstName: primerNombre(c.name),
        origen: c.origen as OrigenOutreach,
        campaignKey: input.campania,
      });

      if (r.status === "SENT" || r.status === "QUEUED") enviados += 1;
      else if (r.status === "ALREADY_SENT") yaEnviados += 1;
      else fallados += 1;

      if (r.status !== "FAILED") {
        await prisma.clickatonOutreachContact.update({
          where: { id: c.id },
          data: { lastSentAt: new Date(), lastCampaign: input.campania },
        });
      }
    } catch (error) {
      fallados += 1;
      console.error(`[clickaton] outreach a ${c.email} falló:`, error);
    }
  }

  return {
    pendientesAntes,
    intentados: contactos.length,
    enviados,
    yaEnviados,
    fallados,
    pendientesDespues: await contarPendientesDeOutreach(input.campania),
  };
}
