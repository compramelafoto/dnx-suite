import { normalizeSuiteReferralCode } from "@repo/auth/suite-referral";

/**
 * Referidos de DNX Suite en SubiLaFoto: el proxy guarda el `?dnx_ref=` en la cookie `dnx_ref`
 * y, cuando esa persona crea su cuenta acá, se le avisa a ComprameLaFoto quién la refirió.
 *
 * Decide qué código reportar: sólo cuando la cuenta se CREÓ en este ingreso (no cuando ya
 * existía y sólo inició sesión) y la cookie trae un código válido. `null` = no avisar nada.
 */
export function codigoDeReferidoParaReportar(
  cuentaCreada: boolean,
  valorCookie: string | undefined | null,
): string | null {
  if (!cuentaCreada) return null;
  return normalizeSuiteReferralCode(valorCookie);
}
