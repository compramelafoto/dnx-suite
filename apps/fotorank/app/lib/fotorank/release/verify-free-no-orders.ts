/**
 * Verifica que Santa Fe en Foco FREE no tenga órdenes de pago.
 * DATABASE_URL=... pnpm --filter fotorank run contest:verify-free
 */
import { prisma } from "@repo/db";
import { assertSafeFotoRankDatabaseUrl } from "../../../../scripts/assert-safe-database-url";

const SLUG = process.env.FOTORANK_LAUNCH_CONTEST_SLUG?.trim() || "santa-fe-en-foco";

async function main() {
  assertSafeFotoRankDatabaseUrl();
  const contest = await prisma.fotorankContest.findFirst({ where: { slug: SLUG } });
  if (!contest) throw new Error(`Contest ${SLUG} no encontrado`);

  const safe = await prisma.fotorankContestRegistration.findMany({
    where: { contestId: contest.id },
    select: {
      id: true,
      status: true,
      paymentStatus: true,
      paymentOrderId: true,
      registrationPriceSnapshot: true,
      platformFeeBpsSnapshot: true,
      paymentModeSnapshot: true,
    },
  });

  const violations = safe.filter(
    (r) =>
      r.paymentOrderId != null ||
      r.registrationPriceSnapshot !== 0 ||
      r.platformFeeBpsSnapshot !== 0 ||
      (r.status === "CONFIRMED" && r.paymentStatus !== "NOT_REQUIRED") ||
      r.paymentModeSnapshot !== "FREE",
  );

  console.log(
    JSON.stringify(
      {
        ok: violations.length === 0,
        contestId: contest.id,
        totalRegistrations: safe.length,
        violations: violations.length,
        sample: violations.slice(0, 5).map((v) => v.id),
      },
      null,
      2,
    ),
  );
  if (violations.length > 0) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => prisma.$disconnect());
