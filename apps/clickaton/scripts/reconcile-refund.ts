#!/usr/bin/env tsx
/**
 * Reconciliación histórica de refunds Mercado Pago → Clickatón.
 *
 * Uso:
 *   pnpm --filter clickaton payments:reconcile-refund -- --payment-id=123 --dry-run
 *   pnpm --filter clickaton payments:reconcile-refund -- --registration-id=clxxx --dry-run
 *   pnpm --filter clickaton payments:reconcile-refund -- --payment-id=123 --apply
 *
 * Nunca crea devoluciones en MP. No usar --apply en producción sin validación previa.
 */
import { reconcileRefundFromProviderPayment } from "../lib/checkout/refunds/reconcile-refund";

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

async function main() {
  const paymentId = arg("payment-id") ?? arg("paymentId");
  const registrationId = arg("registration-id") ?? arg("registrationId");
  const apply = hasFlag("apply");
  const dryRun = !apply || hasFlag("dry-run");

  if (apply) {
    for (const forbidden of ["all", "batch", "repair-all"]) {
      if (hasFlag(forbidden)) {
        console.error(
          JSON.stringify({
            ok: false,
            error: "batch_flags_forbidden",
            flag: `--${forbidden}`,
          }),
        );
        process.exit(2);
      }
    }
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
    const looksProduction =
      host.includes("silent-haze") ||
      dbName === "clickaton_production" ||
      process.env.VERCEL_ENV === "production" ||
      process.env.DNX_ENVIRONMENT === "production";
    if (looksProduction && process.env.DNX_CONFIRM_PRODUCTION !== "true") {
      console.error(
        JSON.stringify({
          ok: false,
          error: "production_apply_guard",
          hint: "Set DNX_CONFIRM_PRODUCTION=true for a single --payment-id apply. Prefer --dry-run first.",
          hostHint: host ? `${host.slice(0, 28)}…` : null,
          databaseName: dbName || null,
        }),
      );
      process.exit(2);
    }
  }

  if (!paymentId && !registrationId) {
    console.error(
      JSON.stringify({
        ok: false,
        error: "missing_args",
        usage:
          "--payment-id=<mpPaymentId> [--dry-run|--apply] | --registration-id=<id> [--dry-run|--apply]",
      }),
    );
    process.exit(1);
  }

  const plan = await reconcileRefundFromProviderPayment({
    providerPaymentId: paymentId,
    registrationId,
    dryRun,
  });

  console.log(
    JSON.stringify(
      {
        ok: !plan.error,
        ...plan,
        note: dryRun
          ? "dry-run: no se aplicaron efectos Clickatón; consultá detected/changes"
          : "apply: se intentó sincronizar DNX + inscripción",
        createdRefundsInMercadoPago: false,
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
      error: err instanceof Error ? err.message.slice(0, 200) : "unexpected",
    }),
  );
  process.exit(1);
});
