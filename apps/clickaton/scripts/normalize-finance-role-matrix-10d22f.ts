/**
 * 10D.2.2F — Normalize finance role matrix (Staging / Production).
 *
 * SUPER_ADMIN ≠ FINANCE_OWNER ≠ PARTNER_CONNECT ≠ VIEWER
 *
 * Usage (from packages/db so Prisma resolves):
 *   DATABASE_URL=… pnpm exec tsx ../../apps/clickaton/scripts/normalize-finance-role-matrix-10d22f.ts --staging
 *   DATABASE_URL=… pnpm exec tsx ../../apps/clickaton/scripts/normalize-finance-role-matrix-10d22f.ts --production --confirm=APPLY_PROD_FINANCE_MATRIX
 *
 * Never mutates payment account fields (status/vault/providerUserId).
 * Never opens registrations / OAuth / percentages.
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

const DANIEL = "cuart.daniel@gmail.com";
const DNX = "dnxfotografia@gmail.com";
const TAMMY = "tammyytamer@gmail.com";
const OWNER_ORG_REF = "clickaton:partners-production:mp-owner";
const OWNER_PROD_PREFIX = "pa_ba733fa7";
const OWNER_STG_ID = "pa_stg_owner_invariant";

type Capability =
  | "DNX_FINANCE_OWNER"
  | "DNX_FINANCE_PARTNER_CONNECT"
  | "PRODUCT_FINANCE_VIEWER"
  | "PRODUCT_FINANCE_MANAGER"
  | "DNX_FINANCE_ADMIN";

function parseArgs() {
  const args = process.argv.slice(2);
  const staging = args.includes("--staging");
  const production = args.includes("--production");
  const confirm = args
    .find((a) => a.startsWith("--confirm="))
    ?.slice("--confirm=".length);
  const dryRun = args.includes("--dry-run");
  if (staging === production) {
    throw new Error("Pass exactly one of --staging | --production");
  }
  if (production && confirm !== "APPLY_PROD_FINANCE_MATRIX" && !dryRun) {
    throw new Error(
      "Production requires --confirm=APPLY_PROD_FINANCE_MATRIX (or --dry-run)",
    );
  }
  return { staging, production, dryRun };
}

async function ensureUser(
  prisma: InstanceType<typeof PrismaClient>,
  email: string,
  opts: { name: string; globalRole?: string; createIfMissing: boolean },
) {
  let user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
  });
  if (!user) {
    if (!opts.createIfMissing) return null;
    user = await prisma.user.create({
      data: {
        email,
        name: opts.name,
        role: "CUSTOMER",
        globalRole: opts.globalRole ?? "USER",
        emailVerifiedAt: new Date(),
      },
    });
    return { user, created: true as const };
  }
  return { user, created: false as const };
}

async function ensurePersonIdentity(
  prisma: InstanceType<typeof PrismaClient>,
  userId: number,
  legalName: string,
) {
  let person = await prisma.dnxFinancialIdentity.findFirst({
    where: { ownerUserId: userId, subjectType: "PERSON", status: "ACTIVE" },
  });
  if (!person) {
    person = await prisma.dnxFinancialIdentity.create({
      data: {
        subjectType: "PERSON",
        ownerUserId: userId,
        isPrimary: true,
        legalName,
        countryCode: "AR",
        status: "ACTIVE",
      },
    });
  }
  return person;
}

async function ensureGrant(
  prisma: InstanceType<typeof PrismaClient>,
  userId: number,
  capability: Capability,
  productKey: string | null,
  grantedByUserId: number | null,
  dryRun: boolean,
) {
  const existing = await prisma.dnxFinanceGrant.findFirst({
    where: {
      userId,
      capability,
      productKey,
      status: "ACTIVE",
    },
  });
  if (existing) return { action: "ALREADY_ACTIVE" as const, id: existing.id };
  if (dryRun) return { action: "WOULD_GRANT" as const, id: null };
  const created = await prisma.dnxFinanceGrant.create({
    data: {
      userId,
      capability,
      productKey,
      scopeType: productKey ? "EDITION" : null,
      scopeId: null,
      status: "ACTIVE",
      grantedByUserId,
    },
  });
  return { action: "GRANTED" as const, id: created.id };
}

async function revokeGrant(
  prisma: InstanceType<typeof PrismaClient>,
  userId: number,
  capability: Capability,
  dryRun: boolean,
) {
  const existing = await prisma.dnxFinanceGrant.findMany({
    where: { userId, capability, status: "ACTIVE" },
  });
  if (!existing.length) return { action: "ABSENT" as const, ids: [] as string[] };
  if (dryRun) {
    return {
      action: "WOULD_REVOKE" as const,
      ids: existing.map((g: { id: string }) => g.id),
    };
  }
  for (const g of existing as Array<{ id: string }>) {
    await prisma.dnxFinanceGrant.update({
      where: { id: g.id },
      data: { status: "REVOKED" },
    });
  }
  return { action: "REVOKED" as const, ids: existing.map((g) => g.id) };
}

async function snapshotOwner(prisma: InstanceType<typeof PrismaClient>) {
  const org = await prisma.dnxFinancialIdentity.findFirst({
    where: { organizationRef: OWNER_ORG_REF },
    select: {
      id: true,
      ownerUserId: true,
      status: true,
      paymentAccounts: {
        select: {
          id: true,
          status: true,
          environment: true,
          providerUserId: true,
          credentialReference: true,
          capabilities: true,
          updatedAt: true,
          originApp: true,
          externalReference: true,
        },
      },
    },
  });
  const prodLike = await prisma.dnxPaymentAccount.findMany({
    where: {
      OR: [{ id: { startsWith: OWNER_PROD_PREFIX } }, { id: OWNER_STG_ID }],
    },
    select: {
      id: true,
      status: true,
      environment: true,
      providerUserId: true,
      credentialReference: true,
      updatedAt: true,
      financialIdentityId: true,
    },
  });
  return { org, accounts: prodLike };
}

function ownerInvariantOk(
  before: Awaited<ReturnType<typeof snapshotOwner>>,
  after: Awaited<ReturnType<typeof snapshotOwner>>,
) {
  const b = before.accounts;
  const a = after.accounts;
  if (b.length !== a.length) return false;
  for (const ba of b) {
    const aa = a.find((x) => x.id === ba.id);
    if (!aa) return false;
    if (
      ba.status !== aa.status ||
      ba.environment !== aa.environment ||
      ba.providerUserId !== aa.providerUserId ||
      ba.credentialReference !== aa.credentialReference ||
      ba.financialIdentityId !== aa.financialIdentityId ||
      String(ba.updatedAt) !== String(aa.updatedAt)
    ) {
      return false;
    }
  }
  // Org FI id + status must remain; ownerUserId may stay (technical ownership).
  if (before.org?.id !== after.org?.id) return false;
  if (before.org?.status !== after.org?.status) return false;
  return true;
}

async function activeGrants(
  prisma: InstanceType<typeof PrismaClient>,
  userId: number,
) {
  return prisma.dnxFinanceGrant.findMany({
    where: { userId, status: "ACTIVE" },
    select: { capability: true, productKey: true, status: true },
    orderBy: { capability: "asc" },
  });
}

async function main() {
  const { staging, production, dryRun } = parseArgs();
  const prisma = new PrismaClient();
  const report: Record<string, unknown> = {
    env: staging ? "staging" : "production",
    dryRun,
    createUsersIfMissing: true,
  };

  try {
    const beforeOwner = await snapshotOwner(prisma);
    report.ownerBefore = beforeOwner;

    const createIfMissing = true; // needed for cuart.daniel / Tammy on Staging
    const danielEnsured = await ensureUser(prisma, DANIEL, {
      name: "Daniel Cuart",
      globalRole: "SUPER_ADMIN",
      createIfMissing,
    });
    if (!danielEnsured) {
      console.log(
        JSON.stringify({
          ok: false,
          verdict: "DNX USER NOT FOUND",
          email: DANIEL,
        }),
      );
      process.exit(2);
    }

    if (!dryRun && danielEnsured.user.globalRole !== "SUPER_ADMIN") {
      await prisma.user.update({
        where: { id: danielEnsured.user.id },
        data: { globalRole: "SUPER_ADMIN" },
      });
    }

    const dnxEnsured = await ensureUser(prisma, DNX, {
      name: "Dnx Estudio",
      createIfMissing: false,
    });
    if (!dnxEnsured) {
      console.log(
        JSON.stringify({
          ok: false,
          verdict: "DNX USER NOT FOUND",
          email: DNX,
        }),
      );
      process.exit(2);
    }

    const tammyEnsured = await ensureUser(prisma, TAMMY, {
      name: "Tammyy Tamer",
      createIfMissing,
    });
    if (!tammyEnsured) {
      console.log(
        JSON.stringify({
          ok: false,
          verdict: "DNX USER NOT FOUND",
          email: TAMMY,
        }),
      );
      process.exit(2);
    }

    const daniel = danielEnsured.user;
    const dnx = dnxEnsured.user;
    const tammy = tammyEnsured.user;

    if (!dryRun) {
      await ensurePersonIdentity(prisma, daniel.id, "Daniel Cuart");
      await ensurePersonIdentity(prisma, dnx.id, "Dnx Estudio");
      await ensurePersonIdentity(prisma, tammy.id, "Tammyy Tamer");
    }

    const grantedBy = daniel.id;

    // Daniel: OWNER + PARTNER_CONNECT (keep any other grants)
    const danielActions = {
      owner: await ensureGrant(
        prisma,
        daniel.id,
        "DNX_FINANCE_OWNER",
        null,
        grantedBy,
        dryRun,
      ),
      partner: await ensureGrant(
        prisma,
        daniel.id,
        "DNX_FINANCE_PARTNER_CONNECT",
        null,
        grantedBy,
        dryRun,
      ),
      viewer: await ensureGrant(
        prisma,
        daniel.id,
        "PRODUCT_FINANCE_VIEWER",
        "clickaton",
        grantedBy,
        dryRun,
      ),
      createdUser: danielEnsured.created,
      globalRole: "SUPER_ADMIN",
    };

    // dnxfotografia: revoke OWNER/MANAGER/ADMIN; ensure VIEWER + PARTNER_CONNECT
    const dnxActions = {
      revokeOwner: await revokeGrant(prisma, dnx.id, "DNX_FINANCE_OWNER", dryRun),
      revokeManager: await revokeGrant(
        prisma,
        dnx.id,
        "PRODUCT_FINANCE_MANAGER",
        dryRun,
      ),
      revokeAdmin: await revokeGrant(prisma, dnx.id, "DNX_FINANCE_ADMIN", dryRun),
      viewer: await ensureGrant(
        prisma,
        dnx.id,
        "PRODUCT_FINANCE_VIEWER",
        "clickaton",
        grantedBy,
        dryRun,
      ),
      partner: await ensureGrant(
        prisma,
        dnx.id,
        "DNX_FINANCE_PARTNER_CONNECT",
        null,
        grantedBy,
        dryRun,
      ),
      // Do NOT change globalRole / admin allowlist operational roles
    };

    // Tammy: VIEWER + PARTNER_CONNECT; no OWNER
    const tammyActions = {
      revokeOwner: await revokeGrant(prisma, tammy.id, "DNX_FINANCE_OWNER", dryRun),
      revokeManager: await revokeGrant(
        prisma,
        tammy.id,
        "PRODUCT_FINANCE_MANAGER",
        dryRun,
      ),
      viewer: await ensureGrant(
        prisma,
        tammy.id,
        "PRODUCT_FINANCE_VIEWER",
        "clickaton",
        grantedBy,
        dryRun,
      ),
      partner: await ensureGrant(
        prisma,
        tammy.id,
        "DNX_FINANCE_PARTNER_CONNECT",
        null,
        grantedBy,
        dryRun,
      ),
      createdUser: tammyEnsured.created,
    };

    const afterOwner = await snapshotOwner(prisma);
    const intact = ownerInvariantOk(beforeOwner, afterOwner);

    report.users = {
      daniel: {
        id: daniel.id,
        email: DANIEL,
        created: danielEnsured.created,
        actions: danielActions,
        grants: await activeGrants(prisma, daniel.id),
      },
      dnxfotografia: {
        id: dnx.id,
        email: DNX,
        actions: dnxActions,
        grants: await activeGrants(prisma, dnx.id),
      },
      tammy: {
        id: tammy.id,
        email: TAMMY,
        created: tammyEnsured.created,
        actions: tammyActions,
        grants: await activeGrants(prisma, tammy.id),
      },
    };
    report.ownerAfter = afterOwner;
    report.ownerAccountIntact = intact;
    report.note =
      "Technical org ownership (ownerUserId / pa_*) left unchanged; finance ROLE moved via grants only.";

    if (!intact) {
      console.log(
        JSON.stringify(
          {
            ok: false,
            verdict: "OWNER ACCOUNT OWNERSHIP CONFLICT",
            report,
          },
          null,
          2,
        ),
      );
      process.exit(3);
    }

    console.log(
      JSON.stringify(
        {
          ok: true,
          verdict: dryRun
            ? "DRY_RUN_OK"
            : "DNX FINANCE ROLE MATRIX NORMALIZED",
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
