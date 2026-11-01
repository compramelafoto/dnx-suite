import { normalizeSuiteReferralCode } from "@repo/auth/suite-referral";

/**
 * Referidos de DNX Suite en Clickatón (código `dnx_ref` de ComprameLaFoto).
 *
 * No confundir con el programa propio de Clickatón (`ck_ref`, `lib/referrals`):
 * los dos conviven y no se tocan.
 */

/** Acción del registro de auditoría donde la inscripción guarda el código. */
export const SUITE_REFERRAL_AUDIT_ACTION = "SUITE_REFERRAL_CAPTURED";

/**
 * Lee el código guardado en el `metadata` de la auditoría de la inscripción.
 * Devuelve null ante cualquier forma inesperada.
 */
export function suiteReferralCodeFromAuditMetadata(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  return normalizeSuiteReferralCode((metadata as Record<string, unknown>).code);
}

/**
 * Sólo se avisa a CLF cuando la cuenta se creó recién y hay un código válido.
 * Un inicio de sesión o una cuenta que ya existía nunca cuentan como alta referida.
 */
export function suiteReferralCodeToReport(input: {
  created: boolean;
  code: unknown;
}): string | null {
  if (!input.created) return null;
  return normalizeSuiteReferralCode(input.code);
}
