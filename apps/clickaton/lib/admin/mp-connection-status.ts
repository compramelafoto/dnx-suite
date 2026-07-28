import { prisma } from "@/lib/admin/db";

/**
 * ¿Tiene el usuario una cuenta Mercado Pago conectada?
 * - Legacy CLF fields en User (mp*)
 * - DnxPaymentAccount ACTIVE/PENDING con provider MERCADOPAGO ligado a su identidad
 */
export async function isUserMercadoPagoConnected(input: {
  userId: number;
}): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: {
      mpAccessToken: true,
      mpUserId: true,
      mpConnectedAt: true,
    },
  });
  if (user?.mpAccessToken || user?.mpUserId || user?.mpConnectedAt) {
    return true;
  }

  const account = await prisma.dnxPaymentAccount.findFirst({
    where: {
      provider: "MERCADOPAGO",
      status: { in: ["ACTIVE", "PENDING", "NEEDS_REAUTH"] },
      financialIdentity: {
        ownerUserId: input.userId,
        status: "ACTIVE",
      },
    },
    select: { id: true },
  });
  return Boolean(account);
}

export async function getAdminEmailsMercadoPagoStatus(
  emails: readonly string[],
): Promise<Record<string, boolean>> {
  const result: Record<string, boolean> = {};
  for (const email of emails) {
    result[email] = false;
  }
  if (emails.length === 0) return result;

  const users = await prisma.user.findMany({
    where: {
      OR: emails.map((email) => ({
        email: { equals: email, mode: "insensitive" as const },
      })),
    },
    select: {
      id: true,
      email: true,
      mpAccessToken: true,
      mpUserId: true,
      mpConnectedAt: true,
    },
  });

  const byEmail = new Map(
    users.map((u) => [u.email.trim().toLowerCase(), u] as const),
  );

  const userIds = users.map((u) => u.id);
  const accounts =
    userIds.length === 0
      ? []
      : await prisma.dnxPaymentAccount.findMany({
          where: {
            provider: "MERCADOPAGO",
            status: { in: ["ACTIVE", "PENDING", "NEEDS_REAUTH"] },
            financialIdentity: {
              ownerUserId: { in: userIds },
              status: "ACTIVE",
            },
          },
          select: {
            financialIdentity: { select: { ownerUserId: true } },
          },
        });

  const connectedUserIds = new Set(
    accounts
      .map((a) => a.financialIdentity.ownerUserId)
      .filter((id): id is number => typeof id === "number"),
  );

  for (const email of emails) {
    const key = email.trim().toLowerCase();
    const u = byEmail.get(key);
    if (!u) {
      result[email] = false;
      continue;
    }
    result[email] = Boolean(
      u.mpAccessToken ||
        u.mpUserId ||
        u.mpConnectedAt ||
        connectedUserIds.has(u.id),
    );
  }

  return result;
}
