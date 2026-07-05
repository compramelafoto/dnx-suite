import { ReferralProgram, Role } from "@/lib/prisma";

export { ReferralProgram };

/** Programa por defecto: compatibilidad con atribuciones y earnings existentes. */
export const DEFAULT_REFERRAL_PROGRAM = ReferralProgram.PHOTOGRAPHER_REFERRAL;

/** Porcentaje del marketplace fee efectivo por programa de referidos. */
export const REFERRAL_PROGRAM_FEE_SHARE: Record<ReferralProgram, number> = {
  [ReferralProgram.PHOTOGRAPHER_REFERRAL]: 0.5,
  [ReferralProgram.ORGANIZER_REFERRAL]: 0.2,
};

export function isReferralProgram(value: string): value is ReferralProgram {
  return (
    value === ReferralProgram.PHOTOGRAPHER_REFERRAL ||
    value === ReferralProgram.ORGANIZER_REFERRAL
  );
}

/**
 * Inferencia de programa según rol del referido (registro manual / admin).
 * El registro automático usará la misma regla en fases posteriores.
 */
export function inferReferralProgramForReferredUserRole(
  role: Role | string
): ReferralProgram {
  if (role === Role.ORGANIZER) {
    return ReferralProgram.ORGANIZER_REFERRAL;
  }
  return ReferralProgram.PHOTOGRAPHER_REFERRAL;
}

export function referralProgramLabel(program: ReferralProgram): string {
  switch (program) {
    case ReferralProgram.ORGANIZER_REFERRAL:
      return "Organizador referido";
    case ReferralProgram.PHOTOGRAPHER_REFERRAL:
    default:
      return "Fotógrafo referido";
  }
}
