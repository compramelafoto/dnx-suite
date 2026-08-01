/**
 * 10G.1 — Ops Production (sin abrir venta pública):
 * - status DRAFT → REGISTRATION_OPEN
 * - abrir fase $25.000 desde hoy (AR) para E2E / preflight
 * - registrationEnabled permanece false
 *
 * Uso:
 *   DATABASE_URL=… pnpm --filter clickaton exec tsx scripts/ops-10g1-publish-edition-gate.ts
 */
import { prisma } from "@repo/db";

const EDITION_SLUG = "clickaton-argentina-2026";
const FIRST_PHASE_ID = "cms78cu1o0001xpc45bvmep2k";
/** 31/07/2026 00:00:00.000 AR (UTC−3) */
const FIRST_PHASE_START = new Date("2026-07-31T03:00:00.000Z");

async function main() {
  const before = await prisma.clickatonEdition.findUnique({
    where: { slug: EDITION_SLUG },
    select: {
      id: true,
      status: true,
      isPublished: true,
      registrationEnabled: true,
    },
  });
  if (!before) throw new Error("edition_missing");

  const phaseBefore = await prisma.clickatonRegistrationPricePhase.findUnique({
    where: { id: FIRST_PHASE_ID },
  });
  if (!phaseBefore) throw new Error("first_phase_missing");
  if (phaseBefore.amount !== 2_500_000) {
    throw new Error(`unexpected_amount:${phaseBefore.amount}`);
  }

  await prisma.$transaction([
    prisma.clickatonEdition.update({
      where: { id: before.id },
      data: {
        status: "REGISTRATION_OPEN",
        isPublished: true,
        // kill switch público: NO abrir
        registrationEnabled: false,
      },
    }),
    prisma.clickatonRegistrationPricePhase.update({
      where: { id: FIRST_PHASE_ID },
      data: {
        startsAt: FIRST_PHASE_START,
        isActive: true,
      },
    }),
  ]);

  const after = await prisma.clickatonEdition.findUnique({
    where: { id: before.id },
    select: {
      status: true,
      isPublished: true,
      registrationEnabled: true,
    },
  });
  const phaseAfter = await prisma.clickatonRegistrationPricePhase.findUnique({
    where: { id: FIRST_PHASE_ID },
    select: { name: true, amount: true, startsAt: true, endsAt: true, isActive: true },
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        before,
        after,
        pricePhase: {
          ...phaseAfter,
          amountPesos: phaseAfter ? phaseAfter.amount / 100 : null,
        },
        note: "registrationEnabled remains false; LIVE flag is env-only",
      },
      null,
      2,
    ),
  );
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
