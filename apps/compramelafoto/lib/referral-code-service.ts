import { prisma } from "@/lib/prisma";
import { generateReferralCode } from "@/lib/referral-helpers";
import { getPublicReferralUrl } from "@/lib/referral-link";

/**
 * Obtiene o crea el código de referido del usuario.
 * Usado por el flujo público /recomendanos (sin exigir Mercado Pago).
 * La UI interna (/api/referrals/me POST) mantiene su regla de negocio aparte.
 */
export async function getOrCreateReferralCodeForUser(
  ownerUserId: number
): Promise<{ code: string; url: string }> {
  const existing = await prisma.referralCode.findUnique({
    where: { ownerUserId },
    select: { code: true, isActive: true },
  });
  if (existing) {
    if (!existing.isActive) {
      await prisma.referralCode.update({
        where: { ownerUserId },
        data: { isActive: true },
      });
    }
    return { code: existing.code, url: getPublicReferralUrl(existing.code, "/land") };
  }

  let code = generateReferralCode();
  for (let i = 0; i < 12; i++) {
    const clash = await prisma.referralCode.findUnique({
      where: { code },
      select: { id: true },
    });
    if (!clash) break;
    code = generateReferralCode();
  }

  await prisma.referralCode.create({
    data: {
      code,
      ownerUserId,
      isActive: true,
    },
  });

  return { code, url: getPublicReferralUrl(code, "/land") };
}
