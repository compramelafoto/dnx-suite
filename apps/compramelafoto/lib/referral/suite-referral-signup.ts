/**
 * Registro central de altas referidas en otras plataformas de DNX Suite.
 * Las plataformas avisan por POST /api/referrals/suite-signup; acá se decide y se guarda.
 * Sólo registra quién refirió a quién: no genera comisiones.
 */

import { timingSafeEqual } from "node:crypto";
import {
  isSuiteReferralPlatform,
  normalizeSuiteReferralCode,
  type SuiteReferralPlatform,
} from "@repo/auth/suite-referral";

export type SuiteReferralSignupInput = {
  platform: SuiteReferralPlatform;
  code: string;
  externalUserId: string;
  email: string;
  name: string | null;
};

export type SuiteReferralOutcome = "CREATED" | "CODE_NOT_FOUND" | "SELF_REFERRAL";

export function parseSuiteReferralSignupBody(
  body: unknown,
): { ok: true; input: SuiteReferralSignupInput } | { ok: false; error: string } {
  if (!body || typeof body !== "object") return { ok: false, error: "Body inválido" };
  const b = body as Record<string, unknown>;
  if (!isSuiteReferralPlatform(b.platform)) return { ok: false, error: "Plataforma inválida" };
  const code = normalizeSuiteReferralCode(b.code);
  if (!code) return { ok: false, error: "Código inválido" };
  const externalUserId = typeof b.externalUserId === "string" ? b.externalUserId.trim() : "";
  if (!externalUserId || externalUserId.length > 100) {
    return { ok: false, error: "Usuario inválido" };
  }
  const email = typeof b.email === "string" ? b.email.trim().toLowerCase() : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 320) {
    return { ok: false, error: "Email inválido" };
  }
  const name =
    typeof b.name === "string" && b.name.trim() ? b.name.trim().slice(0, 200) : null;
  return { ok: true, input: { platform: b.platform, code, externalUserId, email, name } };
}

/** Compara el secreto sin filtrar su largo por tiempos. */
export function isValidSuiteReferralSecret(
  received: string | null,
  expected: string | undefined,
): boolean {
  if (!received || !expected) return false;
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function decideSuiteReferralOutcome(
  referrer: { email: string } | null,
  signupEmail: string,
): SuiteReferralOutcome {
  if (!referrer) return "CODE_NOT_FOUND";
  if (referrer.email.trim().toLowerCase() === signupEmail.trim().toLowerCase()) {
    return "SELF_REFERRAL";
  }
  return "CREATED";
}

type SuiteReferralDb = {
  referralCode: {
    findFirst(args: {
      where: { code: { equals: string; mode: "insensitive" }; isActive: true };
      select: { id: true; ownerUserId: true; ownerUser: { select: { email: true } } };
    }): Promise<{ id: number; ownerUserId: number; ownerUser: { email: string } } | null>;
  };
  suiteReferralSignup: {
    upsert(args: {
      where: { platform_externalUserId: { platform: string; externalUserId: string } };
      create: Record<string, unknown>;
      update: Record<string, never>;
    }): Promise<{ id: number; outcome: string }>;
  };
};

/**
 * Guarda el alta. Es idempotente por (plataforma, usuario): si la plataforma avisa
 * dos veces, queda la primera.
 */
export async function recordSuiteReferralSignup(
  db: SuiteReferralDb,
  input: SuiteReferralSignupInput,
): Promise<{ id: number; outcome: string }> {
  const referralCode = await db.referralCode.findFirst({
    where: { code: { equals: input.code, mode: "insensitive" }, isActive: true },
    select: { id: true, ownerUserId: true, ownerUser: { select: { email: true } } },
  });
  const outcome = decideSuiteReferralOutcome(
    referralCode ? referralCode.ownerUser : null,
    input.email,
  );
  const credited = outcome === "CREATED";
  return db.suiteReferralSignup.upsert({
    where: {
      platform_externalUserId: {
        platform: input.platform,
        externalUserId: input.externalUserId,
      },
    },
    create: {
      platform: input.platform,
      externalUserId: input.externalUserId,
      email: input.email,
      name: input.name,
      refCode: input.code,
      referralCodeId: referralCode?.id ?? null,
      referrerUserId: credited ? referralCode!.ownerUserId : null,
      outcome,
    },
    update: {},
  });
}

export const SUITE_REFERRAL_PLATFORM_LABEL: Record<SuiteReferralPlatform, string> = {
  fotoffice: "FOTOFFICE",
  fotorank: "FotoRank",
  muestras: "Muestras Fotográficas",
  subilafoto: "SubiLaFoto",
  infospot: "Info Spot",
  clickaton: "Clickatón",
};
