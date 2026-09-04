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

/**
 * `referrerHasMp` queda como dato informativo y NO bloquea la atribución: el
 * referidor puede conectar Mercado Pago después del alta de su referido, y antes
 * ese caso se descartaba para siempre y sin dejar rastro. Los chequeos que sí
 * bloquean son los anti-abuso reales (auto-referencia, mismo email, misma cuenta MP).
 */
export function shouldCreateReferralSignupAttribution(
  checks: ReferralSignupAttributionChecks
): boolean {
  return (
    checks.referralCodeFound &&
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

/** Motivo por el que un alta con código de referido no terminó en atribución. */
export function describeAttributionOutcome(
  checks: ReferralSignupAttributionChecks
): string {
  if (!checks.notSelf) return "SELF_REFERRAL";
  if (!checks.emailDifferent) return "SAME_EMAIL";
  if (!checks.mpDifferent) return "SAME_MP";
  return "UNKNOWN";
}

/**
 * Deja constancia del intento (creado o descartado) para poder auditarlo después.
 * Nunca lanza ni bloquea: si la tabla todavía no existe en esta base, se ignora.
 */
async function recordAttributionAttempt(params: {
  refCode: string;
  referredUserId: number | null;
  referredEmail: string | null;
  referrerUserId: number | null;
  outcome: string;
  detail?: string | null;
  logContext: string;
}): Promise<void> {
  try {
    await prisma.referralAttributionAttempt.create({
      data: {
        refCode: params.refCode,
        referredUserId: params.referredUserId,
        referredEmail: params.referredEmail,
        referrerUserId: params.referrerUserId,
        outcome: params.outcome,
        detail: params.detail ?? null,
        logContext: params.logContext,
      },
    });
  } catch (err) {
    console.warn(
      `${params.logContext}: no se pudo registrar el intento de atribución (${params.outcome})`,
      err
    );
  }
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
      await recordAttributionAttempt({
        refCode,
        referredUserId: input.referredUserId,
        referredEmail: input.referredUserEmail,
        referrerUserId: null,
        outcome: "CODE_NOT_FOUND",
        logContext: input.logContext,
      });
      return { created: false };
    }

    const checks = passesReferralSignupAttributionChecks({
      referrer: referralCode.ownerUser,
      referredUserId: input.referredUserId,
      referredUserEmail: input.referredUserEmail,
      referredUserMpUserId: input.referredUserMpUserId,
    });

    if (!shouldCreateReferralSignupAttribution(checks)) {
      await recordAttributionAttempt({
        refCode,
        referredUserId: input.referredUserId,
        referredEmail: input.referredUserEmail,
        referrerUserId: referralCode.ownerUser.id,
        outcome: describeAttributionOutcome(checks),
        logContext: input.logContext,
      });
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

    await recordAttributionAttempt({
      refCode,
      referredUserId: input.referredUserId,
      referredEmail: input.referredUserEmail,
      referrerUserId: referralCode.ownerUser.id,
      outcome: "CREATED",
      detail: checks.referrerHasMp ? null : "referidor sin Mercado Pago al momento del alta",
      logContext: input.logContext,
    });

    return { created: true };
  } catch (attrErr) {
    console.warn(`${input.logContext}: atribución referido fallida (se ignora)`, attrErr);
    // P2002 = el referido ya tenía una atribución (referredUserId es único).
    const alreadyAttributed = (attrErr as { code?: string })?.code === "P2002";
    await recordAttributionAttempt({
      refCode,
      referredUserId: input.referredUserId,
      referredEmail: input.referredUserEmail,
      referrerUserId: null,
      outcome: alreadyAttributed ? "ALREADY_ATTRIBUTED" : "ERROR",
      detail: alreadyAttributed
        ? null
        : attrErr instanceof Error
          ? attrErr.message.slice(0, 500)
          : String(attrErr).slice(0, 500),
      logContext: input.logContext,
    });
    return { created: false };
  }
}
