import { prisma } from "@repo/db";
import { normalizarTelefono } from "@/lib/whatsapp/telefono";
import { generatePhoneCode, PHONE_CODE_TTL_MS } from "./codigo";

export type StartPhoneResult = { ok: true; code: string } | { ok: false; error: string };

/**
 * Guarda el teléfono con un código nuevo (vence a los 15 minutos) y lo deja sin verificar.
 * Si el usuario cambia un teléfono que ya estaba verificado, la identidad debe revalidarse.
 */
export async function startPhoneVerification(
  userId: number,
  rawPhone: string,
  now: Date,
): Promise<StartPhoneResult> {
  const phone = normalizarTelefono(rawPhone);
  if (phone.length < 10 || phone.length > 15) {
    return { ok: false, error: "Ingresá un número de teléfono válido, con código de área." };
  }

  const previous = await prisma.phoneVerification.findUnique({ where: { userId } });
  const code = generatePhoneCode();
  const codeExpiresAt = new Date(now.getTime() + PHONE_CODE_TTL_MS);
  await prisma.phoneVerification.upsert({
    where: { userId },
    create: { userId, phone, code, codeExpiresAt, verifiedAt: null },
    update: { phone, code, codeExpiresAt, verifiedAt: null },
  });

  if (previous?.verifiedAt && normalizarTelefono(previous.phone) !== phone) {
    await prisma.identityVerification.updateMany({
      where: { userId },
      data: { reverifyRequiredAt: now },
    });
  }
  return { ok: true, code };
}
