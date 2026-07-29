/**
 * Carga básica controlada (10 inscripciones concurrentes) en DB local aislada.
 * DATABASE_URL=...fotorank_staging_2026 pnpm --filter fotorank run test:concurrency:smoke
 */
import { createHash } from "node:crypto";
import { prisma } from "@repo/db";
import { assertSafeFotoRankDatabaseUrl } from "../../../../scripts/assert-safe-database-url";
import {
  createContestRegistration,
  publishRulesVersion,
  RULES_PLACEHOLDER_MARKER,
} from "../registration";

async function main() {
  assertSafeFotoRankDatabaseUrl();
  const suffix = Date.now().toString(36);
  const password = createHash("sha256").update(suffix).digest("hex");

  const admin = await prisma.user.create({
    data: { email: `admin-c-${suffix}@fotorank.local`, name: "Admin C", password },
  });
  const org = await prisma.contestOrganization.create({
    data: {
      name: `Org C ${suffix}`,
      slug: `org-c-${suffix}`,
      platformFeeBps: 0,
      createdByUserId: admin.id,
    },
  });
  await prisma.contestOrganizationMember.create({
    data: { organizationId: org.id, userId: admin.id, role: "OWNER", status: "ACTIVE" },
  });
  const contest = await prisma.fotorankContest.create({
    data: {
      organizationId: org.id,
      title: `Concurrency ${suffix}`,
      slug: `c-${suffix}`,
      status: "PUBLISHED",
      visibility: "PUBLIC",
      registrationEnabled: true,
      registrationPricingMode: "FREE",
      registrationOpensAt: new Date("2026-01-01T00:00:00Z"),
      registrationClosesAt: new Date("2026-12-31T00:00:00Z"),
      timezone: "America/Argentina/Cordoba",
      createdByUserId: admin.id,
    },
  });
  const category = await prisma.fotorankContestCategory.create({
    data: { contestId: contest.id, name: "Única", slug: "unica", maxFiles: 1, status: "ACTIVE" },
  });
  const rules = await publishRulesVersion({
    contestId: contest.id,
    title: "Bases",
    content: `${RULES_PLACEHOLDER_MARKER}\nconcurrency`,
    createdByUserId: admin.id,
    allowPlaceholder: true,
  });

  const users = await Promise.all(
    Array.from({ length: 10 }, (_, i) =>
      prisma.user.create({
        data: { email: `p${i}-${suffix}@fotorank.local`, name: `P${i}`, password },
      }),
    ),
  );

  const started = Date.now();
  const results = await Promise.allSettled(
    users.map((u) =>
      createContestRegistration({
        contestId: contest.id,
        participantUserId: u.id,
        categoryId: category.id,
        rulesVersionId: rules.id,
        rulesAccepted: true,
    licenseAccepted: true,
    declaredAgeYears: 30,
        rulesAcceptanceIp: "127.0.0.1",
        rulesAcceptanceUserAgent: "concurrency.smoke",
      }),
    ),
  );
  const elapsedMs = Date.now() - started;
  const ok = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.filter((r) => r.status === "rejected").length;
  const confirmed = await prisma.fotorankContestRegistration.count({
    where: { contestId: contest.id, status: "CONFIRMED" },
  });

  console.log(
    JSON.stringify(
      {
        status: ok === 10 && confirmed === 10 ? "PASS" : "FAIL",
        ok,
        failed,
        confirmed,
        elapsedMs,
        contestId: contest.id,
      },
      null,
      2,
    ),
  );
  if (ok !== 10 || confirmed !== 10) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => prisma.$disconnect());
