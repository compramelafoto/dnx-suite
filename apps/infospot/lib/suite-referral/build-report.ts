import {
  normalizeSuiteReferralCode,
  type SuiteReferralSignupReport,
} from "@repo/auth/suite-referral";

/** Usuario que Info Spot acaba de crear en su base. */
export type InfoSpotNewUser = {
  id: number | string;
  email: string;
  name?: string | null;
};

/**
 * Decide si hay que avisarle a CLF (función pura, sin red ni cookies).
 * Devuelve null si la cookie no trae un código válido o el usuario no tiene email.
 */
export function buildInfoSpotReferralReport(
  rawCookie: string | undefined | null,
  user: InfoSpotNewUser,
): SuiteReferralSignupReport | null {
  const code = normalizeSuiteReferralCode(rawCookie);
  if (!code) return null;
  const email = user.email?.trim();
  if (!email) return null;
  return {
    platform: "infospot",
    code,
    externalUserId: user.id,
    email,
    name: user.name ?? null,
  };
}
