import "server-only";

/**
 * Le manda a cada participante su link de invitación.
 *
 * Dos modos, y la diferencia importa: `soloEmail` escribe a una sola
 * dirección —la prueba antes de escribirle a la comunidad entera— y sin él
 * escribe a todos los que tengan una inscripción confirmada.
 *
 * La `campaña` identifica el envío. Es lo que permite reusar la plantilla en
 * noviembre sin que la cola idempotente trate ese correo como un duplicado del
 * de septiembre.
 */
import { prisma } from "@repo/db";

import { esCuentaTecnica } from "../domain/cuenta-tecnica";
import { obtenerOCrearCodigoDeReferido } from "../infrastructure/prisma-referral-repository";
import { sendReferralInviteEmail } from "../notifications/referral-invite-email";

export type EnvioInvitacionesResultado = {
  destinatarios: number;
  enviados: number;
  yaEnviados: number;
  fallados: number;
};

export type EnvioInvitacionesInput = {
  campania: string;
  /** Sólo a esta dirección. Para probar antes del envío real. */
  soloEmail?: string | null;
  /**
   * Incluir a quien tiene cuenta pero nunca participó. Invitar está abierto a
   * todos, pero escribirle a alguien que nunca vino es otra decisión: se
   * elige por envío.
   */
  incluirNoParticipantes?: boolean;
};

/** A quién le tocaría, sin mandar nada. */
export async function listarDestinatariosDeInvitacion(input?: {
  soloEmail?: string | null;
  incluirNoParticipantes?: boolean;
}): Promise<Array<{ id: number; email: string; name: string | null }>> {
  const soloEmail = input?.soloEmail?.trim();
  const filas = await prisma.user.findMany({
    where: {
      ...(input?.incluirNoParticipantes
        ? {}
        : { clickatonRegistrations: { some: { status: "CONFIRMED" } } }),
      ...(soloEmail ? { email: { equals: soloEmail, mode: "insensitive" } } : {}),
    },
    select: { id: true, email: true, name: true },
    orderBy: { id: "asc" },
  });

  // Una prueba dirigida a una casilla técnica sí se manda: puede ser a
  // propósito. El envío masivo nunca las incluye.
  if (soloEmail) return filas;
  return filas.filter((u) => !esCuentaTecnica(u.email));
}

export async function enviarInvitacionesDeReferido(
  input: EnvioInvitacionesInput,
): Promise<EnvioInvitacionesResultado> {
  const destinatarios = await listarDestinatariosDeInvitacion({
    soloEmail: input.soloEmail,
    incluirNoParticipantes: input.incluirNoParticipantes,
  });

  let enviados = 0;
  let yaEnviados = 0;
  let fallados = 0;

  for (const u of destinatarios) {
    try {
      const codigo = await obtenerOCrearCodigoDeReferido(u.id);
      const colegas = await prisma.clickatonReferralAttribution.count({
        where: { referrerUserId: u.id, status: "EARNED" },
      });

      const r = await sendReferralInviteEmail({
        userId: u.id,
        to: u.email,
        firstName: u.name?.trim().split(/\s+/)[0] ?? null,
        code: codigo.code,
        colegas,
        campaignKey: input.campania,
      });

      if (r.status === "SENT" || r.status === "QUEUED") enviados += 1;
      else if (r.status === "ALREADY_SENT") yaEnviados += 1;
      else fallados += 1;
    } catch (error) {
      fallados += 1;
      console.error(`[clickaton] invitación a ${u.email} falló:`, error);
    }
  }

  return { destinatarios: destinatarios.length, enviados, yaEnviados, fallados };
}
