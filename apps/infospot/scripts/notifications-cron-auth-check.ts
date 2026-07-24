/**
 * Valida auth del cron outbox localmente (sin secretos en salida).
 *
 *   CRON_SECRET=... pnpm --filter infospot notifications:cron-auth-check
 *   BASE_URL=http://127.0.0.1:3004 CRON_SECRET=... pnpm --filter infospot notifications:cron-auth-check
 */
const base = (process.env.BASE_URL || process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3004").replace(
  /\/$/,
  "",
);
const path = "/api/cron/notifications-outbox";

async function hit(headers: Record<string, string>) {
  const res = await fetch(`${base}${path}`, { headers });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, ok: Boolean((body as { ok?: boolean }).ok), error: (body as { error?: string }).error };
}

async function main() {
  const secret = process.env.CRON_SECRET?.trim();
  const report: Record<string, unknown> = { base, path, secretConfigured: Boolean(secret) };

  report.withoutSecret = await hit({});
  report.wrongSecret = await hit({ Authorization: "Bearer wrong-secret-qa" });

  if (secret) {
    report.withSecret = await hit({ Authorization: `Bearer ${secret}` });
    report.withAltHeader = await hit({ "x-cron-secret": secret });
  } else {
    report.withSecret = { skipped: true, reason: "CRON_SECRET missing" };
  }

  console.log(JSON.stringify(report, null, 2));

  const noAuth = report.withoutSecret as { status: number };
  if (noAuth.status !== 401 && noAuth.status !== 503) {
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
