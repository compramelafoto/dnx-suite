import { prisma } from "@repo/db";

import { prismaReferralRepository } from "../infrastructure/prisma-referral-repository";
import { liberarCanje } from "./canjear-beneficio";

/**
 * Devuelve al referidor los colegas que había tomado una inscripción que no
 * llegó a pagarse.
 *
 * Libera por dos caminos a propósito. La reserva nace atada a la clave de
 * idempotencia y después se mueve al id de la inscripción; si ese traspaso
 * falló, quedó colgada de la clave y liberar sólo por id la dejaría tomada
 * para siempre. Buscar por las dos garantiza que los colegas siempre vuelven.
 */
export async function liberarReferidosDeInscripcionVencida(
  registrationId: string,
): Promise<{ liberados: number }> {
  const porInscripcion = await liberarCanje(prismaReferralRepository, { registrationId });

  // La clave de idempotencia de la inscripción se guarda en
  // `paymentIdempotencyKey`; es la misma con la que se armó el `ref`.
  const registro = await prisma.clickatonRegistration.findUnique({
    where: { id: registrationId },
    select: { paymentIdempotencyKey: true },
  });
  if (!registro?.paymentIdempotencyKey) return porInscripcion;

  const porClave = await liberarCanje(prismaReferralRepository, {
    registrationId: `clickaton:ref:${registro.paymentIdempotencyKey}`,
  });

  return { liberados: porInscripcion.liberados + porClave.liberados };
}
