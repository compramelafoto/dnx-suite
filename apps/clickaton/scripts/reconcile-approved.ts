#!/usr/bin/env tsx
/**
 * Reconciliación de APPROVED tardío (post EXPIRED/CANCELLED automático).
 *
 *   pnpm clickaton:payments:reconcile-approved -- --payment-id=171556178494 --dry-run
 *   pnpm clickaton:payments:reconcile-approved -- --payment-id=171556178494 --apply
 *
 * --dry-run: CERO escrituras.
 * --apply: una sola inscripción; requiere DNX_CONFIRM_PRODUCTION=true en prod.
 * No crea refunds en Mercado Pago. Sin --all / --batch.
 */
import { reconcileApprovedFromProviderPayment } from "../lib/checkout/refunds/reconcile-approved";

function arg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  if (hit) return hit.slice(prefix.length);
  const idx = process.argv.indexOf(`--${name}`);
  if (idx >= 0) return process.argv[idx + 1];
  return undefined;
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function assertNoBatchFlags(): void {
  for (const forbidden of ["all", "batch", "repair-all"]) {
    if (hasFlag(forbidden)) {
      console.error(
        JSON.stringify({
          ok: false,
          error: "batch_flags_forbidden",
          flag: `--${forbidden}`,
          hint: "Solo --payment-id individual en esta etapa.",
        }),
      );
      process.exit(2);
    }
  }
}

function assertProductionApplyGuard(paymentId: string): void {
  const dbUrl = process.env.DATABASE_URL ?? "";
  const host = (() => {
    try {
      return new URL(dbUrl).hostname;
    } catch {
      return "";
    }
  })();
  const dbName = (() => {
    try {
      return new URL(dbUrl).pathname.replace(/^\//, "").split("?")[0] || "";
    } catch {
      return "";
    }
  })();
  const isProdHost =
    host.includes("silent-haze") || dbName === "clickaton_production";
  const vercelEnv = process.env.VERCEL_ENV ?? "";
  const dnxEnv = process.env.DNX_ENVIRONMENT ?? "";
  const looksProduction =
    isProdHost ||
    vercelEnv === "production" ||
    dnxEnv === "production" ||
    process.env.NODE_ENV === "production";

  if (!looksProduction) return;

  if (process.env.DNX_CONFIRM_PRODUCTION !== "true") {
    console.error(
      JSON.stringify({
        ok: false,
        error: "production_apply_guard",
        hint: "Set DNX_CONFIRM_PRODUCTION=true and pass a single --payment-id. Dry-run has no writes.",
        hostHint: host ? `${host.slice(0, 28)}…` : null,
        databaseName: dbName || null,
        paymentId,
      }),
    );
    process.exit(2);
  }
}

async function main() {
  assertNoBatchFlags();

  const paymentId = arg("payment-id") ?? arg("paymentId");
  const apply = hasFlag("apply");
  const dryRun = !apply || hasFlag("dry-run");

  if (!paymentId || !/^\d+$/.test(paymentId)) {
    console.error(
      JSON.stringify({
        ok: false,
        error: "missing_payment_id",
        usage: "--payment-id=<mpPaymentId> [--dry-run|--apply]",
        wrote: false,
      }),
    );
    process.exit(1);
  }

  if (apply && !dryRun) {
    assertProductionApplyGuard(paymentId);
  }

  const plan = await reconcileApprovedFromProviderPayment({
    providerPaymentId: paymentId,
    dryRun,
  });

  console.log(
    JSON.stringify(
      {
        ok: !plan.error,
        ...plan,
        wrote: plan.applied === true,
        createdRefundsInMercadoPago: false,
        note: dryRun
          ? "dry-run: CERO escrituras; consultá recovery/changes"
          : plan.applied
            ? "apply: se intentó recuperar inscripción con APPROVED tardío"
            : "apply: no se mutó (ver error/recovery)",
      },
      null,
      2,
    ),
  );

  if (plan.error) process.exit(1);
}

main().catch((err) => {
  console.error(
    JSON.stringify({
      ok: false,
      wrote: false,
      error: err instanceof Error ? err.message.slice(0, 200) : "unexpected",
    }),
  );
  process.exit(1);
});
