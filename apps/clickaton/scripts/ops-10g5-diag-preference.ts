/**
 * Diagnose LIVE preference that fails in Mercado Pago UI.
 * Never prints access tokens.
 */
import { prisma } from "@repo/db";
import { CredentialVault } from "@repo/payments/credential-vault";
import { createPrismaCredentialStore } from "@repo/payments/infrastructure/prisma";

const REG = process.env.REG_ID?.trim() || "cms9acl7k0001xp78c1aq67so";
const PREF =
  process.env.PREF_ID?.trim() ||
  "97484805-844c3840-8618-4e12-a9ca-b7f19651656b";
const CANONICAL_PA = "pa_ba733fa7a35f4326";

async function main() {
  const reg = await prisma.clickatonRegistration.findUnique({
    where: { id: REG },
    select: {
      id: true,
      status: true,
      paymentStatus: true,
      totalAmount: true,
      paymentOrderId: true,
      termsVersion: true,
      holdExpiresAt: true,
      createdAt: true,
      email: true,
    },
  });
  console.log(JSON.stringify({ reg }, null, 2));

  const order = reg?.paymentOrderId
    ? await prisma.dnxPaymentOrder.findUnique({
        where: { id: reg.paymentOrderId },
        select: {
          id: true,
          status: true,
          amountMinor: true,
          currency: true,
          environment: true,
          provider: true,
          createdAt: true,
          paymentIntent: { select: { externalReference: true, status: true } },
          providerOrders: {
            select: {
              providerOrderId: true,
              providerStatus: true,
              mappedStatus: true,
              totalMinor: true,
              rawResponseSanitized: true,
              createdAt: true,
            },
          },
        },
      })
    : null;
  console.log(
    JSON.stringify(
      { order },
      (_, v) => (typeof v === "bigint" ? Number(v) : v),
      2,
    ),
  );

  const pa = await prisma.dnxPaymentAccount.findUnique({
    where: { id: CANONICAL_PA },
    select: {
      credentialReference: true,
      providerUserId: true,
      status: true,
      environment: true,
    },
  });
  const vault = new CredentialVault(createPrismaCredentialStore(prisma as never));
  const payload = await vault.decryptMercadoPagoCredential(pa!.credentialReference!);
  const token = payload.accessToken!.trim();
  console.log(
    JSON.stringify({
      tokenPrefix: token.slice(0, 8),
      tokenLen: token.length,
      providerUserId: payload.providerUserId ?? pa?.providerUserId,
      paStatus: pa?.status,
      paEnv: pa?.environment,
    }),
  );

  const meRes = await fetch("https://api.mercadopago.com/users/me", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const me = (await meRes.json()) as Record<string, unknown>;
  console.log(
    JSON.stringify({
      meHttp: meRes.status,
      meId: me.id,
      nickname: me.nickname,
      siteId: me.site_id,
      status: me.status,
    }),
  );

  const prefRes = await fetch(
    `https://api.mercadopago.com/checkout/preferences/${encodeURIComponent(PREF)}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  const pref = (await prefRes.json()) as Record<string, unknown>;
  console.log(
    JSON.stringify(
      {
        prefHttp: prefRes.status,
        id: pref.id,
        collector_id: pref.collector_id,
        client_id: pref.client_id,
        live_mode: pref.live_mode,
        marketplace: pref.marketplace,
        operation_type: pref.operation_type,
        external_reference: pref.external_reference,
        notification_url: pref.notification_url,
        init_point: typeof pref.init_point === "string" ? pref.init_point : null,
        sandbox_init_point:
          typeof pref.sandbox_init_point === "string"
            ? pref.sandbox_init_point
            : null,
        items: pref.items,
        back_urls: pref.back_urls,
        auto_return: pref.auto_return,
        payer: pref.payer
          ? { email: (pref.payer as { email?: string }).email }
          : null,
        date_created: pref.date_created,
        expiration_date_to: pref.expiration_date_to,
        expires: pref.expires,
        purpose: pref.purpose,
        error: pref.message || pref.error || null,
        cause: pref.cause ?? null,
      },
      null,
      2,
    ),
  );

  // App credentials presence (no secrets)
  console.log(
    JSON.stringify({
      mpClientIdPresent: Boolean(process.env.CLICKATON_MP_CLIENT_ID?.trim()),
      mpClientIdLen: (process.env.CLICKATON_MP_CLIENT_ID ?? "").trim().length,
      mpRedirect: process.env.CLICKATON_MP_REDIRECT_URI ?? null,
      publicUrl: process.env.CLICKATON_PUBLIC_URL ?? null,
      webhook: process.env.DNX_PAYMENTS_WEBHOOK_PUBLIC_URL ?? null,
    }),
  );

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e instanceof Error ? e.message : e);
  await prisma.$disconnect();
  process.exit(1);
});
