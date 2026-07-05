import { prisma } from "@/lib/prisma";
import { formatQuoteNumber } from "@/lib/cuantocobro/quote/quote-number-format";

export { formatQuoteNumber } from "@/lib/cuantocobro/quote/quote-number-format";

export async function allocateNextQuoteNumber(userId: number, year = new Date().getFullYear()): Promise<string> {
  return prisma.$transaction(async (tx) => {
    const row = await tx.cuantoCobroQuoteSequence.upsert({
      where: { userId_year: { userId, year } },
      create: { userId, year, lastNumber: 1 },
      update: { lastNumber: { increment: 1 } },
      select: { lastNumber: true },
    });

    return formatQuoteNumber(year, row.lastNumber);
  });
}
