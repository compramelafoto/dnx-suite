// lib/suite-referral/decidir.ts
import { normalizeSuiteReferralCode } from "@repo/auth/suite-referral";

/**
 * Referidos de DNX Suite: decide si un alta se le avisa a CompraMeLaFoto.
 *
 * Sólo cuenta una cuenta recién CREADA. Si la persona ya tenía cuenta —inició sesión, o se la
 * reutilizó— no hay alta que atribuir, aunque traiga la cookie `dnx_ref`. Devuelve el código
 * listo para mandar, o null.
 */
export function codigoDeReferidoParaAlta(input: {
  cuentaCreada: boolean;
  cookie: string | undefined | null;
}): string | null {
  if (!input.cuentaCreada) return null;
  return normalizeSuiteReferralCode(input.cookie);
}
