/**
 * Staging-only fixture for 10D.2.2 control partner OAuth.
 */
const path = require("path");
const { randomBytes, scryptSync } = require("crypto");
const { createRequire } = require("module");
const dbRequire = createRequire(
  path.join(__dirname, "../../../packages/db/package.json"),
);
const { PrismaClient } = dbRequire("@prisma/client");

function hashPassword(plain) {
  const salt = randomBytes(16).toString("hex");
  const digest = scryptSync(plain, salt, 64).toString("hex");
  return `${salt}:${digest}`;
}

async function main() {
  const p = new PrismaClient();
  const CONTROL_EMAIL = "compramelafoto@gmail.com";
  const CONTROL_PASSWORD = "StagingPartner10D22!";
  const hashed = hashPassword(CONTROL_PASSWORD);

  let user = await p.user.findFirst({
    where: { email: { equals: CONTROL_EMAIL, mode: "insensitive" } },
  });
  if (!user) {
    user = await p.user.create({
      data: {
        email: CONTROL_EMAIL,
        name: "Control Partner Staging",
        role: "CUSTOMER",
        password: hashed,
        emailVerifiedAt: new Date(),
      },
    });
    console.log(JSON.stringify({ createdUser: true, userId: user.id }));
  } else {
    await p.user.update({
      where: { id: user.id },
      data: {
        password: hashed,
        emailVerifiedAt: user.emailVerifiedAt ?? new Date(),
      },
    });
    console.log(JSON.stringify({ createdUser: false, userId: user.id }));
  }

  let person = await p.dnxFinancialIdentity.findFirst({
    where: { ownerUserId: user.id, subjectType: "PERSON", status: "ACTIVE" },
  });
  if (!person) {
    person = await p.dnxFinancialIdentity.create({
      data: {
        subjectType: "PERSON",
        ownerUserId: user.id,
        isPrimary: true,
        legalName: "Control Partner",
        countryCode: "AR",
        status: "ACTIVE",
      },
    });
  }

  for (const capability of [
    "DNX_FINANCE_PARTNER_CONNECT",
    "PRODUCT_FINANCE_VIEWER",
  ]) {
    const existing = await p.dnxFinanceGrant.findFirst({
      where: {
        userId: user.id,
        capability,
        productKey: capability.startsWith("PRODUCT_") ? "clickaton" : null,
        status: "ACTIVE",
      },
    });
    if (!existing) {
      await p.dnxFinanceGrant.create({
        data: {
          userId: user.id,
          capability,
          productKey: capability.startsWith("PRODUCT_") ? "clickaton" : null,
          scopeType: capability.startsWith("PRODUCT_") ? "EDITION" : null,
          scopeId: null,
          status: "ACTIVE",
          grantedByUserId: 2,
        },
      });
    }
  }

  let ownerOrg = await p.dnxFinancialIdentity.findFirst({
    where: { organizationRef: "clickaton:partners-production:mp-owner" },
  });
  if (!ownerOrg) {
    ownerOrg = await p.dnxFinancialIdentity.create({
      data: {
        subjectType: "ORGANIZATION",
        ownerUserId: 2,
        organizationRef: "clickaton:partners-production:mp-owner",
        legalName: "Clickatón Staging MP Owner Org",
        countryCode: "AR",
        status: "ACTIVE",
        isPrimary: false,
      },
    });
  }

  let ownerAcc = await p.dnxPaymentAccount.findFirst({
    where: {
      financialIdentityId: ownerOrg.id,
      externalReference: "dedicatedProduct=clickaton",
      originApp: "clickaton",
    },
  });
  if (!ownerAcc) {
    ownerAcc = await p.dnxPaymentAccount.create({
      data: {
        id: "pa_stg_owner_invariant",
        financialIdentityId: ownerOrg.id,
        provider: "MERCADOPAGO",
        environment: "TEST",
        providerUserId: "STAGING_OWNER_INVARIANT_999",
        credentialReference: "dnxcred_stg_owner_invariant",
        originApp: "clickaton",
        externalReference: "dedicatedProduct=clickaton",
        capabilities: ["COLLECTOR"],
        status: "ACTIVE",
        connectedAt: new Date(),
        isPrimary: true,
      },
    });
  }

  const grants = await p.dnxFinanceGrant.findMany({
    where: { userId: user.id, status: "ACTIVE" },
  });
  const accountCount = await p.dnxPaymentAccount.count({
    where: { financialIdentityId: person.id },
  });
  console.log(
    JSON.stringify(
      {
        control: {
          userId: user.id,
          email: CONTROL_EMAIL,
          personId: person.id,
          grants: grants.map((g) => g.capability),
          paymentAccounts: accountCount,
        },
        ownerInvariant: {
          identityId: ownerOrg.id,
          accountId: ownerAcc.id,
          status: ownerAcc.status,
          vaultRef: ownerAcc.credentialReference,
          providerUserId: ownerAcc.providerUserId,
        },
        login: { email: CONTROL_EMAIL, passwordSet: true },
      },
      null,
      2,
    ),
  );
  await p.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
