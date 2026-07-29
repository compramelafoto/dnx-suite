export const MINOR_CONSENT_VERSION = "fotorank-minor-auth-v1-2026";

export const MINOR_CONSENT_NOTICE =
  "Para participantes menores de 18 años, la inscripción requiere autorización de padre, madre o tutor legal.";

export type MinorAuthorizationInput = {
  guardianName: string;
  relationship: string;
  declarationAccepted: boolean;
};

export function requiresMinorAuthorization(declaredAgeYears: number | null | undefined): boolean {
  if (declaredAgeYears == null) return false;
  return declaredAgeYears >= 16 && declaredAgeYears < 18;
}

export function isAdultParticipant(declaredAgeYears: number | null | undefined): boolean {
  if (declaredAgeYears == null) return true;
  return declaredAgeYears >= 18;
}

export function assertMinorAuthorizationReady(input: {
  declaredAgeYears: number | null | undefined;
  minorAuth?: MinorAuthorizationInput | null;
}): void {
  if (!requiresMinorAuthorization(input.declaredAgeYears)) return;
  const auth = input.minorAuth;
  if (!auth?.declarationAccepted) {
    throw new Error("MINOR_AUTH_REQUIRED");
  }
  if (!auth.guardianName.trim() || !auth.relationship.trim()) {
    throw new Error("MINOR_AUTH_INCOMPLETE");
  }
}
