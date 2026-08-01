/**
 * 10G.2B — Classification + vault decrypt + financial invariants (read-only).
 * Never prints access tokens or master key.
 */
import { prisma } from "@repo/db";
import { CredentialVault } from "@repo/payments/credential-vault";
import { createPrismaCredentialStore } from "@repo/payments/infrastructure/prisma";

const EDITION_SLUG = "clickaton-argentina-2026";
const CANONICAL_PA = "pa_ba733fa7a35f4326";
const EXPECTED_PROVIDER_USER_ID = "97484805";
const RECIPIENT_EMAIL = "dnxfotografia@gmail.com";
const FINANCE_OWNER_EMAIL = "cuart.daniel@gmail.com";

async function main() {
  const masterLen = (process.env.DNX_FINANCIAL_CREDENTIAL_MASTER_KEY ?? "").trim()
    .length;
  const liveFlag = (process.env.DNX_CLICKATON_MP_LIVE_PAYMENTS_ENABLED ?? "")
    .trim()
    .toLowerCase();

  const prodMp = await prisma.dnxPaymentAccount.findMany({
    where: { provider: "MERCADOPAGO", environment: "PROD" },
    select: {
      id: true,
      status: true,
      providerUserId: true,
      credentialReference: true,
      financialIdentityId: true,
    },
  });

  const byProvider = new Map<string, typeof prodMp>();
  for (const pa of prodMp) {
    const key = pa.providerUserId ?? `null:${pa.id}`;
    const list = byProvider.get(key) ?? [];
    list.push(pa);
    byProvider.set(key, list);
  }

  const canonical = prodMp.find((p) => p.id === CANONICAL_PA) ?? null;
  const providerIds = [...byProvider.keys()].filter((k) => !k.startsWith("null:"));

  let classification: "CANONICAL_UNIQUE" | "DUPLICATES_SAME_PROVIDER" | "MISMATCH" =
    "CANONICAL_UNIQUE";
  if (providerIds.length > 1) classification = "MISMATCH";
  else if (
    canonical?.providerUserId &&
    (byProvider.get(canonical.providerUserId)?.length ?? 0) > 1
  ) {
    classification = "DUPLICATES_SAME_PROVIDER";
  }

  let decrypt: "PASS" | "FAIL" | "NO_KEY" | "NO_CREDENTIAL" | "NO_CANONICAL" =
    "NO_CANONICAL";
  let decryptErr: string | null = null;
  if (!canonical) {
    decrypt = "NO_CANONICAL";
  } else if (masterLen === 0) {
    decrypt = "NO_KEY";
  } else if (!canonical.credentialReference) {
    decrypt = "NO_CREDENTIAL";
  } else {
    try {
      const vault = new CredentialVault(
        createPrismaCredentialStore(prisma as never),
      );
      const payload = await vault.decryptMercadoPagoCredential(
        canonical.credentialReference,
      );
      decrypt =
        payload.accessToken?.trim() && payload.accessToken.trim().length > 10
          ? "PASS"
          : "FAIL";
      if (decrypt === "FAIL") decryptErr = "empty_token";
    } catch (e) {
      decrypt = "FAIL";
      decryptErr = e instanceof Error ? e.message.slice(0, 80) : "fail";
    }
  }

  const edition = await prisma.clickatonEdition.findUnique({
    where: { slug: EDITION_SLUG },
    select: { id: true, status: true, registrationEnabled: true },
  });

  const financeOwner = await prisma.user.findUnique({
    where: { email: FINANCE_OWNER_EMAIL },
    select: { id: true },
  });
  const ownerGrant = financeOwner
    ? await prisma.dnxFinanceGrant.findFirst({
        where: {
          userId: financeOwner.id,
          capability: "DNX_FINANCE_OWNER",
          status: "ACTIVE",
        },
        select: { id: true },
      })
    : null;

  let allocationPercent: number | null = null;
  let recipientEmail: string | null = null;
  let recipientPaId: string | null = null;
  let recipientProviderUserId: string | null = null;
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
                    financialIdentity: { select: { ownerUserId: true } },
                    paymentAccount: {
                      select: { id: true, providerUserId: true },
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
    allocationPercent = rules.reduce((s, r) => s + Number(r.value), 0) / 100;
    const top = [...rules].sort((a, b) => Number(b.value) - Number(a.value))[0];
    if (top) {
      recipientPaId = top.agreementParticipant.paymentAccount?.id ?? null;
      recipientProviderUserId =
        top.agreementParticipant.paymentAccount?.providerUserId ?? null;
      const uid = top.agreementParticipant.financialIdentity.ownerUserId;
      if (uid) {
        const u = await prisma.user.findUnique({
          where: { id: uid },
          select: { email: true },
        });
        recipientEmail = u?.email ?? null;
      }
    }
  }

  const providerOk =
    canonical?.providerUserId === EXPECTED_PROVIDER_USER_ID &&
    (providerIds.length === 0 ||
      (providerIds.length === 1 && providerIds[0] === EXPECTED_PROVIDER_USER_ID));

  const financeOk =
    recipientEmail?.toLowerCase() === RECIPIENT_EMAIL &&
    allocationPercent === 100 &&
    recipientPaId === CANONICAL_PA &&
    Boolean(ownerGrant) &&
    edition?.registrationEnabled === false;

  let verdict:
    | "SINGLE MP COLLECTOR IDENTITY READY"
    | "SINGLE MP COLLECTOR RECONNECT REQUIRED"
    | "MERCADO PAGO ACCOUNT MISMATCH"
    | "PRODUCTION VAULT DECRYPT BLOCKED" = "SINGLE MP COLLECTOR RECONNECT REQUIRED";

  if (!providerOk || classification === "MISMATCH") {
    verdict = "MERCADO PAGO ACCOUNT MISMATCH";
  } else if (decrypt === "PASS" && financeOk && classification === "CANONICAL_UNIQUE") {
    verdict = "SINGLE MP COLLECTOR IDENTITY READY";
  } else if (decrypt === "FAIL" || decrypt === "NO_KEY" || decrypt === "NO_CREDENTIAL") {
    if (masterLen === 0) verdict = "PRODUCTION VAULT DECRYPT BLOCKED";
    else verdict = "SINGLE MP COLLECTOR RECONNECT REQUIRED";
  } else if (decrypt !== "PASS") {
    verdict = "PRODUCTION VAULT DECRYPT BLOCKED";
  }

  console.log(
    JSON.stringify(
      {
        stage: "10G.2B",
        livePaymentsEnabled: liveFlag,
        masterKeyPresent: masterLen >= 32,
        masterKeyLen: masterLen,
        classification,
        accounts: prodMp.map((p) => ({
          id: p.id,
          status: p.status,
          providerUserId: p.providerUserId,
          role:
            p.id === CANONICAL_PA
              ? "CANONICAL"
              : p.providerUserId === EXPECTED_PROVIDER_USER_ID
                ? "DUPLICATE_OR_ALIAS"
                : "OTHER",
        })),
        canonical: canonical
          ? {
              paymentAccountId: canonical.id,
              providerUserId: canonical.providerUserId,
              status: canonical.status,
              hasCredential: Boolean(canonical.credentialReference),
            }
          : null,
        expectedProviderUserId: EXPECTED_PROVIDER_USER_ID,
        providerInvariant: providerOk ? "PASS" : "FAIL",
        vaultDecrypt: decrypt,
        vaultDecryptErr: decryptErr,
        vaultDecryptLabel:
          decrypt === "PASS" ? "VAULT DECRYPT PASS" : `VAULT DECRYPT ${decrypt}`,
        finance: {
          editionSlug: EDITION_SLUG,
          registrationEnabled: edition?.registrationEnabled ?? null,
          recipientEmail,
          allocationPercent,
          recipientPaymentAccountId: recipientPaId,
          recipientProviderUserId,
          financeOwnerGrant: Boolean(ownerGrant),
          financeInvariant: financeOk ? "PASS" : "FAIL",
        },
        concepts: {
          financeOwnerInternal: FINANCE_OWNER_EMAIL,
          recipientInternal: RECIPIENT_EMAIL,
          externalPaymentAccount: CANONICAL_PA,
          note: "Internal roles may share one external Mercado Pago PaymentAccount",
        },
        verdict,
      },
      null,
      2,
    ),
  );

  await prisma.$disconnect();
  if (verdict !== "SINGLE MP COLLECTOR IDENTITY READY") process.exitCode = 2;
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
