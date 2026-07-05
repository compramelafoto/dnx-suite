import { prisma } from "@/lib/prisma";
import { formatConsultaNumber } from "@/lib/cuantocobro/consulta/consulta-number-format";

export { formatConsultaNumber } from "@/lib/cuantocobro/consulta/consulta-number-format";

export async function allocateNextConsultaNumber(userId: number, year = new Date().getFullYear()): Promise<string> {
  return prisma.$transaction(async (tx) => {
    const row = await tx.cuantoCobroConsultaSequence.upsert({
      where: { userId_year: { userId, year } },
      create: { userId, year, lastNumber: 1 },
      update: { lastNumber: { increment: 1 } },
      select: { lastNumber: true },
    });

    return formatConsultaNumber(year, row.lastNumber);
  });
}
