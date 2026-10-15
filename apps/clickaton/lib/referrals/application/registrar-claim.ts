import { cookies } from "next/headers";

import { prisma } from "@repo/db";

import { normalizeReferralCode } from "../domain/code";
import { REFERRAL_COOKIE_NAME } from "../domain/cookie";

/**
 * Anota con qué link de invitación llegó una inscripción recién creada.
 *
 * La cookie `ck_ref` sólo existe acá, en el navegador de quien se inscribe.
 * `confirmPaid` corre después en el webhook, sin navegador, así que el código
 * tiene que quedar guardado ahora o se pierde.
 *
 * Best-effort: una inscripción **nunca** se cae porque falle el programa de
 * referidos.
 */
export async function registrarClaimDeReferido(registrationId: string): Promise<void> {
  try {
    const jar = await cookies();
    const code = normalizeReferralCode(jar.get(REFERRAL_COOKIE_NAME)?.value ?? "");
    if (!code) return;

    // La misma inscripción puede reenviarse (idempotencyKey): el claim que
    // vale es el primero, no el último.
    await prisma.clickatonReferralClaim.createMany({
      data: [{ registrationId, code }],
      skipDuplicates: true,
    });
  } catch (error) {
    console.error("[clickaton] registrarClaimDeReferido falló:", error);
  }
}
