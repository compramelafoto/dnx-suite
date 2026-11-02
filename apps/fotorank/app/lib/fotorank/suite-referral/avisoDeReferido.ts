import {
  normalizeSuiteReferralCode,
  type SuiteReferralSignupReport,
} from "@repo/auth/suite-referral";

/** Lo mínimo del usuario recién creado que necesita el aviso a CLF. */
export type UsuarioRecienCreado = {
  id: number | string;
  email: string;
  name?: string | null;
};

/**
 * Decide si hay que avisarle a ComprameLaFoto del alta y arma el aviso.
 * Sin código válido en la cookie `dnx_ref` no hay nada que avisar (null).
 * Sólo se llama cuando el usuario fue CREADO recién, nunca en un inicio de sesión.
 */
export function avisoDeReferido(
  valorDeLaCookie: string | undefined | null,
  usuario: UsuarioRecienCreado,
): SuiteReferralSignupReport | null {
  const code = normalizeSuiteReferralCode(valorDeLaCookie);
  if (!code) return null;
  const email = usuario.email?.trim();
  if (!email) return null;
  return {
    platform: "fotorank",
    code,
    externalUserId: usuario.id,
    email,
    name: usuario.name ?? null,
  };
}
