import { prisma } from "@repo/db";

import { prismaReferralRepository } from "../infrastructure/prisma-referral-repository";
import { atribuirReferido, type AtribuirReferidoResult } from "./atribuir-referido";

/**
 * Cuenta el colega traído una vez confirmado el pago de su inscripción.
 *
 * Se llama desde `confirmPaid`, el punto único por el que pasan los tres
 * caminos que confirman un pago (webhook, sondeo de estado, reconciliación).
 */
export async function atribuirReferidoDeInscripcion(input: {
  registrationId: string;
  referredUserId: number | null;
  referredEmail: string;
}): Promise<AtribuirReferidoResult | null> {
  const claim = await prisma.clickatonReferralClaim.findUnique({
    where: { registrationId: input.registrationId },
    select: { code: true },
  });
  // La mayoría de las inscripciones no vienen referidas.
  if (!claim) return null;

  const registro = await prisma.clickatonRegistration.findUnique({
    where: { id: input.registrationId },
    select: { editionId: true },
  });
  if (!registro) return null;

  return atribuirReferido(prismaReferralRepository, {
    code: claim.code,
    referredUserId: input.referredUserId,
    referredEmail: input.referredEmail,
    registrationId: input.registrationId,
    editionId: registro.editionId,
  });
}
