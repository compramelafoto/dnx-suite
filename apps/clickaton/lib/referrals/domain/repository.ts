import type { AtribucionOutcome } from "./atribucion";

export type ReferralCodeRecord = {
  id: string;
  userId: number;
  code: string;
  isActive: boolean;
};

export type ReferralAttributionRecord = {
  id: string;
  referrerUserId: number;
  referredUserId: number;
  referredEmail: string;
  referralCodeId: string;
  registrationId: string;
  editionId: string;
  status: "EARNED" | "CONSUMED" | "REVOKED";
  earnedAt: Date;
  revokedAt: Date | null;
  revokedReason: string | null;
  consumedAt: Date | null;
  consumedRegistrationId: string | null;
};

export type ReferralAttemptInput = {
  code: string;
  outcome: AtribucionOutcome;
  referrerUserId?: number | null;
  referredUserId?: number | null;
  referredEmail?: string | null;
  registrationId?: string | null;
  detail?: string | null;
};

export interface ReferralRepository {
  findCodeByCode(code: string): Promise<ReferralCodeRecord | null>;
  findCodeByUserId(userId: number): Promise<ReferralCodeRecord | null>;
  createCode(input: { userId: number; code: string }): Promise<ReferralCodeRecord>;

  /** Email del usuario, para detectar la autorreferencia con otra cuenta. */
  findUserEmail(userId: number): Promise<string | null>;
  /** Sólo refiere quien tenga una inscripción CONFIRMED. */
  tieneInscripcionConfirmada(userId: number): Promise<boolean>;

  /** La atribución que ya recibió esa persona, si la hay (una por vida). */
  findAttributionByReferredUserId(
    referredUserId: number,
  ): Promise<ReferralAttributionRecord | null>;
  findAttributionByRegistrationId(
    registrationId: string,
  ): Promise<ReferralAttributionRecord | null>;

  createAttribution(input: {
    referrerUserId: number;
    referredUserId: number;
    referredEmail: string;
    referralCodeId: string;
    registrationId: string;
    editionId: string;
  }): Promise<ReferralAttributionRecord>;

  revokeAttribution(input: {
    registrationId: string;
    reason: string;
  }): Promise<ReferralAttributionRecord | null>;

  /** Atribuciones EARNED del referidor: el contador de la escalera. */
  contarColegasTraidos(referrerUserId: number): Promise<number>;

  recordAttempt(input: ReferralAttemptInput): Promise<void>;
}
