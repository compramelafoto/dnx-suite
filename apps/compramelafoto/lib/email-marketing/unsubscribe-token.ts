import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";

/** Devuelve el token de baja del usuario; si no tiene, genera uno (24 bytes en hex) y lo guarda. */
export async function ensureUnsubscribeToken(userId: number): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { unsubscribeToken: true },
  });
  if (!user) throw new Error("Usuario no encontrado");
  if (user.unsubscribeToken) return user.unsubscribeToken;

  const token = randomBytes(24).toString("hex");
  await prisma.user.update({
    where: { id: userId },
    data: { unsubscribeToken: token },
  });
  return token;
}
