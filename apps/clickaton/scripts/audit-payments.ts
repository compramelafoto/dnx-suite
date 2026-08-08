#!/usr/bin/env tsx
/**
 * Auditoría READ-ONLY de inconsistencias de pago locales.
 *
 *   pnpm clickaton:payments:audit
 *   pnpm clickaton:payments:audit -- --edition-id=...
 *
 * Cero escrituras. Sin --repair.
 */
import { auditLocalPaymentInconsistencies } from "../lib/checkout/integrity/audit-local-inconsistencies";

function arg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  if (hit) return hit.slice(prefix.length);
  const idx = process.argv.indexOf(`--${name}`);
  if (idx >= 0) return process.argv[idx + 1];
  return undefined;
}

async function main() {
  const editionId = arg("edition-id") ?? arg("editionId");
  const limitRaw = Number(arg("limit") ?? "500");
  const result = await auditLocalPaymentInconsistencies({
    editionId,
    limit: Number.isFinite(limitRaw) ? limitRaw : 500,
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
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
