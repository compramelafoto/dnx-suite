/**
 * Smoke end-to-end MANUAL: email autorizado → webhook staging (polling acotado).
 *
 * NO corre en tests. NO se ejecuta sin confirmaciones.
 *
 *   pnpm --filter clickaton communications:webhook:e2e-smoke -- \
 *     --confirm-live-send --confirm-staging-webhook --to AUTORIZADO
 *
 * Sin confirmación → SKIPPED.
 */
import { maskEmail, maskProviderId } from "@repo/communications";

function hasFlag(argv: string[], name: string): boolean {
  return argv.includes(name);
}

function getArg(argv: string[], name: string): string | undefined {
  const i = argv.indexOf(name);
  if (i < 0) return undefined;
  return argv[i + 1];
}

async function main() {
  const argv = process.argv.slice(2);
  const confirmLive = hasFlag(argv, "--confirm-live-send");
  const confirmWh = hasFlag(argv, "--confirm-staging-webhook");
  const to = getArg(argv, "--to");

  if (!confirmLive || !confirmWh || !to) {
    console.log(
      JSON.stringify({
        status: "SKIPPED",
        reason:
          "Requires --confirm-live-send --confirm-staging-webhook --to AUTORIZADO",
        steps: [
          "1. readiness READY / READY WITH WARNINGS (phase C)",
          "2. webhook registered manually in Resend (staging URL)",
          "3. pnpm --filter @repo/communications smoke:resend -- --to … --confirm-live-send",
          "4. pnpm --filter clickaton communications:webhook:recent -- --limit 5",
        ],
      }),
    );
    process.exit(0);
  }

  console.log(
    JSON.stringify({
      status: "MANUAL_HANDOFF",
      note: "This script does not auto-poll Resend indefinitely.",
      toMasked: maskEmail(to),
      correlationHint: maskProviderId(`e2e_${Date.now()}`) ?? null,
      next: [
        "Run package smoke:resend with confirm-live-send",
        "Wait briefly (manual)",
        "Inspect with communications:webhook:recent",
        "Expect delivered/sent; never opened/clicked persisted",
      ],
      received: "not_received",
    }),
  );
}

main().catch((error) => {
  console.error(
    JSON.stringify({
      status: "failed",
      message: error instanceof Error ? error.message.slice(0, 160) : "error",
    }),
  );
  process.exit(1);
});
