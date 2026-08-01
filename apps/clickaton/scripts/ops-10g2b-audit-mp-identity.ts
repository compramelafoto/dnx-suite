/**
 * 10G.2B — Audit PROD MP identities for dnxfotografia / canonical collector.
 * Never prints access tokens.
 */
import { prisma } from "@repo/db";
import { CredentialVault } from "@repo/payments/credential-vault";
import { createPrismaCredentialStore } from "@repo/payments/infrastructure/prisma";

const EDITION_SLUG = "clickaton-argentina-2026";
const EXPECTED_PA = "pa_ba733fa7a35f4326";
const RECIPIENT_EMAIL = "dnxfotografia@gmail.com";
const OWNER_EMAIL = "cuart.daniel@gmail.com";

function mask(id: string | null | undefined): string {
  if (!id) return "—";
  if (id.length <= 10) return `${id.slice(0, 2)}…`;
  return `${id.slice(0, 6)}…${id.slice(-4)}`;
}

async function main() {
  const dnxUser = await prisma.user.findUnique({
    where: { email: RECIPIENT_EMAIL },
    select: { id: true, email: true },
  });
  const ownerUser = await prisma.user.findUnique({
    where: { email: OWNER_EMAIL },
    select: { id: true, email: true },
  });

  const identities = await prisma.dnxFinancialIdentity.findMany({
    where: {
      OR: [
        dnxUser ? { ownerUserId: dnxUser.id } : undefined,
        ownerUser ? { ownerUserId: ownerUser.id } : undefined,
        { legalName: { contains: "dnx", mode: "insensitive" } },
      ].filter(Boolean) as Array<{ ownerUserId: number }>,
    },
    include: {
      paymentAccounts: {
        include: {
          // credential via reference string
        },
      },
    },
  });

  // Broader: all PROD MP accounts
  const allProdPa = await prisma.dnxPaymentAccount.findMany({
    where: {
      provider: "MERCADOPAGO",
      environment: "PROD",
    },
    include: {
      financialIdentity: {
        select: {
          id: true,
          ownerUserId: true,
          status: true,
          legalName: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  // Also fetch by known id and any with same providerUserId later
  const known = await prisma.dnxPaymentAccount.findUnique({
    where: { id: EXPECTED_PA },
    include: {
      financialIdentity: {
        select: { id: true, ownerUserId: true, status: true, legalName: true },
      },
    },
  });

  const providerIds = [
    ...new Set(
      allProdPa.map((p) => p.providerUserId).filter((x): x is string => Boolean(x)),
    ),
  ];

  const byProvider: Record<string, typeof allProdPa> = {};
  for (const pa of allProdPa) {
    const key = pa.providerUserId ?? `null:${pa.id}`;
    (byProvider[key] ??= []).push(pa);
  }

  const credIds = [
    ...new Set(
      allProdPa
        .map((p) => p.credentialReference)
        .filter((x): x is string => Boolean(x)),
    ),
  ];
  const creds = credIds.length
    ? await prisma.dnxEncryptedCredential.findMany({
        where: { id: { in: credIds } },
        select: {
          id: true,
          environment: true,
          purpose: true,
          keyVersion: true,
          revokedAt: true,
          createdAt: true,
          rotatedAt: true,
        },
      })
    : [];
  const credById = Object.fromEntries(creds.map((c) => [c.id, c]));

  // Finance grants
  const grants = await prisma.dnxFinanceGrant.findMany({
    where: {
      OR: [
        dnxUser ? { userId: dnxUser.id } : undefined,
        ownerUser ? { userId: ownerUser.id } : undefined,
      ].filter(Boolean) as Array<{ userId: number }>,
      status: "ACTIVE",
    },
    select: {
      userId: true,
      capability: true,
      status: true,
      scopeType: true,
      scopeId: true,
    },
  });

  const edition = await prisma.clickatonEdition.findUnique({
    where: { slug: EDITION_SLUG },
    select: { id: true, status: true, registrationEnabled: true },
  });

  let agreementSummary: unknown = null;
  if (edition) {
    const agr = await prisma.dnxEconomicAgreement.findFirst({
      where: { scopeId: edition.id, status: "ACTIVE" },
      include: {
        currentVersion: {
          include: {
            rules: {
              include: {
                agreementParticipant: {
                  include: {
                    financialIdentity: {
                      select: { id: true, ownerUserId: true },
                    },
                    paymentAccount: {
                      select: {
                        id: true,
                        status: true,
                        environment: true,
                        providerUserId: true,
                        credentialReference: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
    const rules = agr?.currentVersion?.rules ?? [];
    const sumBps = rules.reduce((s, r) => s + Number(r.value), 0);
    agreementSummary = {
      agreementId: agr?.id ?? null,
      version: agr?.currentVersion?.versionNumber ?? null,
      allocationSumPercent: sumBps / 100,
      rules: await Promise.all(
        rules.map(async (r) => {
          const uid = r.agreementParticipant.financialIdentity.ownerUserId;
          const u = uid
            ? await prisma.user.findUnique({
                where: { id: uid },
                select: { email: true },
              })
            : null;
          const pa = r.agreementParticipant.paymentAccount;
          return {
            roleLabel: r.agreementParticipant.roleLabel,
            bps: Number(r.value),
            percent: Number(r.value) / 100,
            email: u?.email ?? null,
            paymentAccountId: pa?.id ?? null,
            paymentAccountMasked: mask(pa?.id),
            providerUserId: pa?.providerUserId ?? null,
            paStatus: pa?.status ?? null,
            paEnv: pa?.environment ?? null,
            credentialMasked: mask(pa?.credentialReference),
          };
        }),
      ),
    };
  }

  // Decrypt test (no token print)
  const masterLen = (process.env.DNX_FINANCIAL_CREDENTIAL_MASTER_KEY ?? "").trim()
    .length;
  const decryptResults: Array<Record<string, unknown>> = [];
  if (masterLen > 0) {
    const store = createPrismaCredentialStore(prisma as never);
    const vault = new CredentialVault(store);
    for (const pa of allProdPa) {
      if (!pa.credentialReference) {
        decryptResults.push({
          paId: pa.id,
          providerUserId: pa.providerUserId,
          decrypt: "NO_CREDENTIAL",
        });
        continue;
      }
      try {
        const payload = await vault.decryptMercadoPagoCredential(
          pa.credentialReference,
        );
        decryptResults.push({
          paId: pa.id,
          paIdMasked: mask(pa.id),
          providerUserId: pa.providerUserId,
          credentialMasked: mask(pa.credentialReference),
          decrypt: "PASS",
          hasAccessToken: Boolean(payload.accessToken?.trim()),
          tokenLen: payload.accessToken?.trim().length ?? 0,
        });
      } catch (e) {
        decryptResults.push({
          paId: pa.id,
          paIdMasked: mask(pa.id),
          providerUserId: pa.providerUserId,
          credentialMasked: mask(pa.credentialReference),
          decrypt: "FAIL",
          err: e instanceof Error ? e.message.slice(0, 100) : "fail",
        });
      }
    }
  }

  const usersById = new Map<number, string>();
  for (const u of [dnxUser, ownerUser]) {
    if (u) usersById.set(u.id, u.email);
  }
  // load owner emails for identities
  const ownerIds = [
    ...new Set(
      allProdPa
        .map((p) => p.financialIdentity.ownerUserId)
        .filter((x): x is number => x != null),
    ),
  ];
  if (ownerIds.length) {
    const us = await prisma.user.findMany({
      where: { id: { in: ownerIds } },
      select: { id: true, email: true },
    });
    for (const u of us) usersById.set(u.id, u.email);
  }

  console.log(
    JSON.stringify(
      {
        users: { dnx: dnxUser, financeOwner: ownerUser },
        masterKeyLen: masterLen,
        expectedCanonicalPa: EXPECTED_PA,
        knownExpectedPa: known
          ? {
              id: known.id,
              status: known.status,
              env: known.environment,
              providerUserId: known.providerUserId,
              credentialMasked: mask(known.credentialReference),
              identityOwnerEmail:
                usersById.get(known.financialIdentity.ownerUserId) ?? null,
              identityId: known.financialIdentity.id,
            }
          : null,
        prodMpAccounts: allProdPa.map((pa) => ({
          id: pa.id,
          status: pa.status,
          env: pa.environment,
          providerUserId: pa.providerUserId,
          credentialMasked: mask(pa.credentialReference),
          credentialMeta: pa.credentialReference
            ? credById[pa.credentialReference] ?? null
            : null,
          identityOwnerEmail:
            usersById.get(pa.financialIdentity.ownerUserId) ?? null,
          identityId: pa.financialIdentity.id,
          isPrimary: pa.isPrimary,
          createdAt: pa.createdAt,
        })),
        byProviderUserId: Object.fromEntries(
          Object.entries(byProvider).map(([k, list]) => [
            k,
            list.map((p) => ({
              id: p.id,
              status: p.status,
              classification:
                list.length === 1
                  ? "UNIQUE"
                  : p.id === EXPECTED_PA
                    ? "CANDIDATE_CANONICAL"
                    : "DUPLICATE_OR_ALIAS",
            })),
          ]),
        ),
        distinctProviderUserIds: providerIds,
        grants: grants.map((g) => ({
          email: usersById.get(g.userId) ?? String(g.userId),
          capability: g.capability,
          scopeType: g.scopeType,
          scopeId: g.scopeId,
        })),
        edition,
        agreementSummary,
        decryptResults,
        identityCountFromEmailQuery: identities.length,
      },
      null,
      2,
    ),
  );
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
