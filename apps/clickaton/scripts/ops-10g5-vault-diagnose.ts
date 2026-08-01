/** Diagnose vault decrypt (no tokens printed). */
import { createHash } from "node:crypto";
import { prisma } from "@repo/db";
import { CredentialVault } from "@repo/payments/credential-vault";
import { createPrismaCredentialStore } from "@repo/payments/infrastructure/prisma";

async function main() {
  const key = (process.env.DNX_FINANCIAL_CREDENTIAL_MASTER_KEY ?? "").trim();
  console.log(
    JSON.stringify({
      masterLen: key.length,
      masterSha12: key
        ? createHash("sha256").update(key).digest("hex").slice(0, 12)
        : null,
      expectedSha12: "2ed87c304b99",
      matchRotationMeta: key
        ? createHash("sha256").update(key).digest("hex").slice(0, 12) ===
          "2ed87c304b99"
        : false,
      vercelCurrentSha12Known: "446054392eda",
    }),
  );

  const pa = await prisma.dnxPaymentAccount.findUnique({
    where: { id: "pa_ba733fa7a35f4326" },
    select: {
      credentialReference: true,
      status: true,
      environment: true,
      providerUserId: true,
      updatedAt: true,
    },
  });
  console.log(JSON.stringify({ pa }));

  if (!pa?.credentialReference) {
    console.log(JSON.stringify({ decrypt: "NO_CREDENTIAL" }));
    await prisma.$disconnect();
    return;
  }

  const cred = await prisma.dnxEncryptedCredential.findUnique({
    where: { id: pa.credentialReference },
    select: {
      id: true,
      environment: true,
      provider: true,
      purpose: true,
      keyVersion: true,
      createdAt: true,
      rotatedAt: true,
      revokedAt: true,
    },
  });
  console.log(JSON.stringify({ cred }));

  try {
    const v = new CredentialVault(createPrismaCredentialStore(prisma as never));
    const p = await v.decryptMercadoPagoCredential(pa.credentialReference);
    console.log(
      JSON.stringify({
        decrypt: "PASS",
        tokenLen: (p.accessToken || "").length,
        providerUserId: p.providerUserId ?? null,
      }),
    );
  } catch (e) {
    console.log(
      JSON.stringify({
        decrypt: "FAIL",
        errName: e instanceof Error ? e.name : typeof e,
        errMsg:
          e instanceof Error ? e.message.slice(0, 240) : String(e).slice(0, 240),
      }),
    );
  }
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e instanceof Error ? e.message : e);
  await prisma.$disconnect();
  process.exit(1);
});
