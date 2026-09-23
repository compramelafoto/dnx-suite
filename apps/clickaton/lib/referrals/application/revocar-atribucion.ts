import type { ClickatonPaymentStatus } from "@/lib/registration/domain/types";
import type { ReferralRepository } from "../domain/repository";

/**
 * Un pago revertido no es un colega traído: el contador baja.
 *
 * `PARTIALLY_REFUNDED` **no** revoca. El colega vino, se inscribió y pagó;
 * que se le haya devuelto una parte no borra el trabajo de quien lo trajo.
 * `MANUAL_REVIEW` tampoco: no es una caída, es un pago que alguien va a mirar.
 */
const ESTADOS_QUE_REVOCAN = new Set<ClickatonPaymentStatus>([
  "FAILED",
  "EXPIRED",
  "CANCELLED",
  "REFUNDED",
]);

export function debeRevocarPorEstadoDePago(status: ClickatonPaymentStatus): boolean {
  return ESTADOS_QUE_REVOCAN.has(status);
}

export async function revocarAtribucionPorPago(
  repo: ReferralRepository,
  input: { registrationId: string; reason: string },
): Promise<{ revocada: boolean }> {
  const revocada = await repo.revokeAttribution(input);
  return { revocada: revocada != null };
}
