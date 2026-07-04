import { prisma } from "@/lib/prisma";

export function normalizeEmail(email: string): string {
  return (email ?? "")
    .toString()
    .trim()
    .toLowerCase();
}

export async function claimOrdersForVerifiedUser({
  userId,
  email,
}: {
  userId: number;
  email: string;
}): Promise<number> {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    return 0;
  }

  const result = await prisma.order.updateMany({
    where: {
      buyerUserId: null,
      buyerEmail: normalizedEmail,
    },
    data: {
      buyerUserId: userId,
      claimedAt: new Date(),
    },
  });

  return result.count;
}
