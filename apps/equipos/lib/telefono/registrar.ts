import { prisma } from "@repo/db";
import { normalizarTelefono } from "@/lib/whatsapp/telefono";
import { generatePhoneCode, PHONE_CODE_TTL_MS } from "./codigo";

export type StartPhoneResult = { ok: true; code: string | null } | { ok: false; error: string };

/**
 * Guarda el teléfono con un código nuevo (vence a los 15 minutos) y lo deja sin verificar.
 * - Si el número ya está verificado y es el mismo, no toca nada (`code: null`).
 * - Si cambia un teléfono ya verificado, la identidad debe revalidarse; ambas escrituras
 *   van en una sola transacción para que no quede una sin la otra.
 */
export async function startPhoneVerification(
  userId: number,
  rawPhone: string,
  now: Date,
): Promise<StartPhoneResult> {
  const phone = normalizarTelefono(rawPhone);
  if (!phone) {
    return {
      ok: false,
      error: "Ingresá un celular argentino válido, con código de área (por ejemplo 341 555-1234).",
    };
  }

  const previous = await prisma.phoneVerification.findUnique({ where: { userId } });
  const samePhone = previous ? normalizarTelefono(previous.phone) === phone : false;
  if (previous?.verifiedAt && samePhone) return { ok: true, code: null };

  const code = generatePhoneCode();
  const codeExpiresAt = new Date(now.getTime() + PHONE_CODE_TTL_MS);
  const upsert = prisma.phoneVerification.upsert({
    where: { userId },
    create: { userId, phone, code, codeExpiresAt, verifiedAt: null },
    update: { phone, code, codeExpiresAt, verifiedAt: null },
  });

  if (previous?.verifiedAt) {
    await prisma.$transaction([
      upsert,
      prisma.identityVerification.updateMany({
        where: { userId },
        data: { reverifyRequiredAt: now },
      }),
    ]);
  } else {
    await upsert;
  }
  return { ok: true, code };
}
