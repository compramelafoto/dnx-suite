import { NextResponse } from "next/server";
import { prisma } from "@repo/db";
import { carryOverGiftVouchersUseCase } from "@/lib/gift-vouchers/application/carry-over-gift-vouchers";
import { createPrismaGiftVoucherRepository } from "@/lib/gift-vouchers/infrastructure/prisma-gift-voucher-repository";
import { createPrismaPublicRegistrationRepository } from "@/lib/public-registration/infrastructure/prisma-public-registration-repository";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Regalos pagados que nadie activó antes de que cerrara la inscripción:
 * libera el cupo y los deja apuntando a la edición siguiente.
 *
 * Corre una vez por día: el plazo es el cierre de inscripción, no hay apuro.
 */
export async function GET(request: Request) {
  const secret =
    process.env.CRON_SECRET?.trim() || process.env.CLICKATON_CRON_SECRET?.trim();
  const auth = request.headers.get("authorization");
  const vercelCron = request.headers.get("x-vercel-cron");
  const ok =
    (Boolean(secret) && auth === `Bearer ${secret}`) ||
    (process.env.VERCEL === "1" && vercelCron === "1");
  if (!ok) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const dryRun = new URL(request.url).searchParams.get("dryRun") === "1";
  const vouchers = createPrismaGiftVoucherRepository();
  const publicRepo = createPrismaPublicRegistrationRepository();

  const useCase = carryOverGiftVouchersUseCase({
    clock: { now: () => new Date() },
    vouchers: {
      listCarryOverCandidates: (limit) => vouchers.listCarryOverCandidates(limit),
      async markCarriedOver(input) {
        await vouchers.markCarriedOver(input);
      },
    },
    registrations: {
      async releaseGiftRegistration(registrationId) {
        await publicRepo.releaseGiftRegistration({
          registrationId,
          now: new Date(),
          reason: "gift_carried_over_registration_closed",
        });
      },
      async findNextEditionId(afterEditionId) {
        const actual = await prisma.clickatonEdition.findUnique({
          where: { id: afterEditionId },
          select: { startAt: true },
        });
        // La siguiente por fecha de evento: la que arranca después de esta.
        const siguiente = await prisma.clickatonEdition.findFirst({
          where: {
            id: { not: afterEditionId },
            isOpsFixture: false,
            startAt: actual?.startAt ? { gt: actual.startAt } : { not: null },
            status: { notIn: ["CANCELLED", "COMPLETED"] },
          },
          orderBy: { startAt: "asc" },
          select: { id: true },
        });
        return siguiente?.id ?? null;
      },
    },
  });

  const result = await useCase.execute({ dryRun, limit: 200 });
  return NextResponse.json({ ok: true, dryRun, ...result });
}
