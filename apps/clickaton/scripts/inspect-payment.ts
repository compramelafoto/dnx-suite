#!/usr/bin/env tsx
/**
 * Diagnóstico READ-ONLY de un paymentId MP vs inscripción/orden local.
 *
 *   pnpm clickaton:payments:inspect -- --payment-id=171556178494
 *
 * Cero escrituras. No crea refunds. No modifica producción.
 * Solo SELECT/GET + decrypt vault (lectura) para token collector.
 */
import { prisma } from "@repo/db";
import { CredentialVault } from "@repo/payments/credential-vault";
import { createPrismaCredentialStore } from "@repo/payments/infrastructure/prisma";
import { detectPaymentRefundState } from "@repo/payments/mercado-pago";
import { countsAsPaidRegistration } from "../lib/admin-registration/ui/admin-refund-presentation";
import { classifyLateApprovalRecovery } from "../lib/checkout/domain/payment-precedence";

const CANONICAL_LIVE_COLLECTOR_PA = "pa_ba733fa7a35f4326";

function arg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  if (hit) return hit.slice(prefix.length);
  const idx = process.argv.indexOf(`--${name}`);
  if (idx >= 0) return process.argv[idx + 1];
  return undefined;
}

function maskEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const [u, d] = email.split("@");
  if (!u || !d) return "***";
  return `${u.slice(0, 2)}***@${d}`;
}

function maskId(id: string | number | null | undefined): string | null {
  if (id == null) return null;
  const s = String(id);
  if (s.length <= 6) return "***";
  return `${s.slice(0, 4)}…${s.slice(-4)}`;
}

const registrationSelect = {
  id: true,
  status: true,
  paymentStatus: true,
  email: true,
  firstName: true,
  lastName: true,
  totalAmount: true,
  refundedAmountMinor: true,
  providerPaymentId: true,
  lastProviderRefundId: true,
  paymentOrderId: true,
  paymentExternalReference: true,
  holdExpiresAt: true,
  cancelledAt: true,
  confirmedAt: true,
  refundedAt: true,
  createdAt: true,
  updatedAt: true,
  editionId: true,
  credential: { select: { status: true, publicCode: true, issuedAt: true } },
} as const;

type RegRow = Awaited<
  ReturnType<typeof prisma.clickatonRegistration.findFirst<{ select: typeof registrationSelect }>>
>;

async function resolveMpAccessToken(): Promise<{
  token: string | null;
  hint: string;
  collectorIdMasked: string | null;
  environment: string | null;
}> {
  const liveToken =
    process.env.MERCADOPAGO_LIVE_ACCESS_TOKEN?.trim() ||
    process.env.MERCADOPAGO_ACCESS_TOKEN?.trim();
  const testToken = process.env.MERCADOPAGO_TEST_ACCESS_TOKEN?.trim();
  if (liveToken) {
    return {
      token: liveToken,
      hint: "env_live_or_access_token",
      collectorIdMasked: null,
      environment: "env",
    };
  }
  if (testToken) {
    return {
      token: testToken,
      hint: "env_test_token",
      collectorIdMasked: null,
      environment: "test",
    };
  }

  const pa = await prisma.dnxPaymentAccount.findUnique({
    where: { id: CANONICAL_LIVE_COLLECTOR_PA },
    select: {
      credentialReference: true,
      status: true,
      environment: true,
      providerUserId: true,
    },
  });
  if (!pa?.credentialReference) {
    return {
      token: null,
      hint: "collector_credential_missing",
      collectorIdMasked: null,
      environment: null,
    };
  }
  if (!process.env.DNX_FINANCIAL_CREDENTIAL_MASTER_KEY?.trim()) {
    return {
      token: null,
      hint: "master_key_absent",
      collectorIdMasked: maskId(pa.providerUserId),
      environment: pa.environment,
    };
  }
  try {
    const vault = new CredentialVault(createPrismaCredentialStore(prisma as never));
    const payload = await vault.decryptMercadoPagoCredential(pa.credentialReference);
    const token = payload.accessToken?.trim() || null;
    return {
      token,
      hint: token ? "vault_collector_oauth" : "vault_token_empty",
      collectorIdMasked: maskId(pa.providerUserId ?? payload.providerUserId),
      environment: pa.environment,
    };
  } catch {
    return {
      token: null,
      hint: "vault_decrypt_failed",
      collectorIdMasked: maskId(pa.providerUserId),
      environment: pa.environment,
    };
  }
}

async function fetchMpPaymentReadOnly(paymentId: string): Promise<{
  ok: boolean;
  error?: string;
  raw?: Record<string, unknown>;
  envHint?: string;
  collectorIdMasked?: string | null;
  tokenEnvironment?: string | null;
}> {
  const resolved = await resolveMpAccessToken();
  if (!resolved.token) {
    return {
      ok: false,
      error: "no_mp_token",
      envHint: resolved.hint,
      collectorIdMasked: resolved.collectorIdMasked,
      tokenEnvironment: resolved.environment,
    };
  }
  const res = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${resolved.token}` },
  });
  if (!res.ok) {
    return {
      ok: false,
      error: `mp_http_${res.status}`,
      envHint: resolved.hint,
      collectorIdMasked: resolved.collectorIdMasked,
      tokenEnvironment: resolved.environment,
    };
  }
  const raw = (await res.json()) as Record<string, unknown>;
  const collectorId =
    typeof raw.collector_id === "number" || typeof raw.collector_id === "string"
      ? String(raw.collector_id)
      : resolved.collectorIdMasked;
  return {
    ok: true,
    raw,
    envHint: resolved.hint,
    collectorIdMasked: maskId(collectorId),
    tokenEnvironment: resolved.environment,
  };
}

async function findLocalRegistration(
  paymentId: string,
  externalReference: string | null,
): Promise<RegRow> {
  const byProvider = await prisma.clickatonRegistration.findFirst({
    where: {
      OR: [
        { providerPaymentId: paymentId },
        { paymentExternalReference: { contains: paymentId } },
        ...(externalReference
          ? [{ paymentExternalReference: externalReference }]
          : []),
      ],
    },
    select: registrationSelect,
  });
  if (byProvider) return byProvider;

  const po = await prisma.dnxProviderOrder.findFirst({
    where: {
      OR: [
        { providerOrderId: paymentId },
        {
          rawResponseSanitized: {
            path: ["providerPaymentId"],
            equals: paymentId,
          },
        },
        ...(externalReference
          ? [
              {
                rawResponseSanitized: {
                  path: ["externalReference"],
                  equals: externalReference,
                },
              },
            ]
          : []),
      ],
    },
    select: { paymentOrderId: true },
  });
  if (po?.paymentOrderId) {
    return prisma.clickatonRegistration.findFirst({
      where: { paymentOrderId: po.paymentOrderId },
      select: registrationSelect,
    });
  }

  if (externalReference) {
    const order = await prisma.dnxPaymentOrder.findFirst({
      where: { id: externalReference },
      select: { id: true },
    });
    if (order) {
      return prisma.clickatonRegistration.findFirst({
        where: { paymentOrderId: order.id },
        select: registrationSelect,
      });
    }
  }

  return null;
}

async function main() {
  const paymentId = arg("payment-id") ?? arg("paymentId");
  if (!paymentId || !/^\d+$/.test(paymentId)) {
    console.error(
      JSON.stringify({
        ok: false,
        error: "missing_payment_id",
        usage: "--payment-id=<mpPaymentId>",
        wrote: false,
      }),
    );
    process.exit(1);
  }

  const dbUrl = process.env.DATABASE_URL ?? "";
  const dbHost = (() => {
    try {
      return new URL(dbUrl).hostname;
    } catch {
      return null;
    }
  })();
  const dbName = (() => {
    try {
      return new URL(dbUrl).pathname.replace(/^\//, "").split("?")[0] || null;
    } catch {
      return null;
    }
  })();

  // MP primero (GET) para obtener external_reference y enriquecer búsqueda local.
  const mp = await fetchMpPaymentReadOnly(paymentId);
  const externalReference =
    mp.ok && typeof mp.raw?.external_reference === "string"
      ? mp.raw.external_reference
      : null;

  const byOrder = await findLocalRegistration(paymentId, externalReference);
  const detected =
    mp.ok && mp.raw
      ? detectPaymentRefundState({ raw: mp.raw, fallbackPaymentId: paymentId })
      : null;

  let orderStatus: string | null = null;
  let orderAmountMinor: number | null = null;
  let providerOrders: Array<{
    providerOrderId: string;
    status: string | null;
    updatedAt: string;
  }> = [];
  if (byOrder?.paymentOrderId) {
    const order = await prisma.dnxPaymentOrder.findUnique({
      where: { id: byOrder.paymentOrderId },
      select: { status: true, amountMinor: true },
    });
    orderStatus = order?.status ?? null;
    orderAmountMinor =
      order?.amountMinor != null ? Number(order.amountMinor) : null;
    const pos = await prisma.dnxProviderOrder.findMany({
      where: { paymentOrderId: byOrder.paymentOrderId },
      select: {
        providerOrderId: true,
        mappedStatus: true,
        providerStatus: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: "desc" },
      take: 10,
    });
    providerOrders = pos.map((p) => ({
      providerOrderId: p.providerOrderId,
      status: p.mappedStatus ?? p.providerStatus,
      updatedAt: p.updatedAt.toISOString(),
    }));
  }

  const holdExpired =
    byOrder?.holdExpiresAt != null &&
    byOrder.holdExpiresAt.getTime() < Date.now() &&
    byOrder.status !== "CONFIRMED";

  const recovery =
    byOrder && detected
      ? classifyLateApprovalRecovery({
          registrationStatus: byOrder.status,
          paymentStatus: byOrder.paymentStatus,
          orderStatus: detected.status,
          capacityHoldActive: false,
          holdExpired,
        })
      : null;

  const inconsistency: string[] = [];
  if (detected?.status === "APPROVED" && byOrder) {
    if (byOrder.status === "CANCELLED" || byOrder.paymentStatus === "EXPIRED") {
      inconsistency.push("MP_APPROVED_LOCAL_CANCELLED_OR_EXPIRED");
    }
  }
  if (
    (detected?.status === "REFUNDED" ||
      detected?.status === "PARTIALLY_REFUNDED" ||
      (detected?.refundedAmountMinor ?? 0) > 0) &&
    byOrder &&
    byOrder.status === "CONFIRMED" &&
    byOrder.paymentStatus === "APPROVED"
  ) {
    inconsistency.push("MP_REFUNDED_LOCAL_STILL_APPROVED");
  }
  if (!byOrder) inconsistency.push("LOCAL_REGISTRATION_NOT_FOUND");
  if (!mp.ok) inconsistency.push(`MP_FETCH_${mp.error ?? "FAILED"}`);

  const proposedAction =
    inconsistency.includes("MP_APPROVED_LOCAL_CANCELLED_OR_EXPIRED")
      ? "pnpm clickaton:payments:reconcile-approved -- --payment-id=... --dry-run then --apply"
      : inconsistency.includes("MP_REFUNDED_LOCAL_STILL_APPROVED")
        ? "pnpm clickaton:payments:reconcile-refund -- --payment-id=... --dry-run then --apply"
        : inconsistency.includes("LOCAL_REGISTRATION_NOT_FOUND")
          ? "locate registration by email/external_reference; do not mix staging/prod"
          : "none_or_already_consistent";

  const timeline: Array<{ at: string; source: string; event: string }> = [];
  if (byOrder?.createdAt) {
    timeline.push({
      at: byOrder.createdAt.toISOString(),
      source: "clickaton",
      event: "registration_created",
    });
  }
  if (byOrder?.holdExpiresAt) {
    timeline.push({
      at: byOrder.holdExpiresAt.toISOString(),
      source: "clickaton",
      event: "hold_expires_at",
    });
  }
  if (byOrder?.cancelledAt) {
    timeline.push({
      at: byOrder.cancelledAt.toISOString(),
      source: "clickaton",
      event: `cancelled (${byOrder.paymentStatus})`,
    });
  }
  if (byOrder?.confirmedAt) {
    timeline.push({
      at: byOrder.confirmedAt.toISOString(),
      source: "clickaton",
      event: "confirmed",
    });
  }
  if (byOrder?.refundedAt) {
    timeline.push({
      at: byOrder.refundedAt.toISOString(),
      source: "clickaton",
      event: "refunded_local",
    });
  }
  const mpCreated =
    mp.ok && typeof mp.raw?.date_created === "string" ? mp.raw.date_created : null;
  const mpApproved =
    mp.ok && typeof mp.raw?.date_approved === "string" ? mp.raw.date_approved : null;
  const mpUpdated =
    mp.ok && typeof mp.raw?.date_last_updated === "string"
      ? mp.raw.date_last_updated
      : null;
  if (mpCreated) {
    timeline.push({ at: mpCreated, source: "mercadopago", event: "payment_created" });
  }
  if (mpApproved) {
    timeline.push({ at: mpApproved, source: "mercadopago", event: "payment_approved" });
  }
  if (mpUpdated) {
    timeline.push({ at: mpUpdated, source: "mercadopago", event: "payment_last_updated" });
  }
  timeline.sort((a, b) => a.at.localeCompare(b.at));

  const refundsRaw = Array.isArray(mp.raw?.refunds) ? mp.raw.refunds : [];
  const orderObj =
    mp.ok && mp.raw?.order && typeof mp.raw.order === "object"
      ? (mp.raw.order as Record<string, unknown>)
      : null;

  console.log(
    JSON.stringify(
      {
        ok: true,
        wrote: false,
        createdRefund: false,
        readOnly: true,
        environment: {
          VERCEL_ENV: process.env.VERCEL_ENV ?? null,
          NODE_ENV: process.env.NODE_ENV ?? null,
          DNX_ENVIRONMENT: process.env.DNX_ENVIRONMENT ?? null,
          databaseHost: dbHost,
          databaseName: dbName,
          hasDatabaseUrl: Boolean(dbUrl),
          mpCredentialHint: mp.envHint ?? null,
          collectorIdMasked: mp.collectorIdMasked ?? null,
          tokenEnvironment: mp.tokenEnvironment ?? null,
          isClickatonProductionHost:
            Boolean(dbHost?.includes("silent-haze")) &&
            dbName === "clickaton_production",
        },
        paymentIdMasked: maskId(paymentId),
        paymentId,
        mercadoPago: mp.ok
          ? {
              paymentId,
              status: mp.raw?.status ?? null,
              statusDetail: mp.raw?.status_detail ?? null,
              liveMode: mp.raw?.live_mode === true,
              transactionAmount: mp.raw?.transaction_amount ?? null,
              transactionAmountRefunded: mp.raw?.transaction_amount_refunded ?? null,
              dateCreated: mpCreated,
              dateApproved: mpApproved,
              dateLastUpdated: mpUpdated,
              externalReference,
              preferenceId:
                typeof mp.raw?.preference_id === "string" ? mp.raw.preference_id : null,
              orderId: orderObj?.id != null ? String(orderObj.id) : null,
              orderType: orderObj?.type != null ? String(orderObj.type) : null,
              refundsCount: refundsRaw.length,
              refunds: refundsRaw.slice(0, 20).map((r) => {
                const row = r as Record<string, unknown>;
                return {
                  id: row.id != null ? String(row.id) : null,
                  amount: row.amount ?? null,
                  status: row.status ?? null,
                  dateCreated:
                    typeof row.date_created === "string" ? row.date_created : null,
                };
              }),
              collectorIdMasked: mp.collectorIdMasked ?? null,
              detectedNormalized: detected
                ? {
                    status: detected.status,
                    statusDetail: detected.statusDetail,
                    amountMinor: detected.amountMinor,
                    refundedAmountMinor: detected.refundedAmountMinor,
                    netAmountMinor: detected.netAmountMinor,
                    kind: detected.kind,
                    providerRefundIds: detected.providerRefundIds,
                  }
                : null,
            }
          : { error: mp.error ?? "unavailable", hint: mp.envHint ?? null },
        local: byOrder
          ? {
              registrationId: byOrder.id,
              emailMasked: maskEmail(byOrder.email),
              name: `${byOrder.firstName} ${byOrder.lastName}`,
              editionId: byOrder.editionId,
              registrationStatus: byOrder.status,
              paymentStatus: byOrder.paymentStatus,
              checkoutPaymentStatus: byOrder.paymentStatus,
              orderStatus,
              orderAmountMinor,
              totalAmount: byOrder.totalAmount,
              refundedAmountMinor: byOrder.refundedAmountMinor,
              providerPaymentId: byOrder.providerPaymentId,
              lastProviderRefundId: byOrder.lastProviderRefundId,
              paymentOrderId: byOrder.paymentOrderId,
              externalReference: byOrder.paymentExternalReference,
              holdExpiresAt: byOrder.holdExpiresAt?.toISOString() ?? null,
              holdExpired,
              countsAsPaid: countsAsPaidRegistration({
                registrationStatus: byOrder.status,
                paymentStatus: byOrder.paymentStatus,
              }),
              credentialStatus: byOrder.credential?.status ?? null,
              credentialPublicCode: byOrder.credential?.publicCode
                ? maskId(byOrder.credential.publicCode)
                : null,
              cancelledAt: byOrder.cancelledAt?.toISOString() ?? null,
              confirmedAt: byOrder.confirmedAt?.toISOString() ?? null,
              refundedAt: byOrder.refundedAt?.toISOString() ?? null,
              updatedAt: byOrder.updatedAt.toISOString(),
              providerOrders,
              lateApprovalRecovery: recovery,
              panelShouldShowRefunded:
                byOrder.paymentStatus === "REFUNDED" ||
                byOrder.status === "REFUNDED" ||
                byOrder.paymentStatus === "PARTIALLY_REFUNDED",
            }
          : null,
        timeline,
        inconsistency,
        proposedAction,
        rootCauseMatch:
          inconsistency.includes("MP_APPROVED_LOCAL_CANCELLED_OR_EXPIRED") &&
          recovery === "revive_auto_expiration"
            ? "CONFIRMED_EXPIRED_THEN_LATE_APPROVED"
            : inconsistency.includes("MP_REFUNDED_LOCAL_STILL_APPROVED")
              ? "CONFIRMED_REFUND_NOT_MIRRORED"
              : null,
      },
      null,
      2,
    ),
  );

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(
    JSON.stringify({
      ok: false,
      wrote: false,
      createdRefund: false,
      error: err instanceof Error ? err.message.slice(0, 200) : "unexpected",
    }),
  );
  try {
    await prisma.$disconnect();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
