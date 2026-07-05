import { ReferralProgram, TalkStatus } from "@/lib/prisma";
import { prisma } from "@/lib/prisma";

const ATTRIBUTION_YEARS = 1;

export type ReferralSignupAttributionInput = {
  referredUserId: number;
  referredUserEmail: string;
  referredUserMpUserId?: string | null;
  referralProgram: ReferralProgram;
  refCode: string;
  sourceTypeRaw?: string;
  sourceEntityRaw?: unknown;
  logContext: string;
};

export type ReferralSignupAttributionChecks = {
  referralCodeFound: boolean;
  referrerHasMp: boolean;
  notSelf: boolean;
  emailDifferent: boolean;
  mpDifferent: boolean;
};

/** Validaciones puras anti-abuso (mismas reglas que registro fotógrafo). */
export function passesReferralSignupAttributionChecks(input: {
  referrer: {
    id: number;
    email: string;
    mpUserId: string | null;
    mpConnectedAt: Date | null;
  };
  referredUserId: number;
  referredUserEmail: string;
  referredUserMpUserId?: string | null;
}): ReferralSignupAttributionChecks {
  const referrerHasMp = !!(input.referrer.mpUserId || input.referrer.mpConnectedAt);
  const notSelf = input.referrer.id !== input.referredUserId;
  const emailDifferent =
    input.referrer.email.toLowerCase() !== input.referredUserEmail.toLowerCase();
  const mpDifferent =
    !input.referrer.mpUserId ||
    input.referrer.mpUserId !== (input.referredUserMpUserId ?? null);

  return {
    referralCodeFound: true,
    referrerHasMp,
    notSelf,
    emailDifferent,
    mpDifferent,
  };
}

export function shouldCreateReferralSignupAttribution(
  checks: ReferralSignupAttributionChecks
): boolean {
  return (
    checks.referralCodeFound &&
    checks.referrerHasMp &&
    checks.notSelf &&
    checks.emailDifferent &&
    checks.mpDifferent
  );
}

export async function resolveReferralAttributionSource(input: {
  refCode: string;
  sourceTypeRaw?: string;
  sourceEntityRaw?: unknown;
}): Promise<{ sourceType: string; sourceEntityId: number | null }> {
  let sourceType = "GENERAL";
  let sourceEntityId: number | null = null;

  const sourceTypeRaw = input.sourceTypeRaw?.trim().toUpperCase();
  if (
    !input.refCode.trim() ||
    sourceTypeRaw !== "TRAINING" ||
    input.sourceEntityRaw === undefined ||
    input.sourceEntityRaw === null
  ) {
    return { sourceType, sourceEntityId };
  }

  const eid =
    typeof input.sourceEntityRaw === "number"
      ? input.sourceEntityRaw
      : parseInt(String(input.sourceEntityRaw), 10);

  if (Number.isNaN(eid) || eid <= 0) {
    return { sourceType, sourceEntityId };
  }

  const talk = await prisma.talk.findFirst({
    where: { id: eid, status: TalkStatus.PUBLISHED },
    select: { id: true },
  });

  if (talk) {
    sourceType = "TRAINING";
    sourceEntityId = eid;
  }

  return { sourceType, sourceEntityId };
}

/**
 * Crea ReferralAttribution tras el alta si el ref es válido y pasa anti-abuso.
 * Nunca lanza: fallos de atribución no bloquean el registro.
 */
export async function tryCreateReferralAttributionOnSignup(
  input: ReferralSignupAttributionInput
): Promise<{ created: boolean }> {
  const refCode = input.refCode.trim();
  if (!refCode) {
    return { created: false };
  }

  try {
    const referralCode = await prisma.referralCode.findUnique({
      where: { code: refCode, isActive: true },
      include: {
        ownerUser: {
          select: {
            id: true,
            email: true,
            mpUserId: true,
            mpConnectedAt: true,
          },
        },
      },
    });

    if (!referralCode?.ownerUser) {
      return { created: false };
    }

    const checks = passesReferralSignupAttributionChecks({
      referrer: referralCode.ownerUser,
      referredUserId: input.referredUserId,
      referredUserEmail: input.referredUserEmail,
      referredUserMpUserId: input.referredUserMpUserId,
    });

    if (!shouldCreateReferralSignupAttribution(checks)) {
      return { created: false };
    }

    const { sourceType, sourceEntityId } = await resolveReferralAttributionSource({
      refCode,
      sourceTypeRaw: input.sourceTypeRaw,
      sourceEntityRaw: input.sourceEntityRaw,
    });

    const startsAt = new Date();
    const endsAt = new Date(startsAt);
    endsAt.setFullYear(endsAt.getFullYear() + ATTRIBUTION_YEARS);

    await prisma.referralAttribution.create({
      data: {
        referralCodeId: referralCode.id,
        referrerUserId: referralCode.ownerUser.id,
        referredUserId: input.referredUserId,
        referralProgram: input.referralProgram,
        sourceType,
        sourceEntityId,
        startsAt,
        endsAt,
        status: "ACTIVE",
      },
    });

    return { created: true };
  } catch (attrErr) {
    console.warn(`${input.logContext}: atribución referido fallida (se ignora)`, attrErr);
    return { created: false };
  }
}
