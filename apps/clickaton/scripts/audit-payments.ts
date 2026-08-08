#!/usr/bin/env tsx
/**
 * Auditoría READ-ONLY de inconsistencias de pago.
 *
 *   pnpm clickaton:payments:audit
 *   pnpm clickaton:payments:audit -- --edition-id=...
 *   pnpm clickaton:payments:audit -- --provider --limit=10
 *   pnpm clickaton:payments:audit -- --provider --payment-id=171556178494
 *
 * Cero escrituras. Sin --repair / --apply.
 */
import { auditLocalPaymentInconsistencies } from "../lib/checkout/integrity/audit-local-inconsistencies";
import { auditProviderPaymentInconsistencies } from "../lib/checkout/integrity/audit-provider-inconsistencies";

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
  const editionId = arg("edition-id") ?? arg("editionId");
  const paymentId = arg("payment-id") ?? arg("paymentId");
  const limitRaw = Number(arg("limit") ?? (hasFlag("provider") ? "25" : "500"));
  const limit = Number.isFinite(limitRaw) ? limitRaw : hasFlag("provider") ? 25 : 500;

  if (hasFlag("provider")) {
    const result = await auditProviderPaymentInconsistencies({
      editionId,
      limit,
      paymentId,
      maxRequests: limit,
    });
    console.log(
      JSON.stringify(
        {
          ok: true,
          mode: "provider",
          wrote: false,
          createdRefund: false,
          scanned: result.scanned,
          peeked: result.peeked,
          findingsCount: result.findings.length,
          errorsCount: result.errors.length,
          findings: result.findings.slice(0, 100),
          errors: result.errors.slice(0, 50),
          truncated: result.findings.length > 100,
          environment: {
            VERCEL_ENV: process.env.VERCEL_ENV ?? null,
            hasDatabaseUrl: Boolean(process.env.DATABASE_URL),
          },
        },
        null,
        2,
      ),
    );
    return;
  }

  const result = await auditLocalPaymentInconsistencies({
    editionId,
    limit,
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        mode: "local",
        wrote: false,
        createdRefund: false,
        scanned: result.scanned,
        findingsCount: result.findings.length,
        findings: result.findings.slice(0, 100),
        truncated: result.findings.length > 100,
        environment: {
          VERCEL_ENV: process.env.VERCEL_ENV ?? null,
          hasDatabaseUrl: Boolean(process.env.DATABASE_URL),
        },
      },
      null,
      2,
    ),
  );
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
