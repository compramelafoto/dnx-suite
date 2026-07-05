import { prisma } from "@/lib/prisma";
import { getOrCreateReferralCodeForUser } from "@/lib/referral-code-service";
import { isReferralActive } from "@/lib/referral-helpers";
import {
  DEFAULT_REFERRAL_PROGRAM,
  inferReferralProgramForReferredUserRole,
  type ReferralProgram,
} from "@/lib/referral/referral-program";

const ATTRIBUTION_YEARS = 1;
export const REFERRAL_SOURCE_ADMIN_MANUAL = "ADMIN_MANUAL";

export type ReferralAttributionAdminView = {
  id: number;
  referrerUserId: number;
  referredUserId: number;
  startsAt: string;
  endsAt: string;
  status: string;
  sourceType: string;
  referralProgram: ReferralProgram;
  isEffectivelyActive: boolean;
  referralCode: string;
  referrer: {
    id: number;
    email: string;
    name: string | null;
    role: string;
    mpConnected: boolean;
  };
  earningsCount: number;
};

function addYears(date: Date, years: number): Date {
  const end = new Date(date);
  end.setFullYear(end.getFullYear() + years);
  return end;
}

function parseStartsAt(input: string): Date | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const d = new Date(trimmed.includes("T") ? trimmed : `${trimmed}T12:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

export async function getReferralAttributionForReferredUser(
  referredUserId: number
): Promise<ReferralAttributionAdminView | null> {
  const row = await prisma.referralAttribution.findUnique({
    where: { referredUserId },
    include: {
      referralCode: { select: { code: true } },
      referrerUser: {
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          mpUserId: true,
          mpConnectedAt: true,
        },
      },
      _count: { select: { earnings: true } },
    },
  });
  if (!row) return null;

  return {
    id: row.id,
    referrerUserId: row.referrerUserId,
    referredUserId: row.referredUserId,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt.toISOString(),
    status: row.status,
    sourceType: row.sourceType,
    referralProgram: row.referralProgram,
    isEffectivelyActive: isReferralActive(row),
    referralCode: row.referralCode.code,
    referrer: {
      id: row.referrerUser.id,
      email: row.referrerUser.email,
      name: row.referrerUser.name,
      role: row.referrerUser.role,
      mpConnected: !!(row.referrerUser.mpUserId || row.referrerUser.mpConnectedAt),
    },
    earningsCount: row._count.earnings,
  };
}

export async function validateManualReferralAssignment(
  referrerUserId: number,
  referredUserId: number
): Promise<{ ok: true; warnings: string[] } | { ok: false; error: string }> {
  if (referrerUserId === referredUserId) {
    return { ok: false, error: "El referidor y el referido no pueden ser el mismo usuario." };
  }

  const [referrer, referred] = await Promise.all([
    prisma.user.findUnique({
      where: { id: referrerUserId },
      select: {
        id: true,
        email: true,
        mpUserId: true,
        mpConnectedAt: true,
        role: true,
        isBlocked: true,
      },
    }),
    prisma.user.findUnique({
      where: { id: referredUserId },
      select: { id: true, email: true, mpUserId: true, role: true, isBlocked: true },
    }),
  ]);

  if (!referrer) return { ok: false, error: "Usuario referidor no encontrado." };
  if (!referred) return { ok: false, error: "Usuario referido no encontrado." };

  if (referrer.isBlocked) return { ok: false, error: "El usuario referidor está bloqueado." };
  if (referred.isBlocked) return { ok: false, error: "El usuario referido está bloqueado." };

  if (referrer.email.toLowerCase() === referred.email.toLowerCase()) {
    return { ok: false, error: "El referidor y el referido deben tener emails distintos." };
  }

  if (referrer.mpUserId && referred.mpUserId && referrer.mpUserId === referred.mpUserId) {
    return { ok: false, error: "El referidor y el referido comparten la misma cuenta de Mercado Pago." };
  }

  const warnings: string[] = [];
  if (!referrer.mpUserId && !referrer.mpConnectedAt) {
    warnings.push(
      "El referidor no tiene Mercado Pago conectado: la atribución quedará guardada, pero no generará comisiones hasta que conecte MP."
    );
  }
  if (referred.role === "ORGANIZER") {
    warnings.push(
      "Organizador referido: quedará atribuido al programa de organizadores. Las comisiones de ese programa se aplicarán según las reglas vigentes cuando estén habilitadas."
    );
  } else if (referred.role !== "PHOTOGRAPHER" && referred.role !== "LAB_PHOTOGRAPHER") {
    warnings.push(
      "Los fotógrafos referidos generan comisión según el programa actual. Otros roles pueden quedar atribuidos sin comisión de fotógrafo referido."
    );
  }

  return { ok: true, warnings };
}

export async function upsertManualReferralAttribution(params: {
  referredUserId: number;
  referrerUserId: number;
  startsAt: Date;
}): Promise<{ attribution: ReferralAttributionAdminView; warnings: string[]; created: boolean }> {
  const validation = await validateManualReferralAssignment(
    params.referrerUserId,
    params.referredUserId
  );
  if (!validation.ok) {
    throw new Error(validation.error);
  }

  const { code } = await getOrCreateReferralCodeForUser(params.referrerUserId);
  const referralCode = await prisma.referralCode.findUniqueOrThrow({
    where: { code },
    select: { id: true },
  });

  const endsAt = addYears(params.startsAt, ATTRIBUTION_YEARS);

  const referred = await prisma.user.findUnique({
    where: { id: params.referredUserId },
    select: { role: true },
  });
  const referralProgram = referred
    ? inferReferralProgramForReferredUserRole(referred.role)
    : DEFAULT_REFERRAL_PROGRAM;

  const existing = await prisma.referralAttribution.findUnique({
    where: { referredUserId: params.referredUserId },
    select: { id: true },
  });

  if (existing) {
    await prisma.referralAttribution.update({
      where: { id: existing.id },
      data: {
        referralCodeId: referralCode.id,
        referrerUserId: params.referrerUserId,
        startsAt: params.startsAt,
        endsAt,
        status: "ACTIVE",
        sourceType: REFERRAL_SOURCE_ADMIN_MANUAL,
        sourceEntityId: null,
        referralProgram,
      },
    });
  } else {
    await prisma.referralAttribution.create({
      data: {
        referralCodeId: referralCode.id,
        referrerUserId: params.referrerUserId,
        referredUserId: params.referredUserId,
        startsAt: params.startsAt,
        endsAt,
        status: "ACTIVE",
        sourceType: REFERRAL_SOURCE_ADMIN_MANUAL,
        referralProgram,
      },
    });
  }

  const attribution = await getReferralAttributionForReferredUser(params.referredUserId);
  if (!attribution) {
    throw new Error("No se pudo cargar la atribución guardada.");
  }

  return {
    attribution,
    warnings: validation.warnings,
    created: !existing,
  };
}

export async function removeManualReferralAttribution(
  referredUserId: number
): Promise<{ deleted: boolean; earningsRemoved: number }> {
  const existing = await prisma.referralAttribution.findUnique({
    where: { referredUserId },
    select: { id: true, _count: { select: { earnings: true } } },
  });
  if (!existing) {
    return { deleted: false, earningsRemoved: 0 };
  }

  await prisma.referralAttribution.delete({ where: { id: existing.id } });
  return { deleted: true, earningsRemoved: existing._count.earnings };
}

export { parseStartsAt };
