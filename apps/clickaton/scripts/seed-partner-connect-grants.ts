/**
 * 10D.2.1 — Fixture reversible: grants partner-connect (+ viewer) sin OAuth.
 *
 * Run from packages/db so Prisma resolves correctly:
 *
 *   cd packages/db && DATABASE_URL=... pnpm exec tsx ../../apps/clickaton/scripts/seed-partner-connect-grants.ts
 *   ... --revoke
 *
 * Targets: Tammy + compramelafoto@gmail.com.
 * Never grants DNX_FINANCE_OWNER. Never connects MP.
 */
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const require = createRequire(
  path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../../packages/db/package.json",
  ),
);
const { PrismaClient } = require("@prisma/client");

const TARGETS = [
  { email: "tammyytamer@gmail.com", label: "tammy" },
  { email: "compramelafoto@gmail.com", label: "control" },
] as const;

const CAPABILITIES = [
  "DNX_FINANCE_PARTNER_CONNECT",
  "PRODUCT_FINANCE_VIEWER",
] as const;

async function main() {
  const revoke = process.argv.includes("--revoke");
  const prisma = new PrismaClient();
  const grantedBy =
    (
      await prisma.user.findFirst({
        where: { email: { equals: "dnxfotografia@gmail.com", mode: "insensitive" } },
        select: { id: true },
      })
    )?.id ?? null;

  const report: unknown[] = [];

  try {
    for (const target of TARGETS) {
      const user = await prisma.user.findFirst({
        where: { email: { equals: target.email, mode: "insensitive" } },
        select: { id: true, email: true },
      });
      if (!user) {
        report.push({ target: target.label, error: "USER_NOT_FOUND" });
        continue;
      }

      let identity = await prisma.dnxFinancialIdentity.findFirst({
        where: {
          ownerUserId: user.id,
          subjectType: "PERSON",
          status: "ACTIVE",
        },
      });
      if (!identity && !revoke) {
        identity = await prisma.dnxFinancialIdentity.create({
          data: {
            subjectType: "PERSON",
            ownerUserId: user.id,
            isPrimary: true,
            legalName: target.label,
            countryCode: "AR",
            status: "ACTIVE",
          },
        });
      }

      for (const capability of CAPABILITIES) {
        const existing = await prisma.dnxFinanceGrant.findFirst({
          where: {
            userId: user.id,
            capability,
            productKey: capability.startsWith("PRODUCT_") ? "clickaton" : null,
            status: "ACTIVE",
          },
        });

        if (revoke) {
          if (existing && capability === "DNX_FINANCE_PARTNER_CONNECT") {
            await prisma.dnxFinanceGrant.update({
              where: { id: existing.id },
              data: { status: "REVOKED" },
            });
            report.push({
              target: target.label,
              userId: user.id,
              capability,
              action: "REVOKED",
            });
          } else {
            report.push({
              target: target.label,
              userId: user.id,
              capability,
              action:
                capability === "PRODUCT_FINANCE_VIEWER"
                  ? "SKIPPED_VIEWER_KEEP"
                  : "ALREADY_ABSENT",
            });
          }
          continue;
        }

        if (existing) {
          report.push({
            target: target.label,
            userId: user.id,
            capability,
            action: "ALREADY_ACTIVE",
          });
          continue;
        }

        await prisma.dnxFinanceGrant.create({
          data: {
            userId: user.id,
            capability,
            productKey: capability.startsWith("PRODUCT_") ? "clickaton" : null,
            scopeType: capability.startsWith("PRODUCT_") ? "EDITION" : null,
            scopeId: null,
            status: "ACTIVE",
            grantedByUserId: grantedBy,
          },
        });
        report.push({
          target: target.label,
          userId: user.id,
          capability,
          action: "GRANTED",
          identityId: identity?.id ?? null,
        });
      }

      const accounts = identity
        ? await prisma.dnxPaymentAccount.count({
            where: { financialIdentityId: identity.id },
          })
        : 0;
      report.push({
        target: target.label,
        userId: user.id,
        paymentAccounts: accounts,
        note: "OAuth NOT executed",
      });
    }

    console.log(
      JSON.stringify(
        {
          ok: true,
          mode: revoke ? "REVOKE" : "GRANT",
          ownerUntouched: true,
          report,
        },
        null,
        2,
      ),
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
