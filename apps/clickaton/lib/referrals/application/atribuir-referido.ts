import { evaluarAtribucion, type AtribucionOutcome } from "../domain/atribucion";
import { normalizeReferralCode } from "../domain/code";
import type { ReferralRepository } from "../domain/repository";

export type AtribuirReferidoInput = {
  /** Código crudo de la cookie `ck_ref`. */
  code: string;
  referredUserId: number | null;
  referredEmail: string;
  registrationId: string;
  editionId: string;
};

export type AtribuirReferidoResult = {
  outcome: AtribucionOutcome;
  /** true cuando la atribución ya estaba hecha (reproceso del mismo pago). */
  yaExistia: boolean;
};

/**
 * Cuenta un colega traído, una vez confirmado el pago de su inscripción.
 *
 * Se llama desde `confirmPaid`, el punto único por el que pasan los tres
 * caminos que confirman un pago. Es best-effort: si falla, el pago no se
 * revierte y el intento queda registrado para reprocesar.
 */
export async function atribuirReferido(
  repo: ReferralRepository,
  input: AtribuirReferidoInput,
): Promise<AtribuirReferidoResult> {
  const code = normalizeReferralCode(input.code);

  // La mayoría de las inscripciones no vienen referidas: salir sin registrar
  // nada evita llenar la auditoría de ruido.
  if (!code) {
    return { outcome: "CODE_NOT_FOUND", yaExistia: false };
  }

  // Idempotencia: los tres caminos que confirman un pago pueden pisarse.
  const yaHecha = await repo.findAttributionByRegistrationId(input.registrationId);
  if (yaHecha && yaHecha.status !== "REVOKED") {
    return { outcome: "CREATED", yaExistia: true };
  }

  const codigo = await repo.findCodeByCode(code);
  const referidorUserId = codigo?.userId ?? null;

  const [referidorEmail, atribucionPrevia] = await Promise.all([
    referidorUserId != null ? repo.findUserEmail(referidorUserId) : Promise.resolve(null),
    input.referredUserId != null
      ? repo.findAttributionByReferredUserId(input.referredUserId)
      : Promise.resolve(null),
  ]);

  const evaluacion = evaluarAtribucion({
    codigoEncontrado: Boolean(codigo),
    codigoActivo: codigo?.isActive ?? false,
    referidorUserId,
    referidorEmail,
    referidoUserId: input.referredUserId,
    referidoEmail: input.referredEmail,
    yaTieneAtribucion: atribucionPrevia != null,
  });

  const registrarIntento = (detail?: string) =>
    repo.recordAttempt({
      code,
      outcome: evaluacion.outcome,
      referrerUserId: referidorUserId,
      referredUserId: input.referredUserId,
      referredEmail: input.referredEmail,
      registrationId: input.registrationId,
      detail: detail ?? null,
    });

  if (!evaluacion.ok) {
    await registrarIntento();
    return { outcome: evaluacion.outcome, yaExistia: false };
  }

  // Los guardas de evaluarAtribucion ya garantizan estos dos valores; el
  // chequeo es para el compilador.
  if (!codigo || input.referredUserId == null) {
    await repo.recordAttempt({
      code,
      outcome: "ERROR",
      registrationId: input.registrationId,
      detail: "estado inconsistente tras evaluar",
    });
    return { outcome: "ERROR", yaExistia: false };
  }

  await repo.createAttribution({
    referrerUserId: codigo.userId,
    referredUserId: input.referredUserId,
    referredEmail: input.referredEmail,
    referralCodeId: codigo.id,
    registrationId: input.registrationId,
    editionId: input.editionId,
  });
  await registrarIntento();

  return { outcome: "CREATED", yaExistia: false };
}
